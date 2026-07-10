'use client';

// Renders an updated-at timestamp in the viewer's timezone without a hydration
// mismatch. Same UTC-first / local-after-mount pattern as <DueDate>.

import { useEffect, useState } from 'react';

import { useTimezone } from '@/components/TimezoneProvider';
import { formatUpdatedAt, formatUpdatedAtLocal } from '@/lib/format';

type UpdatedAtProps = {
  updatedAt: Date | string | null | undefined;
  className?: string;
};

export function UpdatedAt({ updatedAt, className }: UpdatedAtProps) {
  const timeZone = useTimezone();
  const [text, setText] = useState(() => formatUpdatedAt(updatedAt));

  useEffect(() => {
    setText(formatUpdatedAtLocal(updatedAt, timeZone));
  }, [updatedAt, timeZone]);

  const iso =
    updatedAt instanceof Date
      ? updatedAt.toISOString()
      : updatedAt
        ? new Date(updatedAt).toISOString()
        : undefined;

  return (
    <time className={className} dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
