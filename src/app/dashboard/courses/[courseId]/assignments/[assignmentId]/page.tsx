import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { StatusBadge } from '@/components/assignments/StatusBadge';
import { TypeBadge } from '@/components/assignments/TypeBadge';
import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { PageHeader } from '@/components/courses/PageHeader';
import { DueDate } from '@/components/DueDate';
import { UpdatedAt } from '@/components/UpdatedAt';
import { prisma } from '@/lib/prisma';

type AssignmentPageProps = {
  params: { courseId: string; assignmentId: string };
};

export default async function AssignmentPage({ params }: AssignmentPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: params.assignmentId,
      courseId: params.courseId,
      course: { userId: session.user.id },
    },
    include: {
      course: true,
      calendarSubscription: { select: { name: true } },
    },
  });

  if (!assignment) {
    notFound();
  }

  const listHref = `/dashboard/courses/${assignment.courseId}/assignments`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard/courses" className="hover:text-brand-600">
          Courses
        </Link>
        <span>/</span>
        <Link
          href={listHref}
          className="flex items-center gap-1.5 hover:text-brand-600"
        >
          <ColorSwatch color={assignment.course.color} size="sm" />
          {assignment.course.name}
        </Link>
        <span>/</span>
        <span className="text-slate-700">Task</span>
      </div>

      <PageHeader
        title={assignment.title}
        description="Task details. Switch to edit only when you want to change what is saved."
        action={{
          label: 'Edit task',
          href: `${listHref}/${assignment.id}/edit`,
        }}
      />

      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <StatusBadge status={assignment.status} />
          <TypeBadge type={assignment.type} />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            <ColorSwatch color={assignment.course.color} size="sm" />
            {assignment.course.name}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            Due <DueDate dueAt={assignment.dueAt} />
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            Added <UpdatedAt updatedAt={assignment.createdAt} />
          </span>
        </div>

        {assignment.calendarSubscription && (
          <p className="text-xs text-slate-500">
            Auto-synced from {assignment.calendarSubscription.name} — the title,
            description and due date follow the calendar feed and are rewritten
            on every sync.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/tasks"
            className="btn-secondary px-4 py-2 text-sm"
          >
            Back to tasks
          </Link>
          <Link href={listHref} className="btn-secondary px-4 py-2 text-sm">
            Course tasks
          </Link>
        </div>
      </section>

      <section className="card flex flex-col gap-2 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Description</h2>
        {assignment.description ? (
          <p className="whitespace-pre-wrap text-sm text-slate-600">
            {assignment.description}
          </p>
        ) : (
          <p className="text-sm text-slate-400">No description yet.</p>
        )}
      </section>
    </div>
  );
}
