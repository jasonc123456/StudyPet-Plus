import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { prisma } from '@/lib/prisma';

type NoteWithCardCount = {
  id: string;
  title: string;
  course: { id: string; name: string; color: string } | null;
  _count: { flashcards: number };
};

type RecentFlashcard = {
  id: string;
  topic: string;
  front: string;
  back: string;
  note: { id: string; title: string };
};

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

  let notesWithCards: NoteWithCardCount[] = [];
  let recentCards: RecentFlashcard[] = [];
  let schemaError: string | null = null;

  try {
    // Keep these queries as-is; do not remove or rewrite them.
    [notesWithCards, recentCards] = await Promise.all([
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
          _count: { select: { flashcards: true } },
        },
      }),
      prisma.flashcard.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 24,
        select: {
          id: true,
          topic: true,
          front: true,
          back: true,
          note: { select: { id: true, title: true } },
        },
      }),
    ]);
  } catch (error) {
    if (isMissingFlashcardTable(error)) {
      // Temporary ops signal — not a permanent substitute for migrate deploy.
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
        description="Review AI-generated cards from your notes. Open a note to generate more."
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
      ) : notesWithCards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            No flashcards yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Open a note and use &quot;Generate flashcards&quot; to create your
            first set.
          </p>
          <Link
            href="/dashboard/notes"
            className="btn-primary mt-4 inline-flex"
          >
            Browse notes
          </Link>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Notes with cards
            </h2>
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {notesWithCards.map((note) => (
                <li key={note.id}>
                  <Link
                    href={`/dashboard/notes/${note.id}/edit`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {note.title}
                      </p>
                      {note.course && (
                        <p className="text-xs text-slate-500">
                          {note.course.name}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {note._count.flashcards} card
                      {note._count.flashcards === 1 ? '' : 's'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Recent cards
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentCards.map((card) => (
                <li
                  key={card.id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {card.topic}
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {card.front}
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm text-slate-600">
                    {card.back}
                  </p>
                  <Link
                    href={`/dashboard/notes/${card.note.id}/edit`}
                    className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline"
                  >
                    From: {card.note.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
