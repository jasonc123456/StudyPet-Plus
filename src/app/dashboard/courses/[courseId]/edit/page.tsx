import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CourseForm } from '@/components/planner/CourseForm';
import { PageHeader } from '@/components/planner/PageHeader';
import { getOwnedCourse } from '@/lib/planner';

type PageProps = { params: { courseId: string } };

export default async function EditCoursePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const course = await getOwnedCourse(params.courseId, session.user.id);
  if (!course) notFound();

  return (
    <div>
      <PageHeader
        title="Edit course"
        description={`Update details for ${course.name}.`}
      />
      <CourseForm
        mode="edit"
        courseId={course.id}
        defaultValues={{
          name: course.name,
          color: course.color,
          term: course.term ?? '',
        }}
      />
    </div>
  );
}
