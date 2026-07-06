import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AssignmentForm } from '@/components/planner/AssignmentForm';
import { PageHeader } from '@/components/planner/PageHeader';
import { getOwnedCourse } from '@/lib/planner';

type PageProps = { params: { courseId: string } };

export default async function NewAssignmentPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const course = await getOwnedCourse(params.courseId, session.user.id);
  if (!course) notFound();

  return (
    <div>
      <PageHeader
        title="New assignment"
        description={`Add an assignment to ${course.name}.`}
      />
      <AssignmentForm mode="create" courseId={params.courseId} />
    </div>
  );
}
