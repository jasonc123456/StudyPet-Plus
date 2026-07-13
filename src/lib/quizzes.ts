// Quiz generation + persistence (US-3.4).
//
// Loads a Note the caller owns, asks the AI layer for multiple-choice questions,
// then persists a Quiz batch with child QuizQuestion rows.

import { generateQuiz } from '@/lib/ai';
import { quizResponseSchema, type AiProviderName } from '@/lib/ai/types';
import { getOwnedNote } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import type { Quiz, QuizQuestion } from '@prisma/client';

export class QuizServiceError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'EMPTY_CONTENT',
    message: string
  ) {
    super(message);
    this.name = 'QuizServiceError';
  }
}

export type QuizWithQuestions = Quiz & { questions: QuizQuestion[] };

export type GenerateAndSaveQuizInput = {
  noteId: string;
  userId: string;
  count?: number;
  /** When true, remove prior AI-generated quiz batches for this note. */
  replaceGenerated?: boolean;
};

export type GenerateAndSaveQuizResult = {
  quiz: QuizWithQuestions;
  generatedCount: number;
  provider: AiProviderName;
};

async function deleteQuizzesForNote(
  noteId: string,
  userId: string
): Promise<number> {
  const result = await prisma.quiz.deleteMany({
    where: { noteId, userId },
  });
  return result.count;
}

function questionKey(question: string, choices: string[]): string {
  const normalizedChoices = choices
    .map((choice) => choice.trim().toLowerCase())
    .join('||');
  return `${question.trim().toLowerCase()}::${normalizedChoices}`;
}

/**
 * Generate a quiz from a note's content and persist it.
 * Throws QuizServiceError for ownership / empty-content failures;
 * rethrows AiProviderError (and other errors) for the route to map.
 */
export async function generateAndSaveQuiz(
  input: GenerateAndSaveQuizInput
): Promise<GenerateAndSaveQuizResult> {
  const note = await getOwnedNote(input.noteId, input.userId);
  if (!note) {
    throw new QuizServiceError('NOT_FOUND', 'Note not found');
  }

  if (!note.content.trim()) {
    throw new QuizServiceError(
      'EMPTY_CONTENT',
      'Note has no content to generate a quiz from'
    );
  }

  let topicHint: string | undefined;
  if (note.courseId) {
    const course = await prisma.course.findFirst({
      where: { id: note.courseId, userId: input.userId },
      select: { name: true },
    });
    topicHint = course?.name;
  }

  const { items, provider } = await generateQuiz({
    sourceText: note.content,
    count: input.count,
    topicHint,
  });

  if (provider === 'demo' && process.env['AI_DEMO_MODE'] !== 'true') {
    throw new Error('Refusing to persist demo quiz while AI mode is on');
  }

  const parsed = quizResponseSchema.safeParse({ questions: items });
  if (!parsed.success) {
    throw new Error('AI returned quiz questions that failed schema validation');
  }

  let questions = parsed.data.questions;

  if (input.replaceGenerated) {
    await deleteQuizzesForNote(note.id, input.userId);
  }

  const existing = await prisma.quizQuestion.findMany({
    where: { userId: input.userId, quiz: { noteId: note.id } },
    select: { question: true, choices: true },
  });
  const existingKeys = new Set(
    existing.map((row) => questionKey(row.question, row.choices))
  );
  questions = questions.filter(
    (q) => !existingKeys.has(questionKey(q.question, q.choices))
  );

  if (questions.length === 0) {
    const latest = await prisma.quiz.findFirst({
      where: { noteId: note.id, userId: input.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        questions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });

    if (!latest) {
      throw new QuizServiceError(
        'EMPTY_CONTENT',
        'No new quiz questions could be generated from this note'
      );
    }

    return { quiz: latest, generatedCount: 0, provider };
  }

  const quiz = await prisma.quiz.create({
    data: {
      userId: input.userId,
      noteId: note.id,
      courseId: note.courseId,
      questions: {
        create: questions.map((q) => ({
          userId: input.userId,
          topic: q.topic,
          question: q.question,
          choices: q.choices,
          correctIndex: q.answerIndex,
          explanation: q.explanation ?? null,
        })),
      },
    },
    include: {
      questions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  });

  return { quiz, generatedCount: questions.length, provider };
}

/** Latest quiz for a note owned by the user, with questions. */
export async function getLatestQuizForNote(
  noteId: string,
  userId: string
): Promise<QuizWithQuestions | null> {
  const note = await getOwnedNote(noteId, userId);
  if (!note) {
    return null;
  }

  return prisma.quiz.findFirst({
    where: { noteId, userId },
    orderBy: { createdAt: 'desc' },
    include: {
      questions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  });
}
