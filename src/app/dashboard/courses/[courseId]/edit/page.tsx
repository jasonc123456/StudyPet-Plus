import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CourseForm } from '@/components/courses/CourseForm';
import { PageHeader } from '@/components/courses/PageHeader';
import { prisma } from '@/lib/prisma';

type EditCoursePageProps = {
  params: { courseId: string };
};

export default async function EditCoursePage({ params }: EditCoursePageProps) {
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit course"
        description={`Update details for ${course.name}.`}
      />
      <CourseForm
        mode="edit"
        courseId={course.id}
        initialValues={{
          name: course.name,
          color: course.color,
          term: course.term,
        }}
      />
    </div>
  );
}
