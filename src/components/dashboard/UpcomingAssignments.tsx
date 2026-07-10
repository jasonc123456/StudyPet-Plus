import Link from 'next/link';

import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { DueDate } from '@/components/DueDate';
import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { DashboardSectionHeader } from '@/components/dashboard/DashboardSectionHeader';
import { InlineAssignmentStatusBadge } from '@/components/dashboard/InlineAssignmentStatusBadge';
import type { DashboardAssignment } from '@/lib/dashboard';

type UpcomingAssignmentsProps = {
  assignments: DashboardAssignment[];
};

export function UpcomingAssignments({ assignments }: UpcomingAssignmentsProps) {
  return (
    <section>
      <DashboardSectionHeader
        title="Upcoming tasks"
        href={assignments.length > 0 ? '/dashboard/tasks' : undefined}
      />

      {assignments.length === 0 ? (
        <DashboardPanel className="flex flex-col items-center text-center">
          <span className="text-3xl opacity-80" aria-hidden>
            📝
          </span>
          <p className="mt-4 text-sm font-normal text-slate-500">
            No open tasks. You&apos;re all caught up!
          </p>
          <Link
            href="/dashboard/tasks/new"
            className="btn-primary mt-5 inline-flex text-sm"
          >
            Add task
          </Link>
        </DashboardPanel>
      ) : (
        <div className="flex flex-col gap-2.5">
          {assignments.map((assignment) => (
            <Link
              key={assignment.id}
              href={`/dashboard/courses/${assignment.courseId}/assignments/${assignment.id}/edit`}
              className="dashboard-row group flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <ColorSwatch color={assignment.course.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium tracking-tight text-slate-900">
                    {assignment.title}
                  </p>
                  <p className="mt-1 truncate text-xs font-normal text-slate-500">
                    {assignment.course.name} ·{' '}
                    <DueDate dueAt={assignment.dueAt} />
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
                <InlineAssignmentStatusBadge
                  courseId={assignment.courseId}
                  assignmentId={assignment.id}
                  status={assignment.status}
                  title={assignment.title}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
