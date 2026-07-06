import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AssignmentRow } from '@/components/planner/AssignmentRow';
import { ColorSwatch } from '@/components/planner/ColorSwatch';
import { EmptyState, PageHeader } from '@/components/planner/PageHeader';
import { getOwnedCourse } from '@/lib/planner';
import { prisma } from '@/lib/prisma';

type PageProps = { params: { courseId: string } };

export default async function CourseAssignmentsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const course = await getOwnedCourse(params.courseId, session.user.id);
  if (!course) notFound();

  const assignments = await prisma.assignment.findMany({
    where: { courseId: params.courseId },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
  });

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/dashboard/courses"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          ← Back to courses
        </Link>
      </div>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <ColorSwatch color={course.color} size="lg" />
            {course.name}
          </span>
        }
        description={
          course.term
            ? `${course.term} · ${assignments.length} assignment${assignments.length === 1 ? '' : 's'}`
            : `${assignments.length} assignment${assignments.length === 1 ? '' : 's'}`
        }
        action={
          <Link
            href={`/dashboard/courses/${params.courseId}/assignments/new`}
            className="btn-primary"
          >
            Add assignment
          </Link>
        }
      />

      {assignments.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="Add your first assignment for this course."
          actionHref={`/dashboard/courses/${params.courseId}/assignments/new`}
          actionLabel="Add assignment"
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="hidden px-4 py-3 sm:table-cell">Course</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Type</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <AssignmentRow
                  key={a.id}
                  courseId={params.courseId}
                  assignment={a}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
