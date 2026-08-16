// Resource limits on recurrence expansion.
//
// A feed is bytes from a server the user chose but we don't control. Each RRULE
// was capped at 1,000 candidate occurrences and each feed at 5,000 events, but
// nothing capped the product — so a feed of 5,000 daily-forever events expanded
// to five million objects and five million date comparisons inside one page
// render. The cap that matters is the feed-wide one asserted here.

import { describe, expect, it } from 'vitest';

import {
  createExpansionBudget,
  expandRecurringEvent,
  type ParsedIcsEvent,
} from './calendar';

const rangeStart = new Date('2026-01-01T00:00:00Z');
const rangeEnd = new Date('2026-12-31T23:59:59Z');

function makeEvent(rrule: string | null, index = 0): ParsedIcsEvent {
  return {
    uid: `evt-${index}`,
    summary: `Event ${index}`,
    description: null,
    startsAt: new Date('2026-01-05T10:00:00Z'),
    endsAt: new Date('2026-01-05T11:00:00Z'),
    allDay: false,
    rrule,
  };
}

describe('recurrence expansion limits', () => {
  it('bounds a whole feed, not just each rule in it', () => {
    const budget = createExpansionBudget();
    const events = Array.from({ length: 5000 }, (_, i) =>
      makeEvent('FREQ=DAILY;INTERVAL=1', i)
    );

    const total = events.reduce(
      (sum, event) =>
        sum + expandRecurringEvent(event, rangeStart, rangeEnd, budget).length,
      0
    );

    expect(total).toBeLessThanOrEqual(20_000);
    expect(budget.remaining).toBe(0);
  });

  it('still expands an ordinary recurring event fully', () => {
    const occurrences = expandRecurringEvent(
      makeEvent('FREQ=DAILY;INTERVAL=1'),
      rangeStart,
      rangeEnd,
      createExpansionBudget()
    );

    expect(occurrences.length).toBeGreaterThan(300);
  });

  it('collapses repeated BYDAY tokens instead of multiplying them', () => {
    const dupBudget = createExpansionBudget();
    const singleBudget = createExpansionBudget();

    const duplicated = expandRecurringEvent(
      makeEvent('FREQ=WEEKLY;BYDAY=MO,MO,MO,MO,MO'),
      rangeStart,
      rangeEnd,
      dupBudget
    );
    const once = expandRecurringEvent(
      makeEvent('FREQ=WEEKLY;BYDAY=MO'),
      rangeStart,
      rangeEnd,
      singleBudget
    );

    expect(duplicated.length).toBe(once.length);
    expect(dupBudget.remaining).toBe(singleBudget.remaining);
  });
});
