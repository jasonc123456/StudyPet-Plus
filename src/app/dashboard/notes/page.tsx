import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { NoteEmptyState } from '@/components/notes/NoteEmptyState';
import { NoteFilters } from '@/components/notes/NoteFilters';
import { NoteRow } from '@/components/notes/NoteRow';
import { prisma } from '@/lib/prisma';

type NotesPageProps = {
  searchParams: {
    courseId?: string;
  };
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  const courseFilter = searchParams.courseId;
  const hasFilters = Boolean(courseFilter);

  const notes = await prisma.note.findMany({
    where: {
      userId: session.user.id,
      ...(courseFilter === 'none'
        ? { courseId: null }
        : courseFilter
          ? { courseId: courseFilter }
          : {}),
    },
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const newNoteHref =
    courseFilter && courseFilter !== 'none'
      ? `/dashboard/notes/new?courseId=${courseFilter}`
      : '/dashboard/notes/new';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notes"
        description="Capture study notes to use for flashcards and quizzes later."
        action={{ label: 'Add note', href: newNoteHref }}
      />

      <Suspense fallback={null}>
        <NoteFilters courses={courses} />
      </Suspense>

      {notes.length === 0 ? (
        <NoteEmptyState
          message={
            hasFilters ? 'No notes match your filters.' : 'No notes yet.'
          }
          actionHref={newNoteHref}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
