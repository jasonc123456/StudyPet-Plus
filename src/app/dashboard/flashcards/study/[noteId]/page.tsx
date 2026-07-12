import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { FlashcardStudySession } from '@/components/flashcards/FlashcardStudySession';
import { getOwnedNote } from '@/lib/planner';
import { prisma } from '@/lib/prisma';

type StudyPageProps = {
  params: { noteId: string };
};

export default async function FlashcardStudyPage({ params }: StudyPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const note = await getOwnedNote(params.noteId, session.user.id);
  if (!note) {
    notFound();
  }

  const cards = await prisma.flashcard.findMany({
    where: { noteId: note.id, userId: session.user.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      topic: true,
      front: true,
      back: true,
    },
  });

  if (cards.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/flashcards"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          ← Back to flashcards
        </Link>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            No cards in this set
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Generate or add cards for “{note.title}” before studying.
          </p>
          <Link
            href="/dashboard/flashcards"
            className="btn-primary mt-4 inline-flex"
          >
            Back to flashcards
          </Link>
        </div>
      </div>
    );
  }

  return <FlashcardStudySession noteTitle={note.title} cards={cards} />;
}
