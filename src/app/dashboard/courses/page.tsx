import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CourseCard } from '@/components/courses/CourseCard';
import { EmptyState } from '@/components/courses/EmptyState';
import { PageHeader } from '@/components/courses/PageHeader';
import { archiveDormantCoursesForUser } from '@/lib/course-archive';
import { prisma } from '@/lib/prisma';

const DUE_SOON_WINDOW_DAYS = 7;

export default async function CoursesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  await archiveDormantCoursesForUser(session.user.id);

  const now = new Date();
  const dueSoonCutoff = new Date(
    now.getTime() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const [courses, dueSoonCount] = await Promise.all([
    prisma.course.findMany({
      where: { userId: session.user.id },
      orderBy: [{ archivedAt: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { assignments: true, notes: true } } },
    }),
    // What the student still has to do this week: unfinished tasks in courses
    // they're actively taking. Overdue work is excluded — the window opens now.
    prisma.assignment.count({
      where: {
        course: { userId: session.user.id, archivedAt: null },
        status: { not: 'done' },
        dueAt: { gte: now, lte: dueSoonCutoff },
      },
    }),
  ]);

  const activeCourses = courses.filter((course) => !course.archivedAt);
  const archivedCourses = courses.filter((course) => course.archivedAt);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Courses"
        description="Organize active classes, tuck away quiet courses, and keep task history close."
        action={{ label: 'Add course', href: '/dashboard/courses/new' }}
      />

      {courses.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Active
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {activeCourses.length}
              </p>
            </div>
            <Link
              href="/dashboard/tasks"
              className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Due soon
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {dueSoonCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 group-hover:text-brand-600">
                {dueSoonCount === 1 ? 'task' : 'tasks'} due in the next 7 days
              </p>
            </Link>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Archived
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {archivedCourses.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                auto-archived after 3 quiet months
              </p>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Active courses
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Courses with recent or upcoming tasks stay in your main
                workspace.
              </p>
            </div>

            {activeCourses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
                No active courses right now. Add a course or restore one from
                the archive.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {activeCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </section>

          {archivedCourses.length > 0 && (
            <section className="flex flex-col gap-4 border-t border-slate-200 pt-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Archived courses
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Restoring a course brings it back to active lists immediately.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {archivedCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
