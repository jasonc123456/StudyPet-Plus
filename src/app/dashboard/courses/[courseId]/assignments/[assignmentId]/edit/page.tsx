import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AssignmentForm } from '@/components/assignments/AssignmentForm';
import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { PageHeader } from '@/components/courses/PageHeader';
import { prisma } from '@/lib/prisma';

type EditAssignmentPageProps = {
  params: { courseId: string; assignmentId: string };
};

export default async function EditAssignmentPage({
  params,
}: EditAssignmentPageProps) {
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
    include: { course: true },
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
        <span className="text-slate-700">Edit</span>
      </div>

      <PageHeader
        title="Edit assignment"
        description={`Update "${assignment.title}".`}
      />

      <AssignmentForm
        mode="edit"
        courseId={assignment.courseId}
        assignmentId={assignment.id}
        initialValues={{
          title: assignment.title,
          description: assignment.description,
          dueAt: assignment.dueAt,
          status: assignment.status,
          type: assignment.type,
        }}
        cancelHref={listHref}
        successHref={listHref}
      />
    </div>
  );
}
