import { describe, expect, it } from 'vitest';

import { localDayKey, nextLocalMidnight } from '@/lib/local-day';

describe('localDayKey', () => {
  it('uses the zone, not the server, to decide which day it is', () => {
    // 2026-03-10T06:00:00Z is still the 9th in Los Angeles and already the
    // 10th in Auckland.
    const instant = new Date('2026-03-10T06:00:00Z');

    expect(localDayKey(instant, 'America/Los_Angeles')).toBe('2026-03-09');
    expect(localDayKey(instant, 'Pacific/Auckland')).toBe('2026-03-10');
    expect(localDayKey(instant, 'UTC')).toBe('2026-03-10');
  });

  it('falls back to the host zone when the user has none', () => {
    const instant = new Date('2026-03-10T06:00:00Z');
    expect(localDayKey(instant, null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('nextLocalMidnight', () => {
  it('lands on the first instant of the following day', () => {
    const instant = new Date('2026-03-10T06:00:00Z');
    const boundary = nextLocalMidnight(instant, 'America/Los_Angeles');

    expect(localDayKey(boundary, 'America/Los_Angeles')).toBe('2026-03-10');
    expect(
      localDayKey(new Date(boundary.getTime() - 1000), 'America/Los_Angeles')
    ).toBe('2026-03-09');
  });

  it('is exact on the short day, when the zone loses an hour', () => {
    // US DST starts 2026-03-08; that local day is 23 hours long, so adding a
    // flat 24 hours to local-midnight would overshoot into the 9th.
    const instant = new Date('2026-03-08T18:00:00Z'); // 10:00 PST->PDT day
    const boundary = nextLocalMidnight(instant, 'America/Los_Angeles');

    expect(localDayKey(boundary, 'America/Los_Angeles')).toBe('2026-03-09');
    expect(
      localDayKey(new Date(boundary.getTime() - 1000), 'America/Los_Angeles')
    ).toBe('2026-03-08');
  });

  it('is exact on the long day, when the zone gains an hour', () => {
    // US DST ends 2026-11-01; that local day is 25 hours long.
    const instant = new Date('2026-11-01T18:00:00Z');
    const boundary = nextLocalMidnight(instant, 'America/Los_Angeles');

    expect(localDayKey(boundary, 'America/Los_Angeles')).toBe('2026-11-02');
    expect(
      localDayKey(new Date(boundary.getTime() - 1000), 'America/Los_Angeles')
    ).toBe('2026-11-01');
  });

  it('is always in the future', () => {
    for (const zone of ['UTC', 'Asia/Kolkata', 'Pacific/Chatham']) {
      const now = new Date('2026-08-16T23:59:30Z');
      expect(nextLocalMidnight(now, zone).getTime()).toBeGreaterThan(
        now.getTime()
      );
    }
  });
});
