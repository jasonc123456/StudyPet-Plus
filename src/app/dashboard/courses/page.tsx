import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CourseCard } from '@/components/planner/CourseCard';
import { EmptyState, PageHeader } from '@/components/planner/PageHeader';
import { prisma } from '@/lib/prisma';

export default async function CoursesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Manage your classes and jump into assignments."
        action={
          <Link href="/dashboard/courses/new" className="btn-primary">
            Create New
          </Link>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Create your first course to start tracking assignments."
          actionHref="/dashboard/courses/new"
          actionLabel="Create course"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              id={course.id}
              name={course.name}
              color={course.color}
              term={course.term}
              assignmentCount={course._count.assignments}
            />
          ))}
        </div>
      )}
    </div>
  );
}
