import {
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  type AssignmentStatus,
  type AssignmentType,
} from '@/lib/constants';

export function formatDateTime(
  value: Date | string | null | undefined
): string {
  if (!value) return 'No due date';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function toDatetimeLocalValue(
  value: Date | string | null | undefined
): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function datetimeLocalToIso(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function statusLabel(status: string): string {
  return (
    ASSIGNMENT_STATUSES.find((s) => s.value === status)?.label ??
    status.replace('_', ' ')
  );
}

export function typeLabel(type: string): string {
  return ASSIGNMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function statusBadgeClass(status: AssignmentStatus | string): string {
  switch (status) {
    case 'done':
      return 'bg-mint-500/15 text-mint-600';
    case 'in_progress':
      return 'bg-brand-100 text-brand-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function typeBadgeClass(_type: AssignmentType | string): string {
  return 'bg-slate-100 text-slate-700';
}
