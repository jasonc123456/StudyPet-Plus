// Quiz generation + persistence (US-3.4).
//
// Loads a Note the caller owns, asks the AI layer for multiple-choice questions,
// then persists a Quiz batch with child QuizQuestion rows.

import { generateQuiz } from '@/lib/ai';
import { claimAiGeneration } from '@/lib/ai/entitlement';
import {
  quizResponseSchema,
  type AiProgressCallback,
  type AiProviderName,
} from '@/lib/ai/types';
import {
  assembleNoteSource,
  defaultEntityTitle,
  listCourseTopics,
} from '@/lib/note-sources';
import { recordStudyActivity, xpForQuizScore } from '@/lib/pet-xp';
import { prisma } from '@/lib/prisma';
import {
  buildWeakTopicMisconceptionReason,
  mergeTeachingExplanation,
  normalizeChoiceRationales,
  normalizeGeneratedHint,
} from '@/lib/quiz-explanation';
import type {
  Quiz,
  QuizAttempt,
  QuizQuestion,
  QuizQuestionResult,
} from '@prisma/client';

export class QuizServiceError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'EMPTY_CONTENT' | 'LIMIT_REACHED',
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
  /** One or more owned notes the quiz is built from. */
  noteIds: string[];
  userId: string;
  /** Optional user-supplied title; a smart default is derived otherwise. */
  title?: string;
  count?: number;
  /** Optional live progress callback forwarded to the AI layer. */
  onProgress?: AiProgressCallback;
};

export type GenerateAndSaveQuizResult = {
  quiz: QuizWithQuestions;
  generatedCount: number;
  provider: AiProviderName;
  /** True when the combined source text was truncated to the cap. */
  truncated: boolean;
};

export type SubmitQuizAttemptInput = {
  userId: string;
  quizId: string;
  clientAttemptId: string;
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
  completed: boolean;
  weakTopic: string | null;
  /** Human-readable reason the weak topic was recommended. */
  weakTopicReason: string | null;
  /** Best next study destination for the weak topic. */
  reviewHref: string | null;
  reviewLabel: string | null;
};

/**
 * Delete a single quiz the caller owns. Child questions, attempts, XP awards
 * and question results all cascade, so removing the Quiz row is enough.
 * Throws NOT_FOUND when the quiz doesn't exist or belongs to someone else.
 */
export async function deleteOwnedQuiz(
  quizId: string,
  userId: string
): Promise<void> {
  const result = await prisma.quiz.deleteMany({
    where: { id: quizId, userId },
  });
  if (result.count === 0) {
    throw new QuizServiceError('NOT_FOUND', 'Quiz not found');
  }
}

/**
 * Generate a quiz from 1..N owned notes and persist it as a standalone entity.
 * Throws QuizServiceError for ownership / empty-content failures;
 * rethrows AiProviderError (and other errors) for the route to map.
 */
export async function generateAndSaveQuiz(
  input: GenerateAndSaveQuizInput
): Promise<GenerateAndSaveQuizResult> {
  const assembled = await assembleNoteSource(input.noteIds, input.userId);
  if (!assembled.ok) {
    if (assembled.reason === 'NOT_FOUND') {
      throw new QuizServiceError('NOT_FOUND', 'Note not found');
    }
    if (assembled.reason === 'SOURCE_LIMIT') {
      throw new QuizServiceError('LIMIT_REACHED', assembled.message);
    }
    throw new QuizServiceError(
      'EMPTY_CONTENT',
      'Selected notes have no content to generate a quiz from'
    );
  }

  const { notes, sourceText, truncated, attachments, courseId, topicHint } =
    assembled.value;

  // Reuse the course's existing topic vocabulary so repeat generations group
  // into the same categories instead of minting near-duplicate ones.
  const existingTopics = await listCourseTopics(courseId, input.userId);

  const { entitlement, release } = await claimAiGeneration(input.userId);
  let generated;
  try {
    generated = await generateQuiz({
      sourceText,
      count: input.count,
      topicHint,
      existingTopics,
      attachments,
      demoOnly: entitlement.demoOnly,
      onProgress: input.onProgress,
    });
  } finally {
    release();
  }
  const { items, provider } = generated;

  if (
    provider === 'demo' &&
    !entitlement.demoOnly &&
    process.env['AI_DEMO_MODE'] !== 'true'
  ) {
    throw new Error('Refusing to persist demo quiz while AI mode is on');
  }

  const parsed = quizResponseSchema.safeParse({ questions: items });
  if (!parsed.success) {
    throw new Error('AI returned quiz questions that failed schema validation');
  }

  const questions = parsed.data.questions;
  const title = defaultEntityTitle(notes, input.title);
  // Keep the legacy single-note link populated when there's exactly one note.
  const singleNoteId = notes.length === 1 ? notes[0]!.id : null;

  const quiz = await prisma.quiz.create({
    data: {
      userId: input.userId,
      title,
      noteId: singleNoteId,
      courseId,
      sourceNotes: {
        create: notes.map((note) => ({ noteId: note.id })),
      },
      questions: {
        create: questions.map((q) => ({
          userId: input.userId,
          topic: q.topic,
          question: q.question,
          choices: q.choices,
          correctIndex: q.answerIndex,
          explanation: mergeTeachingExplanation({
            explanation: q.explanation ?? null,
            misconception: q.misconception ?? null,
            correctAnswer: q.choices[q.answerIndex] ?? '',
            question: q.question,
            topic: q.topic,
          }),
          choiceRationales: normalizeChoiceRationales(
            q.choiceRationales,
            q.choices,
            q.answerIndex
          ),
          hint: normalizeGeneratedHint(q.hint) || q.hint,
        })),
      },
    },
    include: {
      questions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  });

  return { quiz, generatedCount: questions.length, provider, truncated };
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
  const isPerfect = totalQuestions > 0 && correctCount === totalQuestions;

  const incorrectTopicCounts = new Map<string, number>();
  for (const result of resultRows) {
    if (result.isCorrect) continue;
    incorrectTopicCounts.set(
      result.topic,
      (incorrectTopicCounts.get(result.topic) ?? 0) + 1
    );
  }

  const weakTopicEntry = [...incorrectTopicCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];
  const weakTopic = weakTopicEntry?.[0] ?? null;
  const weakMissCount = weakTopicEntry?.[1] ?? 0;

  const sampleMiss =
    weakTopic == null
      ? null
      : (resultRows.find(
          (result) => !result.isCorrect && result.topic === weakTopic
        ) ?? null);
  const sampleQuestion =
    sampleMiss == null
      ? null
      : (quiz.questions.find(
          (question) => question.id === sampleMiss.questionId
        ) ?? null);

  const reviewNext = await resolveWeakTopicReviewTarget({
    userId: input.userId,
    quizId: quiz.id,
    noteId: quiz.noteId,
    weakTopic,
    weakMissCount,
    userAnswer:
      sampleMiss && sampleQuestion
        ? (sampleQuestion.choices[sampleMiss.selectedIndex] ?? null)
        : null,
    correctAnswer: sampleQuestion
      ? (sampleQuestion.choices[sampleQuestion.correctIndex] ?? null)
      : null,
    question: sampleQuestion?.question ?? null,
  });

  const previousAttempt = await prisma.quizAttempt.findUnique({
    where: {
      userId_clientAttemptId: {
        userId: input.userId,
        clientAttemptId: input.clientAttemptId,
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

  if (previousAttempt) {
    const completed = Boolean(
      await prisma.quizXpAward.findUnique({
        where: {
          userId_quizId: { userId: input.userId, quizId: quiz.id },
        },
        select: { id: true },
      })
    );
    return {
      attempt: previousAttempt,
      correctCount: previousAttempt.correctCount,
      totalQuestions: previousAttempt.totalQuestions,
      scorePercent: previousAttempt.scorePercent,
      xpAwarded: previousAttempt.xpAwarded,
      completed,
      weakTopic,
      weakTopicReason: reviewNext.reason,
      reviewHref: reviewNext.href,
      reviewLabel: reviewNext.label,
    };
  }

  // Every genuine partial attempt earns its score-tier XP. A perfect attempt
  // creates the permanent completion marker; after that, retakes remain
  // available but award no more XP. The attempt, marker, and pet update are
  // atomic, while clientAttemptId makes network retries idempotent.
  const { attempt, xpAwarded, completed } = await prisma.$transaction(
    async (tx) => {
      const completionAward = await tx.quizXpAward.findUnique({
        where: {
          userId_quizId: {
            userId: input.userId,
            quizId: quiz.id,
          },
        },
        select: { id: true },
      });
      const awarded = completionAward ? 0 : xpOnCompletion;

      const createdAttempt = await tx.quizAttempt.create({
        data: {
          userId: input.userId,
          quizId: quiz.id,
          clientAttemptId: input.clientAttemptId,
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

      if (isPerfect && !completionAward) {
        await tx.quizXpAward.create({
          data: {
            userId: input.userId,
            quizId: quiz.id,
            xp: awarded,
          },
        });
      }

      await recordStudyActivity(input.userId, { xp: awarded, client: tx });

      return {
        attempt: createdAttempt,
        xpAwarded: awarded,
        completed: Boolean(completionAward) || isPerfect,
      };
    }
  );

  return {
    attempt,
    correctCount,
    totalQuestions,
    scorePercent,
    xpAwarded,
    completed,
    weakTopic,
    weakTopicReason: reviewNext.reason,
    reviewHref: reviewNext.href,
    reviewLabel: reviewNext.label,
  };
}

async function resolveWeakTopicReviewTarget(args: {
  userId: string;
  quizId: string;
  noteId: string | null;
  weakTopic: string | null;
  weakMissCount: number;
  userAnswer?: string | null;
  correctAnswer?: string | null;
  question?: string | null;
}): Promise<{
  reason: string | null;
  href: string | null;
  label: string | null;
}> {
  const {
    userId,
    quizId,
    noteId,
    weakTopic,
    weakMissCount,
    userAnswer,
    correctAnswer,
    question,
  } = args;
  if (!weakTopic) {
    return { reason: null, href: null, label: null };
  }

  const reason = buildWeakTopicMisconceptionReason({
    topic: weakTopic,
    missCount: weakMissCount,
    userAnswer,
    correctAnswer,
    question,
  });

  // Prefer a flashcard deck that covers the weak topic.
  const matchingCard = await prisma.flashcard.findFirst({
    where: {
      userId,
      topic: { equals: weakTopic, mode: 'insensitive' },
      setId: { not: null },
    },
    select: { setId: true },
    orderBy: { createdAt: 'desc' },
  });

  if (matchingCard?.setId) {
    return {
      reason,
      href: `/dashboard/flashcards/study/${matchingCard.setId}`,
      label: 'Review flashcards',
    };
  }

  if (noteId) {
    return {
      reason,
      href: `/dashboard/notes/${noteId}`,
      label: 'Review notes',
    };
  }

  // Fall back to source notes linked through the quiz join table.
  const sourceNote = await prisma.quizSourceNote.findFirst({
    where: { quizId },
    select: { noteId: true },
    orderBy: { noteId: 'asc' },
  });
  if (sourceNote?.noteId) {
    return {
      reason,
      href: `/dashboard/notes/${sourceNote.noteId}`,
      label: 'Review notes',
    };
  }

  return {
    reason,
    href: '/dashboard/quizzes',
    label: 'Practice again',
  };
}
