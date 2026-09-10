import Link from 'next/link';

import {
  Badge,
  formatBytes,
  formatRelative,
} from '@/components/admin/admin-format';
import { StatTile } from '@/components/common/StatTile';
import { getAdminOverview, listAuthActivity } from '@/lib/admin-metrics';
import {
  authEventLabel,
  authEventTone,
  formatDateTime,
} from '@/components/admin/admin-format';

export const dynamic = 'force-dynamic';

/** Deployment health at a glance, plus the ten most recent auth events. */
export default async function AdminOverviewPage() {
  const [overview, activity] = await Promise.all([
    getAdminOverview(),
    listAuthActivity({ page: 1 }),
  ]);

  const recent = activity.rows.slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="👥" value={overview.totalUsers} label="Total users" />
        <StatTile
          icon="✨"
          value={overview.newUsers7d}
          label="New this week"
          tone="success"
        />
        <StatTile
          icon="🔓"
          value={overview.activeSessions}
          label="Live sessions"
        />
        <StatTile
          icon="🤖"
          value={overview.aiGenerationsToday}
          label="AI generations today"
          tone="accent"
        />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon="🔑"
          value={overview.signIns24h}
          label="Sign-ins (24h)"
        />
        <StatTile
          icon="⛔"
          value={overview.failedAttempts24h}
          label="Failed attempts (24h)"
          tone={overview.failedAttempts24h > 0 ? 'danger' : 'success'}
        />
        <StatTile
          icon="🛡️"
          value={overview.mfaEnabledUsers}
          label="Users with 2FA"
          tone="success"
        />
        <StatTile
          icon="💾"
          value={formatBytes(overview.storageBytes)}
          label="Storage used"
        />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">At a glance</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
          <Fact label="Admins" value={overview.admins} />
          <Fact label="Onboarded" value={overview.onboarded} />
          <Fact label="New (30 days)" value={overview.newUsers30d} />
          <Fact label="Sign-ins (7 days)" value={overview.signIns7d} />
          <Fact
            label="AI generations (30 days)"
            value={overview.aiGenerations30d}
          />
          <Fact
            label="Accounts generating today"
            value={overview.usersWithAiUsageToday}
          />
          <Fact label="Suspended accounts" value={overview.suspended} />
          <Fact label="Stored attachments" value={overview.storedAttachments} />
          <Fact
            label="Attachments of unknown size"
            value={overview.unknownSizeAttachments}
          />
        </dl>
      </section>

      <section aria-labelledby="recent-activity-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-activity-heading" className="text-lg font-semibold">
            Recent sign-in activity
          </h2>
          <Link
            href="/dashboard/admin/activity"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="card theme-muted p-4 text-sm">
            No authentication events recorded yet. The log starts from the
            release that introduced it — earlier sign-ins were never captured.
          </p>
        ) : (
          <ul className="card divide-y divide-[var(--card-border)] p-0">
            {recent.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Badge tone={authEventTone(event.type)}>
                    {authEventLabel(event.type)}
                  </Badge>
                  <span className="truncate">
                    {event.user ? (
                      <Link
                        href={`/dashboard/admin/users/${event.user.id}`}
                        className="hover:underline"
                      >
                        {event.email ?? event.user.email}
                      </Link>
                    ) : (
                      (event.email ?? 'unknown')
                    )}
                  </span>
                </span>
                <span
                  className="theme-muted shrink-0 text-xs"
                  title={formatDateTime(event.createdAt)}
                >
                  {formatRelative(event.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="theme-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
