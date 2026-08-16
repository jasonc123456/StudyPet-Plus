// Calendar-day arithmetic in a user's own time zone.
//
// A "day" for quota purposes has to be the user's day, not the server's —
// someone in Auckland whose allowance rolled over at UTC midnight would see it
// reset in the middle of their afternoon.

/** The calendar day containing `date` in `timeZone`, as "YYYY-MM-DD". */
export function localDayKey(date: Date, timeZone?: string | null): string {
  // en-CA formats as YYYY-MM-DD, which sorts and compares as a string.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * The first instant of the next calendar day in `timeZone`.
 *
 * Derived from the wall clock rather than by adding 24 hours, then nudged in
 * hour steps to land exactly on the boundary — on the two days a year a zone
 * shifts, the day is 23 or 25 hours long and a flat addition misses.
 */
export function nextLocalMidnight(date: Date, timeZone?: string | null): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone || undefined,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const part = (type: string) =>
    Number.parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  const msIntoDay =
    part('hour') * 3_600_000 + part('minute') * 60_000 + part('second') * 1000;

  const today = localDayKey(date, timeZone);
  let candidate = new Date(date.getTime() + (86_400_000 - msIntoDay));

  // Still today (the zone gained an hour): walk forward.
  for (let i = 0; i < 3 && localDayKey(candidate, timeZone) === today; i += 1) {
    candidate = new Date(candidate.getTime() + 3_600_000);
  }

  // Overshot into the day after (the zone lost an hour): walk back while the
  // hour before is still on the far side of the boundary.
  for (let i = 0; i < 3; i += 1) {
    const earlier = new Date(candidate.getTime() - 3_600_000);
    if (localDayKey(earlier, timeZone) === today) break;
    candidate = earlier;
  }

  return candidate;
}
