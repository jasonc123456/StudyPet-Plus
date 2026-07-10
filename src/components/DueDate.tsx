'use client';

// Renders a due date in the VIEWER's own timezone/locale (auto-detected by the
// browser) without triggering a React hydration mismatch.
//
// How it works:
//   - Server render + first client paint use formatDueDate() — a deterministic
//     UTC string, so the SSR HTML and the initial hydration render match exactly.
//   - After mount, useEffect swaps in formatDueDateLocal(), which formats in the
//     browser's local timezone (Asia/Taipei, a US zone, …) with no pinned zone.
//
// The result: a Taiwan user and a US user each see the date in their own local
// time, with only a one-frame swap from the neutral UTC fallback and no console
// hydration error. suppressHydrationWarning is a belt-and-suspenders guard.

import { useEffect, useState } from 'react';

import { useTimezone } from '@/components/TimezoneProvider';
import { formatDueDate, formatDueDateLocal } from '@/lib/format';

type DueDateProps = {
  dueAt: Date | string | null | undefined;
  className?: string;
};

export function DueDate({ dueAt, className }: DueDateProps) {
  // The user's stored zone (falls back to the browser's own when unset).
  const timeZone = useTimezone();
  // Initial value is the deterministic UTC render (matches the server output).
  const [text, setText] = useState(() => formatDueDate(dueAt));

  useEffect(() => {
    // Post-hydration: re-render in the user's chosen timezone + their locale.
    setText(formatDueDateLocal(dueAt, timeZone));
  }, [dueAt, timeZone]);

  const iso =
    dueAt instanceof Date
      ? dueAt.toISOString()
      : dueAt
        ? new Date(dueAt).toISOString()
        : undefined;

  return (
    <time className={className} dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
