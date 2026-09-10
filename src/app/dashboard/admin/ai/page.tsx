import Link from 'next/link';

import { Badge } from '@/components/admin/admin-format';
import { StatTile } from '@/components/common/StatTile';
import { getAiQuotaAnalytics } from '@/lib/admin-metrics';

export const dynamic = 'force-dynamic';

/**
 * Where the AI allowance is going.
 *
 * Everything here is derived from the existing per-day AiUsage counters, so it
 * is exact about generations per account per day and deliberately silent about
 * tokens and cost — neither is recorded anywhere in this system.
 */
export default async function AdminAiUsagePage() {
  const analytics = await getAiQuotaAnalytics(30);
  const peak = Math.max(1, ...analytics.daily.map((row) => row.total));

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon="🤖"
          value={analytics.totalGenerations}
          label="Generations (30 days)"
          tone="accent"
        />
        <StatTile
          icon="📊"
          value={analytics.defaultLimit}
          label="Default daily limit"
        />
        <StatTile
          icon="👥"
          value={analytics.topUsers.length}
          label="Accounts generating"
        />
        <StatTile
          icon="🛑"
          value={analytics.usersAtLimitToday}
          label="At their limit today"
          tone={analytics.usersAtLimitToday > 0 ? 'warning' : 'success'}
        />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">
          Daily generations, last {analytics.days} days
        </h2>
        {analytics.daily.length === 0 ? (
          <p className="theme-muted text-sm">
            No AI generations recorded in this window.
          </p>
        ) : (
          <ol className="flex flex-col gap-1">
            {analytics.daily.map((row) => (
              <li key={row.day} className="flex items-center gap-3 text-sm">
                <span className="theme-muted w-24 shrink-0 text-xs">
                  {row.day}
                </span>
                <span
                  className="h-2.5 rounded-full"
                  style={{
                    background: 'var(--accent)',
                    // Scaled against the busiest day in the window rather than
                    // an absolute ceiling, so the shape of the trend is visible
                    // whatever the traffic level.
                    width: `${Math.round((row.total / peak) * 100)}%`,
                    minWidth: '0.5rem',
                  }}
                  aria-hidden
                />
                <span className="shrink-0 text-xs">
                  {row.total}
                  <span className="theme-muted">
                    {' '}
                    · {row.users} account{row.users === 1 ? '' : 's'}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Top consumers ({analytics.days} days)
        </h2>
        {analytics.topUsers.length === 0 ? (
          <p className="card theme-muted p-4 text-sm">
            No account has generated anything in this window.
          </p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-left">
                  <Th>Account</Th>
                  <Th>Total</Th>
                  <Th>Today</Th>
                  <Th>Daily limit</Th>
                  <Th>Today vs limit</Th>
                </tr>
              </thead>
              <tbody>
                {analytics.topUsers.map((user) => (
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
                    <td className="px-4 py-3 font-semibold">{user.total}</td>
                    <td className="px-4 py-3">{user.usedToday}</td>
                    <td className="px-4 py-3">
                      {user.limit}
                      {user.hasOverride && (
                        <span className="theme-muted ml-1 text-xs">
                          (override)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-20 shrink-0 overflow-hidden rounded-full"
                          style={{
                            background:
                              'color-mix(in srgb, var(--accent) 18%, transparent)',
                          }}
                          aria-hidden
                        >
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${user.percentOfLimitToday}%`,
                              background: user.atLimit
                                ? 'var(--danger)'
                                : 'var(--accent)',
                            }}
                          />
                        </span>
                        {user.atLimit ? (
                          <Badge tone="danger">At limit</Badge>
                        ) : (
                          <span className="theme-muted text-xs">
                            {user.percentOfLimitToday}%
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
