/**
 * US-4.05 — quiz completion awards pet XP.
 *
 * Uses the real pet-xp helpers against a mocked Prisma client, so these tests
 * prove the whole chain: score → tier XP → QuizXpAward dedupe row →
 * QuizAttempt → Pet xp/level/stage update, all inside one transaction.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { txMock, prismaMock } = vi.hoisted(() => {
  const tx = {
    quizXpAward: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    quizAttempt: {
      create: vi.fn(),
    },
    pet: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  return {
    txMock: tx,
    prismaMock: {
      quiz: {
        findFirst: vi.fn(),
      },
      // Runs the callback against the tx mock, mimicking an interactive
      // transaction. Rollback semantics are asserted via call ordering.
      $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { QuizServiceError, submitQuizAttempt } from '@/lib/quizzes';

const USER_ID = 'user_quiz_1';
const QUIZ_ID = 'clquizquizquizquizquizquiz';

const QUESTIONS = [
  {
    id: 'clq1q1q1q1q1q1q1q1q1q1q1q1',
    userId: USER_ID,
    quizId: QUIZ_ID,
    topic: 'Sorting',
    question: 'Q1?',
    choices: ['a', 'b'],
    correctIndex: 0,
    explanation: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
  },
  {
    id: 'clq2q2q2q2q2q2q2q2q2q2q2q2',
    userId: USER_ID,
    quizId: QUIZ_ID,
    topic: 'Graphs',
    question: 'Q2?',
    choices: ['a', 'b'],
    correctIndex: 1,
    explanation: null,
    createdAt: new Date('2026-07-01T00:00:01.000Z'),
  },
];

const ownedQuiz = {
  id: QUIZ_ID,
  userId: USER_ID,
  noteId: 'clnotenotenotenotenotenote',
  courseId: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  questions: QUESTIONS,
};

/** Answers both questions correctly → 100% → the 15 XP tier. */
const perfectAnswers = [
  { questionId: QUESTIONS[0].id, selectedIndex: 0 },
  { questionId: QUESTIONS[1].id, selectedIndex: 1 },
];

function mockPetRow(xp: number) {
  return {
    id: 'pet_1',
    name: 'StudyPet',
    xp,
    level: 1,
    stage: 'egg',
    streakCount: 1,
    lastStudyDate: null as Date | null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.quiz.findFirst.mockResolvedValue(ownedQuiz as never);
  txMock.quizXpAward.findUnique.mockResolvedValue(null);
  txMock.quizXpAward.create.mockResolvedValue({} as never);
  txMock.quizAttempt.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) =>
      ({
        id: 'attempt_1',
        ...args.data,
        questionResults: [],
        createdAt: new Date(),
      }) as never
  );
  txMock.pet.findUnique.mockResolvedValue(mockPetRow(0) as never);
  txMock.user.findUnique.mockResolvedValue({ timezone: null } as never);
  txMock.pet.upsert.mockImplementation(
    async (args: { update: Record<string, unknown> }) =>
      ({ id: 'pet_1', userId: USER_ID, ...args.update }) as never
  );
});

describe('submitQuizAttempt — pet XP awarding (US-4.05)', () => {
  it('awards score-tiered XP and adds it to the pet previous total', async () => {
    txMock.pet.findUnique.mockResolvedValue(mockPetRow(40) as never);

    const result = await submitQuizAttempt({
      userId: USER_ID,
      quizId: QUIZ_ID,
      answers: perfectAnswers,
    });

    expect(result.scorePercent).toBe(100);
    expect(result.xpAwarded).toBe(15);
    expect(txMock.quizAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ xpAwarded: 15 }),
      })
    );
    // 40 previous + 15 quiz XP = 55, still egg stage.
    expect(txMock.pet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        update: expect.objectContaining({ xp: 55, level: 1, stage: 'egg' }),
      })
    );
  });

  it('awards the lower tier for a weaker score', async () => {
    const result = await submitQuizAttempt({
      userId: USER_ID,
      quizId: QUIZ_ID,
      answers: [
        { questionId: QUESTIONS[0].id, selectedIndex: 0 },
        { questionId: QUESTIONS[1].id, selectedIndex: 0 }, // wrong
      ],
    });

    // 1/2 = 50% → lowest tier.
    expect(result.xpAwarded).toBe(6);
  });

  it('evolves the pet stage when quiz XP crosses a threshold', async () => {
    // 80 previous + 15 = 95 ≥ 90 → hatchling (level 2).
    txMock.pet.findUnique.mockResolvedValue(mockPetRow(80) as never);

    await submitQuizAttempt({
      userId: USER_ID,
      quizId: QUIZ_ID,
      answers: perfectAnswers,
    });

    expect(txMock.pet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          xp: 95,
          level: 2,
          stage: 'hatchling',
        }),
      })
    );
  });

  it('records the award marker keyed by user, quiz, and UTC day', async () => {
    await submitQuizAttempt({
      userId: USER_ID,
      quizId: QUIZ_ID,
      answers: perfectAnswers,
    });

    const today = new Date().toISOString().slice(0, 10);
    expect(txMock.quizXpAward.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        quizId: QUIZ_ID,
        awardedOn: today,
        xp: 15,
      },
    });
  });

  it('does not award XP twice for the same quiz on the same day', async () => {
    txMock.quizXpAward.findUnique.mockResolvedValue({
      id: 'award_1',
    } as never);
    txMock.pet.findUnique.mockResolvedValue(mockPetRow(55) as never);

    const result = await submitQuizAttempt({
      userId: USER_ID,
      quizId: QUIZ_ID,
      answers: perfectAnswers,
    });

    expect(result.xpAwarded).toBe(0);
    expect(txMock.quizXpAward.create).not.toHaveBeenCalled();
    // The repeat attempt is still saved (score history), just with 0 XP...
    expect(txMock.quizAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ xpAwarded: 0 }),
      })
    );
    // ...and the pet total is unchanged.
    expect(txMock.pet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ xp: 55 }),
      })
    );
  });

  it('throws NOT_FOUND and awards nothing for a quiz the user does not own', async () => {
    prismaMock.quiz.findFirst.mockResolvedValue(null);

    await expect(
      submitQuizAttempt({
        userId: USER_ID,
        quizId: QUIZ_ID,
        answers: perfectAnswers,
      })
    ).rejects.toMatchObject({
      name: 'QuizServiceError',
      code: 'NOT_FOUND',
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(txMock.pet.upsert).not.toHaveBeenCalled();
  });

  it('rejects an incomplete submission without awarding XP', async () => {
    await expect(
      submitQuizAttempt({
        userId: USER_ID,
        quizId: QUIZ_ID,
        answers: [{ questionId: QUESTIONS[0].id, selectedIndex: 0 }],
      })
    ).rejects.toBeInstanceOf(QuizServiceError);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(txMock.pet.upsert).not.toHaveBeenCalled();
  });

  it('does not touch pet XP when saving the attempt fails', async () => {
    txMock.quizAttempt.create.mockRejectedValue(
      new Error('db connection lost')
    );

    await expect(
      submitQuizAttempt({
        userId: USER_ID,
        quizId: QUIZ_ID,
        answers: perfectAnswers,
      })
    ).rejects.toThrow('db connection lost');

    // The pet update runs after the attempt insert inside the same
    // transaction, so a failed save never reaches the XP write (and a real
    // database would also roll back the QuizXpAward marker).
    expect(txMock.pet.upsert).not.toHaveBeenCalled();
  });
});
