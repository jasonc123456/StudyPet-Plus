import Link from 'next/link';

type EmptyStateProps = {
  title?: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyState({
  title = 'No courses yet',
  message = 'Add your first course to start organizing tasks.',
  actionLabel = 'Add course',
  actionHref = '/dashboard/courses/new',
}: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="text-4xl" aria-hidden>
        📚
      </span>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{message}</p>
      <Link href={actionHref} className="btn-primary mt-6">
        {actionLabel}
      </Link>
    </div>
  );
}
