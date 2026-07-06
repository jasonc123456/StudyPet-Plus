import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CourseCard } from '@/components/courses/CourseCard';
import { EmptyState } from '@/components/courses/EmptyState';
import { PageHeader } from '@/components/courses/PageHeader';
import { prisma } from '@/lib/prisma';

export default async function CoursesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Courses"
        description="Organize your classes and track assignments."
        action={{ label: 'Add course', href: '/dashboard/courses/new' }}
      />

      {courses.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
