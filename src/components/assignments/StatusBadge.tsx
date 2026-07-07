import { statusLabel } from '@/lib/format';

export const STATUS_BADGE_STYLES: Record<string, string> = {
  todo: 'bg-slate-50/90 text-slate-500 ring-1 ring-inset ring-slate-200/70',
  in_progress:
    'bg-amber-50/90 text-amber-600 ring-1 ring-inset ring-amber-200/60',
  done: 'bg-emerald-50/90 text-emerald-600 ring-1 ring-inset ring-emerald-200/60',
};

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide ${STATUS_BADGE_STYLES[status] ?? 'bg-slate-50/90 text-slate-500 ring-1 ring-inset ring-slate-200/70'}`}
    >
      {statusLabel(status)}
    </span>
  );
}
