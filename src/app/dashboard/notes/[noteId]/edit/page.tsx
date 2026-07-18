import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { GenerateFlashcardsButton } from '@/components/notes/GenerateFlashcardsButton';
import { NoteForm } from '@/components/notes/NoteForm';
import { listFlashcardsForNote } from '@/lib/flashcards';
import { hasVisibleRichText } from '@/lib/note-rich-text';
import { prisma } from '@/lib/prisma';

type EditNotePageProps = {
  params: { noteId: string };
};

export default async function EditNotePage({ params }: EditNotePageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [note, courses, flashcards] = await Promise.all([
    prisma.note.findFirst({
      where: {
        id: params.noteId,
        userId: session.user.id,
      },
    }),
    prisma.course.findMany({
      where: { userId: session.user.id, archivedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    listFlashcardsForNote(params.noteId, session.user.id),
  ]);

  if (!note) {
    notFound();
  }

  const listHref = note.courseId
    ? `/dashboard/notes?courseId=${note.courseId}`
    : '/dashboard/notes';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard/notes" className="hover:text-brand-600">
          Notes
        </Link>
        <span>/</span>
        <span className="text-slate-700">Edit</span>
      </div>

      <PageHeader title="Edit note" description={`Update "${note.title}".`} />

      <NoteForm
        mode="edit"
        noteId={note.id}
        courses={courses}
        initialValues={{
          title: note.title,
          content: note.content,
          courseId: note.courseId,
          pdfName: note.pdfName,
          pdfUrl: note.pdfUrl,
        }}
        cancelHref={listHref}
        successHref={listHref}
      />

      <GenerateFlashcardsButton
        noteId={note.id}
        hasContent={hasVisibleRichText(note.content)}
        initialFlashcards={flashcards.map((card) => ({
          id: card.id,
          topic: card.topic,
          front: card.front,
          back: card.back,
        }))}
      />
    </div>
  );
}
