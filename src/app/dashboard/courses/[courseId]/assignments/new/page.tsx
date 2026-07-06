import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AssignmentForm } from '@/components/assignments/AssignmentForm';
import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { PageHeader } from '@/components/courses/PageHeader';
import { prisma } from '@/lib/prisma';

type NewAssignmentPageProps = {
  params: { courseId: string };
};

export default async function NewAssignmentPage({
  params,
}: NewAssignmentPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const course = await prisma.course.findFirst({
    where: { id: params.courseId, userId: session.user.id },
  });

  if (!course) {
    notFound();
  }

  const listHref = `/dashboard/courses/${course.id}/assignments`;

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
          <ColorSwatch color={course.color} size="sm" />
          {course.name}
        </Link>
        <span>/</span>
        <span className="text-slate-700">New</span>
      </div>

      <PageHeader
        title="New assignment"
        description={`Add an assignment for ${course.name}.`}
      />

      <AssignmentForm
        mode="create"
        courseId={course.id}
        cancelHref={listHref}
        successHref={listHref}
      />
    </div>
  );
}
