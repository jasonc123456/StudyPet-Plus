import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AssignmentEmptyState } from '@/components/assignments/AssignmentEmptyState';
import { AssignmentRow } from '@/components/assignments/AssignmentRow';
import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { PageHeader } from '@/components/courses/PageHeader';
import { prisma } from '@/lib/prisma';

type CourseAssignmentsPageProps = {
  params: { courseId: string };
};

export default async function CourseAssignmentsPage({
  params,
}: CourseAssignmentsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const course = await prisma.course.findFirst({
    where: { id: params.courseId, userId: session.user.id },
    include: {
      assignments: {
        orderBy: [
          { dueAt: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
      },
    },
  });

  if (!course) {
    notFound();
  }

  const baseHref = `/dashboard/courses/${course.id}/assignments`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard/courses" className="hover:text-brand-600">
          Courses
        </Link>
        <span>/</span>
        <span className="flex items-center gap-1.5 text-slate-700">
          <ColorSwatch color={course.color} size="sm" />
          {course.name}
        </span>
      </div>

      <PageHeader
        title="Assignments"
        description={`Track work for ${course.name}.`}
        action={{ label: 'Add assignment', href: `${baseHref}/new` }}
      />

      {course.assignments.length === 0 ? (
        <AssignmentEmptyState actionHref={`${baseHref}/new`} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {course.assignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  assignment={{ ...assignment, courseId: course.id }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
