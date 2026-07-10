'use client';

// Makes the signed-in user's stored IANA time zone available to client
// components (primarily <DueDate>) so dates render in the zone the user PICKED
// at onboarding / in Settings — not whatever zone the current browser happens
// to be in. A null value means "fall back to the browser's own zone", which
// keeps behavior sane for any pre-onboarding / edge case.

import { createContext, useContext } from 'react';

const TimezoneContext = createContext<string | null>(null);

export function TimezoneProvider({
  timezone,
  children,
}: {
  timezone: string | null;
  children: React.ReactNode;
}) {
  return (
    <TimezoneContext.Provider value={timezone}>
      {children}
    </TimezoneContext.Provider>
  );
}

/**
 * The user's stored time zone, or `undefined` when none is set. Returning
 * `undefined` (not null) lets it be passed straight to Intl/toLocaleString,
 * which treats `undefined` as "use the runtime's local zone".
 */
export function useTimezone(): string | undefined {
  return useContext(TimezoneContext) ?? undefined;
}
