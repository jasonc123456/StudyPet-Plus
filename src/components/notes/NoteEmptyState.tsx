import Link from 'next/link';

type NoteEmptyStateProps = {
  message?: string;
  actionLabel?: string;
  actionHref?: string;
  showAction?: boolean;
  clearFiltersHref?: string;
};

export function NoteEmptyState({
  message = 'No notes yet.',
  actionLabel = 'Add note',
  actionHref,
  showAction = true,
  clearFiltersHref,
}: NoteEmptyStateProps) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="text-4xl" aria-hidden>
        📓
      </span>
      <p className="mt-4 max-w-sm text-sm text-slate-500">{message}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {showAction && actionHref && (
          <Link href={actionHref} className="btn-primary">
            {actionLabel}
          </Link>
        )}
        {clearFiltersHref && (
          <Link href={clearFiltersHref} className="btn-secondary">
            Clear filters
          </Link>
        )}
      </div>
    </div>
  );
}
