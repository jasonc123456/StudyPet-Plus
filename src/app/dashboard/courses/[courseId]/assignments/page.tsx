import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AssignmentEmptyState } from '@/components/assignments/AssignmentEmptyState';
import {
  AssignmentMobileCard,
  AssignmentRow,
} from '@/components/assignments/AssignmentRow';
import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { PageHeader } from '@/components/courses/PageHeader';
import { NoteEmptyState } from '@/components/notes/NoteEmptyState';
import { NoteRow } from '@/components/notes/NoteRow';
import { ResponsiveDataTable } from '@/components/ResponsiveDataTable';
import { sortDoneLast } from '@/lib/assignment-status';
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
      notes: {
        orderBy: { updatedAt: 'desc' },
        include: {
          course: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  if (!course) {
    notFound();
  }

  const assignments = sortDoneLast(course.assignments);

  const baseHref = `/dashboard/courses/${course.id}/assignments`;
  const notesHref = `/dashboard/notes?courseId=${course.id}`;
  const newNoteHref = `/dashboard/notes/new?courseId=${course.id}`;

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
        title="Tasks"
        description={`Track work for ${course.name}.`}
        action={{ label: 'Add task', href: `${baseHref}/new` }}
      />

      {course.assignments.length === 0 ? (
        <AssignmentEmptyState actionHref={`${baseHref}/new`} />
      ) : (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {assignments.map((assignment) => (
              <AssignmentMobileCard
                key={assignment.id}
                assignment={{ ...assignment, courseId: course.id }}
              />
            ))}
          </div>

          <div className="card hidden overflow-hidden md:block">
            <ResponsiveDataTable>
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
                  {assignments.map((assignment) => (
                    <AssignmentRow
                      key={assignment.id}
                      assignment={{ ...assignment, courseId: course.id }}
                    />
                  ))}
                </tbody>
              </table>
            </ResponsiveDataTable>
          </div>
        </>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
          {course.notes.length > 0 && (
            <Link
              href={notesHref}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          )}
        </div>

        {course.notes.length === 0 ? (
          <NoteEmptyState
            message={`No notes for ${course.name} yet.`}
            actionHref={newNoteHref}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {course.notes.map((note) => (
              <NoteRow key={note.id} note={note} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
