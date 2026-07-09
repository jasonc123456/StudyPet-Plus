// Protected landing page after a successful magic-link sign-in
// (signIn redirects here with redirectTo: "/dashboard").
//
// Server component: reads the database-backed session via `auth()`. If there's
// no session we bounce to /login, so this route is effectively gated without
// needing separate middleware.

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CalendarTaskChecklist } from '@/components/calendar/CalendarTaskChecklist';
import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { DashboardSectionHeader } from '@/components/dashboard/DashboardSectionHeader';
import { PetSummary } from '@/components/dashboard/PetSummary';
import { PomodoroTimer } from '@/components/dashboard/PomodoroTimer';
import { StudyQuests } from '@/components/dashboard/StudyQuests';
import { UpcomingAssignments } from '@/components/dashboard/UpcomingAssignments';
import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { getDashboardCalendarTasks } from '@/lib/calendar';
import { getDashboardData } from '@/lib/dashboard';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const [
    { courses, stats, upcomingAssignments, openQuests, pet },
    calendarTasks,
  ] = await Promise.all([
    getDashboardData(session.user.id),
    getDashboardCalendarTasks(session.user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
          Planner
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="text-sm font-normal text-slate-500">
          Welcome back, {session.user.email}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardPanel>
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Open quests
          </p>
          <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-brand-600">
            {stats.openQuests}
          </p>
          <Link
            href="/dashboard/quests"
            className="mt-3 inline-block text-xs font-medium text-brand-600 transition hover:text-brand-700"
          >
            View quests
          </Link>
        </DashboardPanel>

        <DashboardPanel>
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Study streak
          </p>
          <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-mint-600">
            {stats.studyStreak}
            <span className="ml-1.5 text-lg font-medium text-slate-500">
              day{stats.studyStreak === 1 ? '' : 's'}
            </span>
          </p>
        </DashboardPanel>

        <DashboardPanel>
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Due this week
          </p>
          <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-brand-600">
            {stats.dueThisWeek}
          </p>
          <Link
            href="/dashboard/assignments"
            className="mt-3 inline-block text-xs font-medium text-brand-600 transition hover:text-brand-700"
          >
            View assignments
          </Link>
        </DashboardPanel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <UpcomingAssignments assignments={upcomingAssignments} />
          <StudyQuests quests={openQuests} />
        </div>
        <div className="flex flex-col gap-8 lg:sticky lg:top-8 lg:self-start">
          <PetSummary pet={pet} />
          <PomodoroTimer />
        </div>
      </div>

      <StudyQuests quests={openQuests} />

      <section>
        <DashboardSectionHeader
          title="Your courses"
          href={courses.length > 0 ? '/dashboard/courses' : undefined}
        />

        {courses.length === 0 ? (
          <DashboardPanel className="flex flex-col items-center text-center">
            <p className="text-sm font-normal text-slate-500">
              No courses yet — add one
            </p>
            <Link
              href="/dashboard/courses/new"
              className="btn-primary mt-5 inline-flex text-sm"
            >
              Add course
            </Link>
          </DashboardPanel>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                href="/dashboard/courses"
                className="dashboard-row flex items-center gap-3.5 p-4 sm:p-5"
              >
                <ColorSwatch color={course.color} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium tracking-tight text-slate-900">
                    {course.name}
                  </p>
                  {course.term && (
                    <p className="mt-1 truncate text-xs font-normal text-slate-500">
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
