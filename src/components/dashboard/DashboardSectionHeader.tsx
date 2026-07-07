import Link from 'next/link';

type DashboardSectionHeaderProps = {
  title: string;
  href?: string;
  linkLabel?: string;
};

export function DashboardSectionHeader({
  title,
  href,
  linkLabel = 'View all',
}: DashboardSectionHeaderProps) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="shrink-0 text-xs font-medium text-brand-600 transition hover:text-brand-700"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
