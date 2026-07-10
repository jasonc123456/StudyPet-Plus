import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { NoteForm } from '@/components/notes/NoteForm';
import { getOwnedCourse } from '@/lib/planner';
import { prisma } from '@/lib/prisma';

type NewNotePageProps = {
  searchParams: {
    courseId?: string;
  };
};

export default async function NewNotePage({ searchParams }: NewNotePageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  let initialCourseId: string | null = null;
  if (searchParams.courseId) {
    const course = await getOwnedCourse(searchParams.courseId, session.user.id);
    if (course) {
      initialCourseId = course.id;
    }
  }

  const cancelHref = initialCourseId
    ? `/dashboard/notes?courseId=${initialCourseId}`
    : '/dashboard/notes';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New note"
        description="Save study material for later review and AI generation."
      />

      <NoteForm
        mode="create"
        courses={courses}
        initialCourseId={initialCourseId}
        cancelHref={cancelHref}
        successHref={cancelHref}
      />
    </div>
  );
}
