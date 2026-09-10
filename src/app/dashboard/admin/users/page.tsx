import Link from 'next/link';

import {
  Badge,
  formatBytes,
  formatDateTime,
  formatRelative,
} from '@/components/admin/admin-format';
import { listAdminUsers, type AdminUserFilter } from '@/lib/admin-metrics';

export const dynamic = 'force-dynamic';

const FILTERS: { value: AdminUserFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'admins', label: 'Admins' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'mfa', label: 'With 2FA' },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; filter?: string };
}) {
  const filter = (FILTERS.find((f) => f.value === searchParams.filter)?.value ??
    'all') as AdminUserFilter;
  const query = searchParams.q ?? '';
  const page = Number.parseInt(searchParams.page ?? '1', 10) || 1;

  const { rows, total, pageCount } = await listAdminUsers({
    query,
    page,
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
    return `/dashboard/admin/users${search ? `?${search}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* GET so the query lands in the URL and the page stays shareable and
          bookmarkable — no client state needed for search. */}
      <form method="GET" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search name or email"
          aria-label="Search users"
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
          {total} account{total === 1 ? '' : 's'}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="card theme-muted p-4 text-sm">No accounts match.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] text-left">
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Joined</Th>
                <Th>Last sign-in</Th>
                <Th>Sessions</Th>
                <Th>AI today</Th>
                <Th>Storage</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[var(--card-border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/admin/users/${user.id}`}
                      className="font-medium hover:underline"
                    >
                      {user.name ?? 'Unnamed'}
                    </Link>
                    <div className="theme-muted truncate text-xs">
                      {user.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {user.role === 'ADMIN' && (
                        <Badge tone="accent">Admin</Badge>
                      )}
                      {user.suspendedAt && (
                        <Badge tone="danger">Suspended</Badge>
                      )}
                      {user.mfaEnabled && <Badge tone="success">2FA</Badge>}
                      {user.role === 'USER' &&
                        !user.suspendedAt &&
                        !user.mfaEnabled && (
                          <span className="theme-muted text-xs">User</span>
                        )}
                    </span>
                  </td>
                  <td
                    className="theme-muted px-4 py-3 text-xs"
                    title={formatDateTime(user.createdAt)}
                  >
                    {formatRelative(user.createdAt)}
                  </td>
                  <td
                    className="theme-muted px-4 py-3 text-xs"
                    title={formatDateTime(user.lastSignInAt)}
                  >
                    {formatRelative(user.lastSignInAt)}
                  </td>
                  <td className="px-4 py-3">{user.activeSessions}</td>
                  <td className="px-4 py-3">
                    {user.aiUsedToday}/{user.aiLimit}
                    {user.hasOverride && (
                      <span className="theme-muted ml-1 text-xs">
                        (override)
                      </span>
                    )}
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
