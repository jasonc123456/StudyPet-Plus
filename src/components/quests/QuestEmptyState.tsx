import Link from 'next/link';

type QuestEmptyStateProps = {
  message?: string;
  actionLabel?: string;
  actionHref: string;
};

export function QuestEmptyState({
  message = 'No quests yet. Add one to start rewarding study goals with XP.',
  actionLabel = 'Add quest',
  actionHref,
}: QuestEmptyStateProps) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="text-4xl" aria-hidden>
        🎯
      </span>
      <p className="mt-4 max-w-sm text-sm text-slate-500">{message}</p>
      <Link href={actionHref} className="btn-primary mt-6">
        {actionLabel}
      </Link>
    </div>
  );
}
