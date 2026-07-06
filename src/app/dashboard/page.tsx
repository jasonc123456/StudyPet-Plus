// Protected landing page after a successful magic-link sign-in
// (signIn redirects here with redirectTo: "/dashboard").
//
// Server component: reads the database-backed session via `auth()`. If there's
// no session we bounce to /login, so this route is effectively gated without
// needing separate middleware.

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { prisma } from '@/lib/prisma';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

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

      {/* Course summary */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Your courses</h2>
          {courses.length > 0 && (
            <Link
              href="/dashboard/courses"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          )}
        </div>

        {courses.length === 0 ? (
          <div className="card p-5 text-center">
            <p className="text-sm text-slate-500">No courses yet — add one</p>
            <Link
              href="/dashboard/courses/new"
              className="btn-primary mt-4 inline-flex"
            >
              Add course
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                href="/dashboard/courses"
                className="card flex items-center gap-3 p-4"
              >
                <ColorSwatch color={course.color} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {course.name}
                  </p>
                  {course.term && (
                    <p className="truncate text-xs text-slate-500">
                      {course.term}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
