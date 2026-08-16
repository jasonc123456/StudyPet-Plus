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
 * Expand an IPv6 literal to its 16 bytes, or null if it isn't one.
 *
 * Everything here is byte-level on purpose. Matching IPv6 by string prefix — the
 * shape this replaced — reads only one spelling of an address, and IPv6 has many
 * for the same destination: ::ffff:127.0.0.1 and ::ffff:7f00:1 are the same
 * loopback, "fe80" as a prefix test misses the rest of fe80::/10, and a textual
 * check has no answer at all for 2002:: or 64:ff9b:: carrying an IPv4 payload.
 */
function ipv6ToBytes(address: string): Uint8Array | null {
  let text = address.toLowerCase();

  // Scope/zone id ("fe80::1%eth0") names an interface, never a destination.
  const zone = text.indexOf('%');
  if (zone !== -1) text = text.slice(0, zone);

  const bytes = new Uint8Array(16);

  // A trailing dotted quad ("::ffff:127.0.0.1") occupies the last four bytes.
  let tail: number[] = [];
  const lastColon = text.lastIndexOf(':');
  const trailer = text.slice(lastColon + 1);
  if (trailer.includes('.')) {
    const quad = ipv4ToBytes(trailer);
    if (!quad) return null;
    tail = Array.from(quad);
    // Drop the quad and the colon introducing it, but never break up a "::" —
    // "::127.0.0.1" must keep its compression marker to expand correctly.
    const head = text.slice(0, lastColon + 1);
    text = head.endsWith('::') ? head : head.slice(0, -1);
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const groups: number[] = [];
    for (const group of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      groups.push(parseInt(group, 16));
    }
    return groups;
  };

  const head = parseGroups(halves[0] ?? '');
  const rest = halves.length === 2 ? parseGroups(halves[1] ?? '') : null;
  if (!head || (halves.length === 2 && !rest)) return null;

  const groups: number[] =
    halves.length === 2
      ? [
          ...head,
          ...new Array(8 - head.length - rest!.length - tail.length / 2).fill(
            0
          ),
          ...rest!,
        ]
      : head;

  const expected = 8 - tail.length / 2;
  if (groups.length !== expected) return null;

  groups.forEach((group, index) => {
    bytes[index * 2] = (group >> 8) & 0xff;
    bytes[index * 2 + 1] = group & 0xff;
  });
  tail.forEach((byte, index) => {
    bytes[12 + index] = byte;
  });

  return bytes;
}

/** Parse a dotted-quad IPv4 literal to its 4 bytes, or null. */
function ipv4ToBytes(address: string): Uint8Array | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;

  const bytes = new Uint8Array(4);
  for (let index = 0; index < 4; index += 1) {
    const part = parts[index]!;
    // No leading zeros: "0177.0.0.1" is octal loopback to some resolvers.
    if (!/^(0|[1-9][0-9]{0,2})$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    bytes[index] = value;
  }

  return bytes;
}

/** True for IPv4 ranges that must never be dialed. */
function isPrivateIpv4(bytes: Uint8Array): boolean {
  const [a, b, c] = bytes as unknown as [number, number, number, number];

  if (a === 0) return true; // "this network"
  if (a === 10) return true; // RFC 1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
  if (a === 192 && b === 168) return true; // RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // documentation
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // documentation
  if (a === 203 && b === 0 && c === 113) return true; // documentation
  if (a >= 224) return true; // multicast, reserved, broadcast

  return false;
}

/**
 * True for any address the server must never fetch: loopback, private (RFC 1918
 * / CGNAT), link-local — which includes the cloud metadata endpoint
 * 169.254.169.254 — multicast, documentation and reserved ranges, and every IPv6
 * spelling of the same. Anything unparseable is refused too. This is the
 * allow/deny core of the SSRF guard.
 */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const bytes = ipv4ToBytes(address);
    return bytes ? isPrivateIpv4(bytes) : true;
  }

  if (version === 6) {
    const bytes = ipv6ToBytes(address);
    if (!bytes) return true;

    const allZero = bytes.every((byte) => byte === 0);
    if (allZero) return true; // :: unspecified

    const isLoopback =
      bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
    if (isLoopback) return true; // ::1

    const [b0, b1, b2, b3] = bytes as unknown as number[];

    if (b0 === 0xff) return true; // ff00::/8 multicast
    if (b0 === 0xfe && (b1! & 0xc0) === 0x80) return true; // fe80::/10 link-local
    if (b0 === 0xfe && (b1! & 0xc0) === 0xc0) return true; // fec0::/10 site-local
    if ((b0! & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
    if (b0 === 0x01 && b1 === 0x00 && b2 === 0x00 && b3 === 0x00) return true; // 100::/64 discard
    if (b0 === 0x20 && b1 === 0x01 && b2 === 0x0d && b3 === 0xb8) return true; // 2001:db8::/32 docs
    if (b0 === 0x20 && b1 === 0x01 && b2 === 0x00 && b3 === 0x00) return true; // 2001::/32 Teredo

    // Forms that carry an IPv4 destination inside an IPv6 address. Each one is
    // resolved back to those four bytes and judged as IPv4, so ::ffff:7f00:1 is
    // refused for the same reason 127.0.0.1 is.
    const embedded = (offset: number) => bytes.slice(offset, offset + 4);

    const isMapped =
      bytes.slice(0, 10).every((byte) => byte === 0) &&
      bytes[10] === 0xff &&
      bytes[11] === 0xff;
    if (isMapped) return isPrivateIpv4(embedded(12)); // ::ffff:a.b.c.d

    const isCompatible = bytes.slice(0, 12).every((byte) => byte === 0);
    if (isCompatible) return isPrivateIpv4(embedded(12)); // ::a.b.c.d (deprecated)

    const isNat64 =
      b0 === 0x00 &&
      b1 === 0x64 &&
      b2 === 0xff &&
      b3 === 0x9b &&
      bytes.slice(4, 12).every((byte) => byte === 0);
    if (isNat64) return isPrivateIpv4(embedded(12)); // 64:ff9b::/96

    if (b0 === 0x20 && b1 === 0x02) return isPrivateIpv4(embedded(2)); // 2002::/16 6to4

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
      // Destroyed, not drained. res.resume() reads the body to completion with
      // no deadline of its own, so a server that sends headers promptly and then
      // trickles an endless body keeps the socket alive past every timeout here.
      // Nothing in a redirect or error body is wanted, so the socket is closed
      // outright rather than read to the end.
      res.destroy();
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
      res.destroy();
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
