import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CourseForm } from '@/components/courses/CourseForm';
import { PageHeader } from '@/components/courses/PageHeader';

export default async function NewCoursePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New course"
        description="Add a class to your planner."
      />
      <CourseForm mode="create" />
    </div>
  );
}
