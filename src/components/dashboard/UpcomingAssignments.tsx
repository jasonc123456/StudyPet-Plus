import Link from 'next/link';

import { StatusBadge } from '@/components/assignments/StatusBadge';
import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { DueDate } from '@/components/DueDate';
import type { DashboardAssignment } from '@/lib/dashboard';

type UpcomingAssignmentsProps = {
  assignments: DashboardAssignment[];
};

export function UpcomingAssignments({ assignments }: UpcomingAssignmentsProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Upcoming assignments
        </h2>
        {assignments.length > 0 && (
          <Link
            href="/dashboard/assignments"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View all
          </Link>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-8 text-center">
          <span className="text-3xl" aria-hidden>
            📝
          </span>
          <p className="mt-3 text-sm text-slate-500">
            No open assignments. You&apos;re all caught up!
          </p>
          <Link
            href="/dashboard/assignments/new"
            className="btn-primary mt-4 inline-flex text-sm"
          >
            Add assignment
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {assignments.map((assignment) => (
            <Link
              key={assignment.id}
              href={`/dashboard/courses/${assignment.courseId}/assignments/${assignment.id}/edit`}
              className="card flex items-center gap-3 p-4 transition hover:border-brand-200"
            >
              <ColorSwatch color={assignment.course.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">
                  {assignment.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {assignment.course.name} · <DueDate dueAt={assignment.dueAt} />
                </p>
              </div>
              <StatusBadge status={assignment.status} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
