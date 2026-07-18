import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { FlashcardStudySession } from '@/components/flashcards/FlashcardStudySession';
import { prisma } from '@/lib/prisma';

type StudyPageProps = {
  params: { setId: string };
};

export default async function FlashcardStudyPage({ params }: StudyPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const deck = await prisma.flashcardSet.findFirst({
    where: { id: params.setId, userId: session.user.id },
    select: {
      title: true,
      cards: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, topic: true, front: true, back: true },
      },
    },
  });

  if (!deck) {
    notFound();
  }

  if (deck.cards.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/flashcards"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          ← Back to flashcards
        </Link>
        <div className="card px-6 py-10 text-center">
          <p className="font-medium">No cards in this deck</p>
          <p className="theme-muted mt-1 text-sm">
            Add cards to “{deck.title}” before studying.
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

  return <FlashcardStudySession deckTitle={deck.title} cards={deck.cards} />;
}
