// The IP resolver decides what lands in the audit log and which bucket a
// caller is throttled in, so the forgeable cases are the point of these tests:
// a client can put anything in X-Forwarded-For, and the only reason we get the
// right answer is that we count in from the RIGHT by the number of proxies we
// run ourselves.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/** Fresh module instance — the env is read once at module load. */
async function loadResolver(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return (await import('@/lib/client-ip')).resolveClientIp;
}

function headers(map: Record<string, string>) {
  return (name: string) => map[name.toLowerCase()] ?? null;
}

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.TRUSTED_PROXY_HOPS;
  delete process.env.TRUST_CLOUDFLARE_CLIENT_IP;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('resolveClientIp — X-Forwarded-For', () => {
  it('takes the connecting address when nothing is in front', async () => {
    const resolve = await loadResolver({ TRUSTED_PROXY_HOPS: '0' });
    expect(resolve(headers({ 'x-real-ip': '203.0.113.7' }))).toBe(
      '203.0.113.7'
    );
  });

  it('counts in from the right by the configured hop count', async () => {
    const resolve = await loadResolver({ TRUSTED_PROXY_HOPS: '2' });
    // client, then NPM appended Cloudflare's address, then nginx appended NPM's.
    const value = resolve(
      headers({ 'x-forwarded-for': '203.0.113.7, 172.16.0.2, 172.16.0.3' })
    );
    expect(value).toBe('203.0.113.7');
  });

  it('ignores a chain prefix the client forged', async () => {
    const resolve = await loadResolver({ TRUSTED_PROXY_HOPS: '2' });
    // The caller sent "1.2.3.4" themselves; their real address is appended by
    // the first proxy that saw them, so it still sits 2 in from the right.
    const value = resolve(
      headers({
        'x-forwarded-for': '1.2.3.4, 203.0.113.7, 172.16.0.2, 172.16.0.3',
      })
    );
    expect(value).toBe('203.0.113.7');
    expect(value).not.toBe('1.2.3.4');
  });

  it('reports unverified when the chain is shorter than expected', async () => {
    const resolve = await loadResolver({ TRUSTED_PROXY_HOPS: '2' });
    expect(resolve(headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe(
      'unverified'
    );
  });

  it('does not fall back to x-real-ip when proxies are configured', async () => {
    const resolve = await loadResolver({ TRUSTED_PROXY_HOPS: '2' });
    expect(resolve(headers({ 'x-real-ip': '10.0.0.5' }))).toBe('unverified');
  });
});

describe('resolveClientIp — Cloudflare toggle', () => {
  it('ignores CF-Connecting-IP while the toggle is off', async () => {
    const resolve = await loadResolver({
      TRUSTED_PROXY_HOPS: '2',
      TRUST_CLOUDFLARE_CLIENT_IP: 'false',
    });
    const value = resolve(
      headers({
        'cf-connecting-ip': '198.51.100.9',
        'x-forwarded-for': '203.0.113.7, 172.16.0.2, 172.16.0.3',
      })
    );
    expect(value).toBe('203.0.113.7');
  });

  it('prefers CF-Connecting-IP once enabled', async () => {
    const resolve = await loadResolver({
      TRUSTED_PROXY_HOPS: '2',
      TRUST_CLOUDFLARE_CLIENT_IP: 'true',
    });
    const value = resolve(
      headers({
        'cf-connecting-ip': '198.51.100.9',
        'x-forwarded-for': '203.0.113.7, 172.16.0.2, 172.16.0.3',
      })
    );
    expect(value).toBe('198.51.100.9');
  });

  it('falls back to the chain when the header is absent', async () => {
    const resolve = await loadResolver({
      TRUSTED_PROXY_HOPS: '2',
      TRUST_CLOUDFLARE_CLIENT_IP: 'true',
    });
    const value = resolve(
      headers({ 'x-forwarded-for': '203.0.113.7, 172.16.0.2, 172.16.0.3' })
    );
    expect(value).toBe('203.0.113.7');
  });

  it('treats only deliberate opt-in values as on', async () => {
    for (const raw of ['false', 'no', '0', 'maybe', '']) {
      const resolve = await loadResolver({
        TRUSTED_PROXY_HOPS: '0',
        TRUST_CLOUDFLARE_CLIENT_IP: raw,
      });
      expect(
        resolve(
          headers({
            'cf-connecting-ip': '198.51.100.9',
            'x-real-ip': '10.0.0.1',
          })
        )
      ).toBe('10.0.0.1');
    }
  });
});
