import { notFound } from 'next/navigation';

import { AdminNav } from '@/components/admin/AdminNav';
import { getAdminActor } from '@/lib/admin';

/**
 * Guard for every /dashboard/admin page.
 *
 * notFound() rather than a redirect or a "forbidden" screen: a signed-in
 * non-admin who guesses the URL learns only that the route does not exist,
 * which is what the 404 from /api/admin/* tells them too.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getAdminActor();
  if (!actor) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="theme-muted mt-1 text-sm">
          Signed in as {actor.email}. Actions here are recorded in the audit
          log.
        </p>
      </div>

      <AdminNav />

      {children}
    </div>
  );
}
