// Quiz generation + persistence (US-3.4).
//
// Loads a Note the caller owns, asks the AI layer for multiple-choice questions,
// then persists a Quiz batch with child QuizQuestion rows.

import { generateQuiz } from '@/lib/ai';
import {
  quizResponseSchema,
  type AiProgressCallback,
  type AiProviderName,
} from '@/lib/ai/types';
import { hasVisibleRichText, richTextToPlainText } from '@/lib/note-rich-text';
import { recordStudyActivity, utcDayKey, xpForQuizScore } from '@/lib/pet-xp';
import { getOwnedNote } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import type {
  Quiz,
  QuizAttempt,
  QuizQuestion,
  QuizQuestionResult,
} from '@prisma/client';

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

export type QuizAttemptWithResults = QuizAttempt & {
  questionResults: Array<
    QuizQuestionResult & {
      question: Pick<
        QuizQuestion,
        'id' | 'topic' | 'question' | 'correctIndex'
      >;
    }
  >;
};

export type GenerateAndSaveQuizInput = {
  noteId: string;
  userId: string;
  count?: number;
  /** When true, remove prior AI-generated quiz batches for this note. */
  replaceGenerated?: boolean;
  /** Optional live progress callback forwarded to the AI layer. */
  onProgress?: AiProgressCallback;
};

export type GenerateAndSaveQuizResult = {
  quiz: QuizWithQuestions;
  generatedCount: number;
  provider: AiProviderName;
};

export type SubmitQuizAttemptInput = {
  userId: string;
  quizId: string;
  answers: Array<{
    questionId: string;
    selectedIndex: number;
  }>;
};

export type SubmitQuizAttemptResult = {
  attempt: QuizAttemptWithResults;
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  xpAwarded: number;
  weakTopic: string | null;
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

  const sourceText = richTextToPlainText(note.content);

  if (!hasVisibleRichText(note.content)) {
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
    sourceText,
    count: input.count,
    topicHint,
    onProgress: input.onProgress,
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

export async function submitQuizAttempt(
  input: SubmitQuizAttemptInput
): Promise<SubmitQuizAttemptResult> {
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: input.quizId,
      userId: input.userId,
    },
    include: {
      questions: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!quiz) {
    throw new QuizServiceError('NOT_FOUND', 'Quiz not found');
  }

  const questionMap = new Map(
    quiz.questions.map((question) => [question.id, question])
  );
  const normalizedAnswers = input.answers.filter((answer) =>
    questionMap.has(answer.questionId)
  );

  if (normalizedAnswers.length !== quiz.questions.length) {
    throw new QuizServiceError(
      'EMPTY_CONTENT',
      'Submit one answer for each quiz question'
    );
  }

  const answerByQuestionId = new Map(
    normalizedAnswers.map((answer) => [answer.questionId, answer.selectedIndex])
  );

  const resultRows = quiz.questions.map((question) => {
    const selectedIndex = answerByQuestionId.get(question.id);
    if (selectedIndex === undefined) {
      throw new QuizServiceError(
        'EMPTY_CONTENT',
        'Submit one answer for each quiz question'
      );
    }

    return {
      questionId: question.id,
      selectedIndex,
      isCorrect: selectedIndex === question.correctIndex,
      topic: question.topic,
    };
  });

  const correctCount = resultRows.filter((result) => result.isCorrect).length;
  const totalQuestions = quiz.questions.length;
  const scorePercent =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const xpOnCompletion = xpForQuizScore(correctCount, totalQuestions);
  const awardedOn = utcDayKey();

  const incorrectTopicCounts = new Map<string, number>();
  for (const result of resultRows) {
    if (result.isCorrect) continue;
    incorrectTopicCounts.set(
      result.topic,
      (incorrectTopicCounts.get(result.topic) ?? 0) + 1
    );
  }

  const weakTopic =
    [...incorrectTopicCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    null;

  // XP pays out at most once per quiz per UTC day — the same anti-farming
  // granularity as flashcard reviews (see QuizXpAward). A repeat completion
  // still saves an attempt for score history, just with xpAwarded = 0.
  // The award marker, attempt row, and pet update commit (or roll back)
  // together, so a failed save can never leave the pet partially rewarded.
  const { attempt, xpAwarded } = await prisma.$transaction(async (tx) => {
    const priorAward = await tx.quizXpAward.findUnique({
      where: {
        userId_quizId_awardedOn: {
          userId: input.userId,
          quizId: quiz.id,
          awardedOn,
        },
      },
      select: { id: true },
    });
    const awarded = priorAward ? 0 : xpOnCompletion;

    if (!priorAward) {
      // A concurrent duplicate that slips past the check above violates the
      // unique key here and rolls the whole transaction back — no double XP.
      await tx.quizXpAward.create({
        data: {
          userId: input.userId,
          quizId: quiz.id,
          awardedOn,
          xp: awarded,
        },
      });
    }

    const createdAttempt = await tx.quizAttempt.create({
      data: {
        userId: input.userId,
        quizId: quiz.id,
        correctCount,
        totalQuestions,
        scorePercent,
        xpAwarded: awarded,
        questionResults: {
          create: resultRows.map((result) => ({
            userId: input.userId,
            questionId: result.questionId,
            selectedIndex: result.selectedIndex,
            isCorrect: result.isCorrect,
          })),
        },
      },
      include: {
        questionResults: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: {
            question: {
              select: {
                id: true,
                topic: true,
                question: true,
                correctIndex: true,
              },
            },
          },
        },
      },
    });

    // Finishing a quiz always counts as study activity (streak/lastStudyDate);
    // XP lands only on the first completion of this quiz today.
    await recordStudyActivity(input.userId, { xp: awarded, client: tx });

    return { attempt: createdAttempt, xpAwarded: awarded };
  });

  return {
    attempt,
    correctCount,
    totalQuestions,
    scorePercent,
    xpAwarded,
    weakTopic,
  };
}
