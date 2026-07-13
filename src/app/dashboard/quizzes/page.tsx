import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { QuizzesPageClient } from '@/components/quizzes/QuizzesPageClient';
import type { QuizNoteOption } from '@/components/quizzes/types';
import { prisma } from '@/lib/prisma';

function isMissingQuizTable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021' &&
    typeof error.message === 'string' &&
    (error.message.includes('Quiz') || error.message.includes('QuizQuestion'))
  );
}

export default async function DashboardQuizzesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  let notes: QuizNoteOption[] = [];
  let schemaError: string | null = null;

  try {
    const rows = await prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        course: { select: { id: true, name: true, color: true } },
        quizzes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            questions: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                topic: true,
                question: true,
                choices: true,
                correctIndex: true,
                explanation: true,
              },
            },
          },
        },
      },
    });

    notes = rows.map((note) => {
      const latestQuiz = note.quizzes[0] ?? null;
      return {
        id: note.id,
        title: note.title,
        hasContent: note.content.trim().length > 0,
        questionCount: latestQuiz?.questions.length ?? 0,
        course: note.course,
        latestQuiz: latestQuiz
          ? {
              id: latestQuiz.id,
              questions: latestQuiz.questions,
            }
          : null,
      };
    });
  } catch (error) {
    if (isMissingQuizTable(error)) {
      schemaError =
        'The Quiz tables are missing from the database. Apply pending Prisma migrations on this environment (`npx prisma migrate deploy` with DATABASE_URL set).';
      console.error('Quizzes page schema mismatch (P2021):', error);
    } else {
      throw error;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quizzes"
        description="Generate multiple-choice quizzes from your notes, then test yourself one question at a time."
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
        <QuizzesPageClient notes={notes} />
      )}
    </div>
  );
}
