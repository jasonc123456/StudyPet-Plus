import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import type { FlashcardNoteOption } from '@/components/flashcards/CreateFlashcardsPanel';
import { FlashcardsPageClient } from '@/components/flashcards/FlashcardsPageClient';
import type { FlashcardSetData } from '@/components/flashcards/FlashcardSetCard';
import { hasVisibleRichText } from '@/lib/note-rich-text';
import { prisma } from '@/lib/prisma';

function isMissingFlashcardTable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022') &&
    typeof error.message === 'string' &&
    error.message.includes('Flashcard')
  );
}

export default async function DashboardFlashcardsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  let sets: FlashcardSetData[] = [];
  let notes: FlashcardNoteOption[] = [];
  let streak = 0;
  let totalCards = 0;
  let schemaError: string | null = null;

  try {
    const [setRows, noteRows, pet] = await Promise.all([
      prisma.flashcardSet.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          course: { select: { id: true, name: true, color: true } },
          sourceNotes: {
            select: { note: { select: { id: true, title: true } } },
          },
          cards: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { id: true, topic: true, front: true, back: true },
          },
        },
      }),
      prisma.note.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          content: true,
          course: { select: { id: true, name: true, color: true } },
        },
      }),
      prisma.pet.findUnique({
        where: { userId },
        select: { streakCount: true },
      }),
    ]);

    sets = setRows.map((set) => ({
      id: set.id,
      title: set.title,
      course: set.course,
      cards: set.cards,
      topics: Array.from(new Set(set.cards.map((card) => card.topic))),
      sourceNotes: set.sourceNotes.map((row) => row.note),
    }));
    totalCards = sets.reduce((sum, set) => sum + set.cards.length, 0);

    notes = noteRows.map((note) => ({
      id: note.id,
      title: note.title,
      hasContent: hasVisibleRichText(note.content),
      course: note.course,
    }));

    streak = pet?.streakCount ?? 0;
  } catch (error) {
    if (isMissingFlashcardTable(error)) {
      schemaError =
        'The Flashcard tables are missing from the database. A pending Prisma migration needs to be applied on this environment (`npx prisma migrate deploy` with DATABASE_URL set).';
      console.error('Flashcards page schema mismatch (P2021):', error);
    } else {
      throw error;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Flashcards"
        description="Build decks from one or more notes, then study with flip mode and your own settings."
        action={{ label: 'Go to notes', href: '/dashboard/notes' }}
      />

      {schemaError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950"
        >
          <p className="font-semibold">Database schema out of date</p>
          <p className="mt-1">{schemaError}</p>
        </div>
      ) : (
        <FlashcardsPageClient
          sets={sets}
          notes={notes}
          streak={streak}
          totalCards={totalCards}
        />
      )}
    </div>
  );
}
