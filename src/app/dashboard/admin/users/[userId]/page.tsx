import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Badge,
  authEventLabel,
  authEventTone,
  formatDateTime,
  formatRelative,
  shortUserAgent,
} from '@/components/admin/admin-format';
import { AdminUserActions } from '@/components/admin/AdminUserActions';
import { getAdminActor } from '@/lib/admin';
import { getAdminUserDetail } from '@/lib/admin-metrics';
import { DAILY_GENERATION_LIMIT } from '@/lib/ai/entitlement';

export const dynamic = 'force-dynamic';

export default async function AdminUserDetailPage({
  params,
}: {
  params: { userId: string };
}) {
  const [actor, user] = await Promise.all([
    getAdminActor(),
    getAdminUserDetail(params.userId),
  ]);

  if (!user || !actor) notFound();

  const liveSessions = user.sessions.filter((session) => !session.expired);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/admin/users"
            className="theme-muted text-sm hover:underline"
          >
            ← All users
          </Link>
          <h2 className="mt-1 text-xl font-bold">{user.name ?? 'Unnamed'}</h2>
          <p className="theme-muted text-sm">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {user.role === 'ADMIN' && <Badge tone="accent">Admin</Badge>}
          {user.suspendedAt && <Badge tone="danger">Suspended</Badge>}
          {user.mfaEnabled && <Badge tone="success">2FA enrolled</Badge>}
          {!user.onboardedAt && <Badge tone="warning">Not onboarded</Badge>}
        </div>
      </div>

      {user.suspendedAt && (
        <p
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            color: 'var(--danger)',
            background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
          }}
        >
          Suspended {formatRelative(user.suspendedAt)}
          {user.suspendedReason ? ` — ${user.suspendedReason}` : ''}.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <section className="card p-4">
            <h3 className="mb-3 text-sm font-semibold">Account</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Fact label="Joined" value={formatDateTime(user.createdAt)} />
              <Fact
                label="Onboarded"
                value={
                  user.onboardedAt ? formatDateTime(user.onboardedAt) : '—'
                }
              />
              <Fact
                label="Email verified"
                value={
                  user.emailVerified ? formatDateTime(user.emailVerified) : '—'
                }
              />
              <Fact label="Time zone" value={user.timezone ?? '—'} />
              <Fact label="Pet" value={user.pet?.name ?? '—'} />
              <Fact
                label="Passkeys"
                value={String(user._count.authenticators)}
              />
            </dl>
          </section>

          <section className="card p-4">
            <h3 className="mb-3 text-sm font-semibold">Content</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              <Fact label="Courses" value={String(user._count.courses)} />
              <Fact label="Notes" value={String(user._count.notes)} />
              <Fact label="Quizzes" value={String(user._count.quizzes)} />
              <Fact label="Flashcards" value={String(user._count.flashcards)} />
              <Fact
                label="Groups"
                value={String(user._count.groupMemberships)}
              />
              <Fact label="Events" value={String(user._count.personalEvents)} />
            </dl>
          </section>

          <section className="card p-4">
            <h3 className="mb-1 text-sm font-semibold">AI generation</h3>
            <p className="theme-muted mb-3 text-sm">
              {user.aiUsedToday} of {user.aiLimit} today
              {user.aiDailyLimitOverride !== null && ' (override)'} ·{' '}
              {user.aiUsed30d} in the last 30 days
            </p>
            {user.aiHistory.length === 0 ? (
              <p className="theme-muted text-sm">
                No AI generations recorded in the last 30 days.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {user.aiHistory
                  .slice()
                  .reverse()
                  .map((row) => (
                    <li key={row.day} className="flex items-center gap-3">
                      <span className="theme-muted w-24 shrink-0 text-xs">
                        {row.day}
                      </span>
                      <span
                        className="h-2 rounded-full"
                        style={{
                          background: 'var(--accent)',
                          // Bar width is relative to the account's own limit, so
                          // "nearly full" looks nearly full whatever the limit is.
                          width: `${Math.min(100, Math.round((row.count / user.aiLimit) * 100))}%`,
                          minWidth: '0.5rem',
                        }}
                        aria-hidden
                      />
                      <span className="shrink-0 text-xs">{row.count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <h3 className="mb-3 text-sm font-semibold">
              Sessions ({liveSessions.length} live)
            </h3>
            {user.sessions.length === 0 ? (
              <p className="theme-muted text-sm">No sessions on record.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {user.sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2">
                      <Badge tone={session.expired ? 'neutral' : 'success'}>
                        {session.expired ? 'Expired' : 'Live'}
                      </Badge>
                      {session.impersonatedByUserId && (
                        <Badge tone="warning">Impersonation</Badge>
                      )}
                      {session.mfaVerifiedAt && (
                        <Badge tone="accent">2FA ✓</Badge>
                      )}
                    </span>
                    <span className="theme-muted text-xs">
                      started {formatRelative(session.createdAt)} · expires{' '}
                      {formatRelative(session.expires)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <h3 className="mb-3 text-sm font-semibold">
              Sign-in activity (latest 50)
            </h3>
            {user.events.length === 0 ? (
              <p className="theme-muted text-sm">
                Nothing recorded yet for this account.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <tbody>
                    {user.events.map((event) => (
                      <tr
                        key={event.id}
                        className="border-b border-[var(--card-border)] last:border-0"
                      >
                        <td className="py-2 pr-3">
                          <Badge tone={authEventTone(event.type)}>
                            {authEventLabel(event.type)}
                          </Badge>
                        </td>
                        <td className="theme-muted py-2 pr-3 text-xs">
                          {event.method ?? '—'}
                        </td>
                        <td className="theme-muted py-2 pr-3 font-mono text-xs">
                          {event.ip ?? '—'}
                        </td>
                        <td className="theme-muted py-2 pr-3 text-xs">
                          {shortUserAgent(event.userAgent)}
                        </td>
                        <td
                          className="theme-muted py-2 text-right text-xs"
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
          </section>
        </div>

        <AdminUserActions
          userId={user.id}
          email={user.email}
          isAdmin={user.role === 'ADMIN'}
          isSuspended={user.suspendedAt !== null}
          suspendedReason={user.suspendedReason}
          mfaEnabled={user.mfaEnabled}
          activeSessions={liveSessions.length}
          aiLimit={user.aiLimit}
          hasOverride={user.aiDailyLimitOverride !== null}
          defaultLimit={DAILY_GENERATION_LIMIT}
          isSelf={user.id === actor.id}
        />
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="theme-muted text-xs">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
