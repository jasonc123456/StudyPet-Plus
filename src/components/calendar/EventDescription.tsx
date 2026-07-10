import { Fragment } from 'react';

import { toRichTextSegments } from '@/lib/calendar-text';

type EventDescriptionProps = {
  text: string;
  className?: string;
};

/**
 * Renders a cleaned feed description with real, clickable links.
 *
 * Links open in a new tab — the calendar is a working surface and the targets
 * are Canvas files/pages, so navigating away would lose the user's place.
 * `rel="noreferrer"` because feed contents are third-party URLs we don't vouch for.
 */
export function EventDescription({
  text,
  className = '',
}: EventDescriptionProps) {
  const segments = toRichTextSegments(text);
  if (segments.length === 0) return null;

  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {segments.map((segment, index) =>
        segment.type === 'link' ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700 hover:decoration-brand-500"
          >
            {segment.value}
          </a>
        ) : (
          <Fragment key={index}>{segment.value}</Fragment>
        )
      )}
    </p>
  );
}
