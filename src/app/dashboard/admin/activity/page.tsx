import Link from 'next/link';

import {
  Badge,
  authEventLabel,
  authEventTone,
  formatDateTime,
  formatRelative,
  shortUserAgent,
} from '@/components/admin/admin-format';
import { listAuthActivity, type AuthActivityFilter } from '@/lib/admin-metrics';
import { AUTH_EVENT_RETENTION_DAYS, pruneAuthEvents } from '@/lib/auth-events';

export const dynamic = 'force-dynamic';

const FILTERS: { value: AuthActivityFilter; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'success', label: 'Successful' },
  { value: 'failures', label: 'Failures' },
];

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; filter?: string };
}) {
  const filter = (FILTERS.find((f) => f.value === searchParams.filter)?.value ??
    'all') as AuthActivityFilter;
  const query = searchParams.q ?? '';
  const page = Number.parseInt(searchParams.page ?? '1', 10) || 1;

  // Retention is enforced from the page that reads the log. There is no
  // scheduler in this deployment, and a cron living in one replica is a
  // retention promise that quietly stops being kept.
  await pruneAuthEvents();

  const { rows, total, pageCount } = await listAuthActivity({
    page,
    query,
    filter,
  });

  const buildHref = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: query, filter, page, ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value === undefined || value === '' || value === 'all') continue;
      if (key === 'page' && value === 1) continue;
      params.set(key, String(value));
    }
    const search = params.toString();
    return `/dashboard/admin/activity${search ? `?${search}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="theme-muted text-sm">
        Every sign-in attempt, sign-out, and second-factor check. Addresses and
        devices are kept for {AUTH_EVENT_RETENTION_DAYS} days, then deleted.
      </p>

      <form method="GET" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search email or IP"
          aria-label="Search activity"
          className="theme-input w-full rounded-lg px-3 py-2 text-sm sm:w-72"
        />
        {filter !== 'all' && (
          <input type="hidden" name="filter" value={filter} />
        )}
        <button type="submit" className="btn-secondary">
          Search
        </button>
        {query && (
          <Link href={buildHref({ q: '', page: 1 })} className="btn-secondary">
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={buildHref({ filter: option.value, page: 1 })}
            className={[
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              option.value === filter
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
            ].join(' ')}
          >
            {option.label}
          </Link>
        ))}
        <span className="theme-muted ml-auto self-center text-sm">
          {total} event{total === 1 ? '' : 's'}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="card theme-muted p-4 text-sm">
          Nothing recorded yet. The log starts from the release that introduced
          it — sign-ins before that were never captured anywhere.
        </p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] text-left">
                <Th>Event</Th>
                <Th>Account</Th>
                <Th>Method</Th>
                <Th>IP</Th>
                <Th>Device</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-[var(--card-border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <Badge tone={authEventTone(event.type)}>
                      {authEventLabel(event.type)}
                    </Badge>
                    {event.detail && (
                      <div className="theme-muted mt-0.5 text-xs">
                        {event.detail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {event.user ? (
                      <Link
                        href={`/dashboard/admin/users/${event.user.id}`}
                        className="hover:underline"
                      >
                        {event.email ?? event.user.email}
                      </Link>
                    ) : (
                      <span className="theme-muted">
                        {event.email ?? 'unknown'}
                      </span>
                    )}
                  </td>
                  <td className="theme-muted px-4 py-3 text-xs">
                    {event.method ?? '—'}
                  </td>
                  <td className="theme-muted px-4 py-3 font-mono text-xs">
                    {event.ip ?? '—'}
                  </td>
                  <td className="theme-muted px-4 py-3 text-xs">
                    {shortUserAgent(event.userAgent)}
                  </td>
                  <td
                    className="theme-muted px-4 py-3 text-xs"
                    title={formatDateTime(event.createdAt)}
                  >
                    {formatRelative(event.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav
          className="flex items-center justify-between"
          aria-label="Pagination"
        >
          {page > 1 ? (
            <Link
              href={buildHref({ page: page - 1 })}
              className="btn-secondary"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="theme-muted text-sm">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={buildHref({ page: page + 1 })}
              className="btn-secondary"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="theme-muted px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
      {children}
    </th>
  );
}
