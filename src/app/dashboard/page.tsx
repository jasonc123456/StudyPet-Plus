// Protected landing page after a successful magic-link sign-in
// (signIn redirects here with redirectTo: "/dashboard").
//
// Server component: reads the database-backed session via `auth()`. If there's
// no session we bounce to /login, so this route is effectively gated without
// needing separate middleware.

import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back, {session.user.email}
        </p>
      </div>

      {/* Placeholder stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cards studied today
          </p>
          <p className="mt-2 text-3xl font-bold text-brand-600">0</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Study streak
          </p>
          <p className="mt-2 text-3xl font-bold text-mint-600">0 days</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Decks
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-700">0</p>
        </div>
      </div>
    </div>
  );
}
