import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { NoteForm } from '@/components/notes/NoteForm';
import { prisma } from '@/lib/prisma';

type EditNotePageProps = {
  params: { noteId: string };
};

export default async function EditNotePage({ params }: EditNotePageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [note, courses] = await Promise.all([
    prisma.note.findFirst({
      where: {
        id: params.noteId,
        userId: session.user.id,
      },
    }),
    prisma.course.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
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
    </div>
  );
}
