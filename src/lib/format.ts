import { ASSIGNMENT_STATUSES, ASSIGNMENT_TYPES } from '@/lib/constants';

export function formatDueDate(dueAt: Date | string | null | undefined): string {
  if (!dueAt) return 'No due date';
  const date = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function statusLabel(value: string): string {
  return ASSIGNMENT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function typeLabel(value: string): string {
  return ASSIGNMENT_TYPES.find((t) => t.value === value)?.label ?? value;
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
