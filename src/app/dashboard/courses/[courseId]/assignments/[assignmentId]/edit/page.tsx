import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AssignmentForm } from '@/components/planner/AssignmentForm';
import { PageHeader } from '@/components/planner/PageHeader';
import { getOwnedAssignment } from '@/lib/planner';

type PageProps = {
  params: { courseId: string; assignmentId: string };
};

export default async function EditAssignmentPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const assignment = await getOwnedAssignment(
    params.courseId,
    params.assignmentId,
    session.user.id
  );
  if (!assignment) notFound();

  return (
    <div>
      <PageHeader
        title="Edit assignment"
        description={`Update "${assignment.title}".`}
      />
      <AssignmentForm
        mode="edit"
        courseId={params.courseId}
        assignmentId={params.assignmentId}
        defaultValues={{
          title: assignment.title,
          description: assignment.description,
          dueAt: assignment.dueAt,
          status: assignment.status,
          type: assignment.type,
        }}
      />
    </div>
  );
}
