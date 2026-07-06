import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CourseForm } from '@/components/planner/CourseForm';
import { PageHeader } from '@/components/planner/PageHeader';

export default async function NewCoursePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return (
    <div>
      <PageHeader
        title="New course"
        description="Add a class to your planner."
      />
      <CourseForm mode="create" />
    </div>
  );
}
