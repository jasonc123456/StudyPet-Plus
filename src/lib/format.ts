import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  QUEST_DIFFICULTIES,
} from '@/lib/constants';
import { richTextToPlainText } from '@/lib/note-rich-text';

// Shared date-display options. formatDueDate/formatUpdatedAt apply these in UTC
// for SSR; formatDueDateLocal/formatUpdatedAtLocal apply them in the user's zone
// after mount — see <DueDate> and <UpdatedAt>.
const DUE_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

function toValidDate(dueAt: Date | string | null | undefined): Date | null {
  if (!dueAt) return null;
  const date = dueAt instanceof Date ? dueAt : new Date(dueAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

// DETERMINISTIC (UTC) formatting. Locale + timezone are pinned so the server
// (which runs in UTC) and the browser's FIRST render produce byte-identical
// text — this is what avoids the React hydration mismatch during SSR. Used for
// the server render and the initial client paint inside <DueDate>.
export function formatDueDate(dueAt: Date | string | null | undefined): string {
  const date = toValidDate(dueAt);
  if (!date) return 'No due date';
  return date.toLocaleString('en-US', { ...DUE_DATE_OPTIONS, timeZone: 'UTC' });
}

// USER-LOCAL formatting. Formats in the user's chosen time zone when one is
// passed (their stored preference from onboarding / Settings); with no
// `timeZone` the JS runtime falls back to the VIEWER's own auto-detected zone.
// Only safe to call on the client AFTER mount — <DueDate> swaps to this
// post-hydration so each user sees the due date in their own local time.
export function formatDueDateLocal(
  dueAt: Date | string | null | undefined,
  timeZone?: string
): string {
  const date = toValidDate(dueAt);
  if (!date) return 'No due date';
  return date.toLocaleString(undefined, { ...DUE_DATE_OPTIONS, timeZone });
}

export function formatUpdatedAt(
  updatedAt: Date | string | null | undefined
): string {
  const date = toValidDate(updatedAt);
  if (!date) return 'Unknown';
  return date.toLocaleString('en-US', { ...DUE_DATE_OPTIONS, timeZone: 'UTC' });
}

// USER-LOCAL formatting for updated-at timestamps. Only safe after mount — see
// <UpdatedAt> for the SSR-safe swap pattern (same as <DueDate>).
export function formatUpdatedAtLocal(
  updatedAt: Date | string | null | undefined,
  timeZone?: string
): string {
  const date = toValidDate(updatedAt);
  if (!date) return 'Unknown';
  return date.toLocaleString(undefined, { ...DUE_DATE_OPTIONS, timeZone });
}

export function notePreview(content: string, maxLength = 120): string {
  const singleLine = richTextToPlainText(content).replace(/\s+/g, ' ').trim();
  if (!singleLine) return 'No content yet';
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength)}…`;
}

export function wordCount(text: string): number {
  const trimmed = richTextToPlainText(text).trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function statusLabel(value: string): string {
  return ASSIGNMENT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function typeLabel(value: string): string {
  return ASSIGNMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function difficultyLabel(value: string): string {
  return (
    QUEST_DIFFICULTIES.find((difficulty) => difficulty.value === value)
      ?.label ?? value
  );
}

export function formatEstimatedTime(
  minutes: number | null | undefined
): string {
  if (!minutes || minutes <= 0) return 'No estimate';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${hours} hr${hours === 1 ? '' : 's'}`;
  return `${hours} hr ${remainder} min`;
}

/** Format a Date for datetime-local input value (local timezone). */
export function toDatetimeLocalValue(
  date: Date | string | null | undefined
): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
