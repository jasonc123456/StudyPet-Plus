// Regression corpus for the SSRF address filter.
//
// The bug this exists to prevent: the filter used to compare IPv6 addresses as
// strings, so it recognised ::ffff:127.0.0.1 but not ::ffff:7f00:1 — the same
// loopback address written in hex. IP literals skip DNS entirely, so a URL like
// http://[::ffff:7f00:1]/ went straight to the socket. Every alternate encoding
// of a blocked destination belongs in `blocked` below.

import { describe, expect, it } from 'vitest';

import { isPrivateAddress } from './safe-fetch';

const blocked: Array<[string, string]> = [
  ['127.0.0.1', 'loopback'],
  ['10.0.0.1', 'RFC 1918'],
  ['172.16.5.4', 'RFC 1918'],
  ['192.168.1.1', 'RFC 1918'],
  ['169.254.169.254', 'cloud metadata'],
  ['100.64.0.1', 'CGNAT'],
  ['0.0.0.0', 'this network'],
  ['255.255.255.255', 'broadcast'],
  ['224.0.0.1', 'multicast'],
  ['198.18.0.1', 'benchmarking'],
  ['192.0.2.1', 'documentation'],
  ['198.51.100.7', 'documentation'],
  ['203.0.113.5', 'documentation'],
  ['0177.0.0.1', 'octal spelling of loopback'],
  ['2130706433', 'integer spelling of loopback'],

  ['::1', 'IPv6 loopback'],
  ['::', 'unspecified'],
  ['fe80::1', 'link-local'],
  ['febf::1', 'link-local, upper end of fe80::/10'],
  ['fec0::1', 'site-local'],
  ['fc00::1', 'unique-local'],
  ['fd12:3456::1', 'unique-local'],
  ['ff02::1', 'multicast'],
  ['2001:db8::1', 'documentation'],
  ['2001::1', 'Teredo'],
  ['100::1', 'discard prefix'],
  ['fe80::1%eth0', 'link-local with zone id'],

  // IPv4 destinations wearing an IPv6 spelling — the original bypass.
  ['::ffff:127.0.0.1', 'IPv4-mapped loopback, dotted'],
  ['::ffff:7f00:1', 'IPv4-mapped loopback, hexadecimal'],
  ['0:0:0:0:0:ffff:7f00:1', 'IPv4-mapped loopback, uncompressed'],
  ['::ffff:a9fe:a9fe', 'IPv4-mapped cloud metadata, hexadecimal'],
  ['::ffff:0a00:1', 'IPv4-mapped RFC 1918, hexadecimal'],
  ['::127.0.0.1', 'IPv4-compatible loopback'],
  ['64:ff9b::7f00:1', 'NAT64 loopback'],
  ['2002:7f00:1::1', '6to4 loopback'],

  ['not-an-ip', 'unparseable'],
  ['', 'empty'],
];

const allowed: Array<[string, string]> = [
  ['8.8.8.8', 'public IPv4'],
  ['1.1.1.1', 'public IPv4'],
  ['172.32.0.1', 'just outside 172.16/12'],
  ['192.169.0.1', 'just outside 192.168/16'],
  ['2606:4700:4700::1111', 'public IPv6'],
  ['2a00:1450:4001:80e::200e', 'public IPv6'],
  ['::ffff:8.8.8.8', 'IPv4-mapped public address'],
  ['::ffff:0808:0808', 'IPv4-mapped public address, hexadecimal'],
  ['2002:0808:0808::1', '6to4 wrapping a public address'],
  ['64:ff9b::8.8.8.8', 'NAT64 wrapping a public address'],
];

describe('isPrivateAddress', () => {
  it.each(blocked)('blocks %s (%s)', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(allowed)('allows %s (%s)', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});
