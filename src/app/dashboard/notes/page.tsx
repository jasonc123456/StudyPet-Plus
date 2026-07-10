import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { NoteEmptyState } from '@/components/notes/NoteEmptyState';
import { NoteFilters } from '@/components/notes/NoteFilters';
import { NoteRow } from '@/components/notes/NoteRow';
import {
  buildNoteListWhere,
  hasNoteListFilters,
  noteListOrderBy,
  parseNoteSort,
} from '@/lib/notes-query';
import { prisma } from '@/lib/prisma';

type NotesPageProps = {
  searchParams: {
    courseId?: string;
    q?: string;
    sort?: string;
  };
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  const listParams = {
    courseId: searchParams.courseId,
    q: searchParams.q,
  };
  const sort = parseNoteSort(searchParams.sort);
  const where = buildNoteListWhere(userId, listParams);

  const [courses, totalNoteCount, notes] = await Promise.all([
    prisma.course.findMany({
      where: { userId, archivedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.note.count({ where: { userId } }),
    prisma.note.findMany({
      where,
      include: {
        course: { select: { id: true, name: true, color: true } },
      },
      orderBy: noteListOrderBy(sort),
    }),
  ]);

  const courseFilter = searchParams.courseId;
  const newNoteHref =
    courseFilter && courseFilter !== 'none'
      ? `/dashboard/notes/new?courseId=${courseFilter}`
      : '/dashboard/notes/new';

  const activeFilters = hasNoteListFilters(listParams);
  const emptyMessage =
    totalNoteCount === 0
      ? 'No notes yet.'
      : activeFilters
        ? 'No matching notes found.'
        : 'No notes yet.';

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

      {notes.length > 0 && (
        <p className="text-sm text-slate-500">
          {notes.length} note{notes.length === 1 ? '' : 's'}
          {activeFilters ? ' matching your filters' : ''}
        </p>
      )}

      {notes.length === 0 ? (
        <NoteEmptyState
          message={emptyMessage}
          actionHref={newNoteHref}
          showAction={totalNoteCount === 0 || !activeFilters}
          clearFiltersHref={activeFilters ? '/dashboard/notes' : undefined}
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
