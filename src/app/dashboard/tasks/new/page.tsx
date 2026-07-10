import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AssignmentForm } from '@/components/assignments/AssignmentForm';
import { PageHeader } from '@/components/courses/PageHeader';
import { prisma } from '@/lib/prisma';

export default async function NewGlobalTaskPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  if (courses.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="New task"
          description="Create a task for one of your courses."
        />
        <div className="card p-6 text-center text-sm text-slate-500">
          You need at least one course before adding tasks.{' '}
          <a
            href="/dashboard/courses/new"
            className="text-brand-600 hover:underline"
          >
            Create a course
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New task"
        description="Create a task and assign it to a course."
      />

      <AssignmentForm
        mode="create"
        courses={courses}
        cancelHref="/dashboard/tasks"
        successHref="/dashboard/tasks"
      />
    </div>
  );
}
