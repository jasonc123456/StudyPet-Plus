import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AssignmentEmptyState } from '@/components/assignments/AssignmentEmptyState';
import { AssignmentFilters } from '@/components/assignments/AssignmentFilters';
import {
  AssignmentMobileCard,
  AssignmentRow,
} from '@/components/assignments/AssignmentRow';
import { PageHeader } from '@/components/courses/PageHeader';
import { ResponsiveDataTable } from '@/components/ResponsiveDataTable';
import { prisma } from '@/lib/prisma';

type AssignmentsPageProps = {
  searchParams: {
    status?: string;
    type?: string;
    courseId?: string;
  };
};

export default async function AssignmentsPage({
  searchParams,
}: AssignmentsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  const assignments = await prisma.assignment.findMany({
    where: {
      course: { userId: session.user.id },
      ...(searchParams.status && { status: searchParams.status }),
      ...(searchParams.type && { type: searchParams.type }),
      ...(searchParams.courseId && { courseId: searchParams.courseId }),
    },
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  });

  const hasFilters =
    searchParams.status || searchParams.type || searchParams.courseId;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Assignments"
        description="All assignments across your courses."
        action={{ label: 'Add assignment', href: '/dashboard/assignments/new' }}
      />

      <Suspense fallback={null}>
        <AssignmentFilters courses={courses} />
      </Suspense>

      {assignments.length === 0 ? (
        <AssignmentEmptyState
          message={
            hasFilters
              ? 'No assignments match your filters.'
              : 'No assignments yet. Add one to start tracking deadlines.'
          }
          actionHref="/dashboard/assignments/new"
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {assignments.map((assignment) => (
              <AssignmentMobileCard
                key={assignment.id}
                assignment={{
                  ...assignment,
                  course: assignment.course,
                }}
                showCourse
              />
            ))}
          </div>

          <div className="card hidden overflow-hidden md:block">
            <ResponsiveDataTable>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <AssignmentRow
                      key={assignment.id}
                      assignment={{
                        ...assignment,
                        course: assignment.course,
                      }}
                      showCourse
                    />
                  ))}
                </tbody>
              </table>
            </ResponsiveDataTable>
          </div>
        </>
      )}
    </div>
  );
}
