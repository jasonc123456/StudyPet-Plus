import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { NoteStudyView } from '@/components/notes/NoteStudyView';
import { UpdatedAt } from '@/components/UpdatedAt';
import { wordCount } from '@/lib/format';
import { prisma } from '@/lib/prisma';

type NoteStudyPageProps = {
  params: { noteId: string };
};

export default async function NoteStudyPage({ params }: NoteStudyPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const note = await prisma.note.findFirst({
    where: {
      id: params.noteId,
      userId: session.user.id,
    },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  });

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
        <span className="text-slate-700">Study</span>
      </div>

      <PageHeader
        title={note.title}
        description="Read and review this note in study mode, then switch to edit only when you want to change the saved content."
        action={{
          label: 'Edit note',
          href: `/dashboard/notes/${note.id}/edit`,
        }}
      />

      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          {note.course ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              <ColorSwatch color={note.course.color} size="sm" />
              {note.course.name}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Uncategorized
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            {wordCount(note.content)} word
            {wordCount(note.content) === 1 ? '' : 's'}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            Updated <UpdatedAt updatedAt={note.updatedAt} />
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={listHref} className="btn-secondary px-4 py-2 text-sm">
            Back to notes
          </Link>
          {note.pdfUrl && note.pdfName ? (
            <a
              href={note.pdfUrl}
              rel="noreferrer"
              className="btn-secondary px-4 py-2 text-sm"
            >
              Open attached PDF
            </a>
          ) : null}
        </div>
      </section>

      <NoteStudyView noteId={note.id} content={note.content} />
    </div>
  );
}
