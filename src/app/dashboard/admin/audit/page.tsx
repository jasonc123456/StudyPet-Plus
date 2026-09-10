import Link from 'next/link';

import {
  adminActionLabel,
  Badge,
  formatDateTime,
  formatRelative,
} from '@/components/admin/admin-format';
import { listAdminAudit } from '@/lib/admin-metrics';

export const dynamic = 'force-dynamic';

/** Everything an admin has done to another account, newest first. */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Number.parseInt(searchParams.page ?? '1', 10) || 1;
  const { rows, total, pageCount } = await listAdminAudit({ page });

  return (
    <div className="flex flex-col gap-4">
      <p className="theme-muted text-sm">
        {total} recorded action{total === 1 ? '' : 's'}. Entries survive the
        deletion of either account, so a removed user still appears by email.
      </p>

      {rows.length === 0 ? (
        <p className="card theme-muted p-4 text-sm">
          No admin actions have been taken yet.
        </p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] text-left">
                <Th>Action</Th>
                <Th>By</Th>
                <Th>Target</Th>
                <Th>Detail</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-[var(--card-border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        entry.action === 'USER_DELETED' ||
                        entry.action === 'USER_SUSPENDED'
                          ? 'danger'
                          : entry.action === 'IMPERSONATION_START'
                            ? 'warning'
                            : 'accent'
                      }
                    >
                      {adminActionLabel(entry.action)}
                    </Badge>
                  </td>
                  <td className="theme-muted px-4 py-3 text-xs">
                    {entry.actorEmail}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {entry.targetUserId ? (
                      <Link
                        href={`/dashboard/admin/users/${entry.targetUserId}`}
                        className="hover:underline"
                      >
                        {entry.targetEmail ?? 'account'}
                      </Link>
                    ) : (
                      <span className="theme-muted">
                        {entry.targetEmail ?? '—'}
                      </span>
                    )}
                  </td>
                  <td className="theme-muted px-4 py-3 text-xs">
                    {entry.detail ?? '—'}
                  </td>
                  <td
                    className="theme-muted px-4 py-3 text-xs"
                    title={formatDateTime(entry.createdAt)}
                  >
                    {formatRelative(entry.createdAt)}
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
              href={`/dashboard/admin/audit?page=${page - 1}`}
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
              href={`/dashboard/admin/audit?page=${page + 1}`}
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
