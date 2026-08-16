// The one outbound HTTP client for user-supplied URLs.
//
// StudyPet+ fetches exactly one class of attacker-influenced URL: the ICS
// calendar link a student pastes in. That single feature carries the whole SSRF
// surface, so the rules live here rather than at each call site:
//
//   * every address the socket actually dials is checked before it connects,
//     including on redirects and on every later re-fetch of a stored feed;
//   * redirects are followed manually, revalidating scheme + host per hop;
//   * a request has a deadline for headers AND a deadline for the whole body,
//     so a feed that trickles bytes can't pin a worker open indefinitely;
//   * the body is capped, streaming, regardless of what Content-Length claims.
//
// Built on node:http/node:https rather than fetch() on purpose. Node's `lookup`
// hook lets us validate the resolved address at connect time, which closes the
// DNS-rebinding window: with a validate-then-fetch design, the name can resolve
// publicly for the check and privately for the connection a moment later. Here
// there is no window — the address we approve is the address dialed.

import {
  lookup as dnsLookup,
  type LookupAddress,
  type LookupOptions,
} from 'node:dns';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';

export type SafeFetchErrorKind =
  /** Refused before or at connect: bad scheme, private address, dead name. */
  | 'blocked'
  /** Headers or body exceeded their deadline. */
  | 'timeout'
  /** Body ran past the byte cap. */
  | 'too-large'
  /** Redirect chain was too long, or a redirect had no usable target. */
  | 'redirect'
  /** Anything else — DNS failure, connection reset, TLS error. */
  | 'network';

export class SafeFetchError extends Error {
  constructor(
    message: string,
    readonly kind: SafeFetchErrorKind
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export type SafeFetchOptions = {
  /** Hard cap on the response body. Exceeding it aborts mid-stream. */
  maxBytes: number;
  /** Deadline from request start to response headers. */
  headersTimeoutMs: number;
  /** Deadline from request start to the last byte of the body. */
  totalTimeoutMs: number;
  headers?: Record<string, string>;
  /** Redirect hops to follow. Each one is revalidated from scratch. */
  maxRedirects?: number;
};

export type SafeFetchResult = {
  status: number;
  /** The URL that actually served the response, after any redirects. */
  finalUrl: string;
  /** Body text, capped. Empty for a non-2xx response — we don't read those. */
  text: string;
};

const DEFAULT_MAX_REDIRECTS = 3;

/**
 * True for any address the server must never fetch: loopback, private (RFC 1918
 * / CGNAT), link-local — which includes the cloud metadata endpoint
 * 169.254.169.254 — multicast, and the IPv6 equivalents. Anything unparseable is
 * refused too. This is the allow/deny core of the SSRF guard.
 */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
      return true;
    }
    const [a, b] = parts as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  if (version === 6) {
    const addr = address.toLowerCase();
    if (addr === '::1' || addr === '::') return true; // loopback / unspecified
    if (addr.startsWith('fe80')) return true; // link-local
    if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // unique-local
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
    if (mapped) return isPrivateAddress(mapped[1]!); // IPv4-mapped
    return false;
  }

  return true; // not a valid IP literal — refuse
}

/** Parse + check everything about a URL that doesn't need the network. */
function parsePublicUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError('Invalid URL', 'blocked');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('URL must use http or https', 'blocked');
  }

  // An IP literal never reaches the lookup hook below, so it is checked here.
  const host = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (isIP(host) && isPrivateAddress(host)) {
    throw new SafeFetchError('URL resolves to a private address', 'blocked');
  }

  return url;
}

/**
 * A dns.lookup drop-in that refuses to hand back a private address.
 *
 * Node calls this from inside net.connect/tls.connect, so whatever it returns
 * is what the socket dials — there is no gap for the name to re-resolve
 * somewhere else in between.
 */
type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void;

function pinnedLookup(
  hostname: string,
  options: LookupOptions,
  callback: LookupCallback
): void {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, '', 4);
      return;
    }

    const resolved: LookupAddress[] = Array.isArray(addresses) ? addresses : [];
    if (resolved.length === 0) {
      callback(new SafeFetchError('Host did not resolve', 'blocked'), '', 4);
      return;
    }

    // Every candidate must pass, not just the one we'd hand back: Node may fall
    // back to a later address, and a name that answers with one public and one
    // private record is exactly the rebinding shape we're refusing.
    const blocked = resolved.find((entry) => isPrivateAddress(entry.address));
    if (blocked) {
      callback(
        new SafeFetchError(
          `Host resolves to a private address (${blocked.address})`,
          'blocked'
        ),
        '',
        4
      );
      return;
    }

    if (options.all) {
      callback(null, resolved);
      return;
    }
    callback(null, resolved[0]!.address, resolved[0]!.family);
  });
}

/** Statuses that carry a Location we're willing to follow. */
function isRedirect(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

/** One hop: connect, wait for headers, hand back the live response stream. */
function requestOnce(
  url: URL,
  options: SafeFetchOptions
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;

    const req = send(
      url,
      {
        method: 'GET',
        // Node's own LookupFunction type only describes the single-address
        // overload; ours also handles `all: true`, which is a superset.
        lookup: pinnedLookup as unknown as LookupFunction,
        headers: {
          // Node would otherwise advertise itself; be explicit and boring.
          'user-agent': 'StudyPet+/1.0 (+calendar-feed)',
          ...options.headers,
        },
      },
      (res) => {
        clearTimeout(headersTimer);
        resolve(res);
      }
    );

    const headersTimer = setTimeout(() => {
      req.destroy(
        new SafeFetchError('Timed out waiting for headers', 'timeout')
      );
    }, options.headersTimeoutMs);

    req.on('error', (error) => {
      clearTimeout(headersTimer);
      reject(
        error instanceof SafeFetchError
          ? error
          : new SafeFetchError(error.message, 'network')
      );
    });

    req.end();
  });
}

/**
 * Drain a response under both a byte cap and a wall-clock deadline.
 *
 * The deadline is the half that was missing: a feed that dribbles one byte at a
 * time stays under any size cap forever, so without it the caller waits as long
 * as the publisher feels like holding the socket.
 */
function readCappedText(
  res: IncomingMessage,
  maxBytes: number,
  deadlineMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number(res.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      res.destroy();
      reject(new SafeFetchError('Response is too large', 'too-large'));
      return;
    }

    const chunks: Buffer[] = [];
    let total = 0;

    const timer = setTimeout(() => {
      res.destroy(new SafeFetchError('Response body timed out', 'timeout'));
    }, deadlineMs);

    res.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        clearTimeout(timer);
        res.destroy();
        reject(new SafeFetchError('Response is too large', 'too-large'));
        return;
      }
      chunks.push(chunk);
    });

    res.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    res.on('error', (error) => {
      clearTimeout(timer);
      reject(
        error instanceof SafeFetchError
          ? error
          : new SafeFetchError(error.message, 'network')
      );
    });
  });
}

/**
 * GET a user-supplied URL under the full policy above.
 *
 * Redirects are followed by hand so each hop goes back through the same scheme
 * and address checks as the original. Following them with the runtime's own
 * redirect handling — which is what this replaced — meant only the first URL
 * was ever validated, and a public host could bounce the server anywhere.
 */
export async function fetchPublicText(
  rawUrl: string,
  options: SafeFetchOptions
): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const startedAt = Date.now();

  let url = parsePublicUrl(rawUrl);

  for (let hop = 0; ; hop += 1) {
    const elapsed = Date.now() - startedAt;
    const remaining = options.totalTimeoutMs - elapsed;
    if (remaining <= 0) {
      throw new SafeFetchError('Request timed out', 'timeout');
    }

    const res = await requestOnce(url, {
      ...options,
      headersTimeoutMs: Math.min(options.headersTimeoutMs, remaining),
    });

    const status = res.statusCode ?? 0;

    if (isRedirect(status)) {
      res.resume(); // drain and free the socket; we only want the Location
      if (hop >= maxRedirects) {
        throw new SafeFetchError('Too many redirects', 'redirect');
      }
      const location = res.headers.location;
      if (!location) {
        throw new SafeFetchError('Redirect without a target', 'redirect');
      }
      // Re-parsed and re-checked from scratch, and the next connect runs the
      // pinned lookup again.
      url = parsePublicUrl(new URL(location, url).toString());
      continue;
    }

    if (status < 200 || status >= 300) {
      res.resume();
      return { status, finalUrl: url.toString(), text: '' };
    }

    const text = await readCappedText(
      res,
      options.maxBytes,
      Math.max(1, options.totalTimeoutMs - (Date.now() - startedAt))
    );

    return { status, finalUrl: url.toString(), text };
  }
}
