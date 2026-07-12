import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { FlashcardsPageClient } from '@/components/flashcards/FlashcardsPageClient';
import type { FlashcardSetData } from '@/components/flashcards/FlashcardSetCard';
import { prisma } from '@/lib/prisma';

function isMissingFlashcardTable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021' &&
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
  let notes: { id: string; title: string }[] = [];
  let schemaError: string | null = null;

  try {
    const [notesWithCards, allNotes] = await Promise.all([
      prisma.note.findMany({
        where: {
          userId,
          flashcards: { some: {} },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          course: { select: { id: true, name: true, color: true } },
          flashcards: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              topic: true,
              front: true,
              back: true,
            },
          },
        },
      }),
      prisma.note.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true },
      }),
    ]);

    notes = allNotes;
    sets = notesWithCards.map((note) => {
      const topics = Array.from(
        new Set(note.flashcards.map((card) => card.topic))
      );
      return {
        id: note.id,
        title: note.title,
        course: note.course,
        cards: note.flashcards,
        topics,
      };
    });
  } catch (error) {
    if (isMissingFlashcardTable(error)) {
      schemaError =
        'The Flashcard table is missing from the database. A pending Prisma migration needs to be applied on this environment (`npx prisma migrate deploy` with DATABASE_URL set).';
      console.error('Flashcards page schema mismatch (P2021):', error);
    } else {
      throw error;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Flashcards"
        description="Paste notes or use a saved note to generate topic-tagged cards, then study with flip mode."
        action={{ label: 'Go to notes', href: '/dashboard/notes' }}
      />

      {schemaError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950"
        >
          <p className="font-semibold">Database schema out of date</p>
          <p className="mt-1">{schemaError}</p>
          <p className="mt-2 text-amber-900/80">
            After migrate deploy succeeds, reload this page. Do not use{' '}
            <code className="rounded bg-amber-100 px-1">prisma db push</code> on
            the shared database.
          </p>
        </div>
      ) : (
        <FlashcardsPageClient sets={sets} notes={notes} />
      )}
    </div>
  );
}
