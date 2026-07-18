/**
 * US-4.05 — POST /api/quizzes/attempts route behavior around XP awarding.
 * The XP math itself is covered in src/lib/quizzes.test.ts; these tests lock
 * the route contract: auth/validation gates never reach the service, and the
 * service result (including xpAwarded) is passed through on success.
 */

import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-response', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api-response')>(
      '@/lib/api-response'
    );
  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock('@/lib/quizzes', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/quizzes')>('@/lib/quizzes');
  return {
    QuizServiceError: actual.QuizServiceError,
    submitQuizAttempt: vi.fn(),
  };
});

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

import { requireUser } from '@/lib/api-response';
import { QuizServiceError, submitQuizAttempt } from '@/lib/quizzes';

import { POST } from './route';

const requireUserMock = vi.mocked(requireUser);
const submitQuizAttemptMock = vi.mocked(submitQuizAttempt);

const USER_ID = 'user_quiz_route_1';
const QUIZ_ID = 'clquizquizquizquizquizquiz';
const QUESTION_ID = 'clq1q1q1q1q1q1q1q1q1q1q1q1';

const validBody = {
  quizId: QUIZ_ID,
  clientAttemptId: '11111111-1111-4111-8111-111111111111',
  answers: [{ questionId: QUESTION_ID, selectedIndex: 0 }],
};

function authOk() {
  requireUserMock.mockResolvedValue({
    user: { id: USER_ID, email: 'student@example.com' },
  } as Awaited<ReturnType<typeof requireUser>>);
}

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/quizzes/attempts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  };
}

describe('POST /api/quizzes/attempts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 and never awards XP when unauthenticated', async () => {
    requireUserMock.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );

    const res = await POST(postRequest(validBody));
    const { status, body } = await readJson(res);

    expect(status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(submitQuizAttemptMock).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON without touching the service', async () => {
    authOk();

    const res = await POST(postRequest('{not-json'));
    const { status, body } = await readJson(res);

    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Invalid JSON body' });
    expect(submitQuizAttemptMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that fails validation (no answers)', async () => {
    authOk();

    const res = await POST(
      postRequest({
        quizId: QUIZ_ID,
        clientAttemptId: validBody.clientAttemptId,
        answers: [],
      })
    );
    const { status, body } = await readJson(res);

    expect(status).toBe(400);
    expect(body).toEqual({ error: 'At least one answer is required' });
    expect(submitQuizAttemptMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the quiz is not found / not owned', async () => {
    authOk();
    submitQuizAttemptMock.mockRejectedValue(
      new QuizServiceError('NOT_FOUND', 'Quiz not found')
    );

    const res = await POST(postRequest(validBody));
    const { status, body } = await readJson(res);

    expect(status).toBe(404);
    expect(body).toEqual({ error: 'Quiz not found' });
  });

  it('returns 400 when the submission is incomplete', async () => {
    authOk();
    submitQuizAttemptMock.mockRejectedValue(
      new QuizServiceError(
        'EMPTY_CONTENT',
        'Submit one answer for each quiz question'
      )
    );

    const res = await POST(postRequest(validBody));
    const { status, body } = await readJson(res);

    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Submit one answer for each quiz question' });
  });

  it('returns 201 with the awarded XP for the signed-in user', async () => {
    authOk();
    submitQuizAttemptMock.mockResolvedValue({
      attempt: { id: 'attempt_1' },
      correctCount: 1,
      totalQuestions: 1,
      scorePercent: 100,
      xpAwarded: 15,
      completed: true,
      weakTopic: null,
    } as Awaited<ReturnType<typeof submitQuizAttempt>>);

    const res = await POST(postRequest(validBody));
    const { status, body } = await readJson(res);

    expect(status).toBe(201);
    expect(body).toMatchObject({ scorePercent: 100, xpAwarded: 15 });
    expect(submitQuizAttemptMock).toHaveBeenCalledWith({
      userId: USER_ID,
      quizId: QUIZ_ID,
      clientAttemptId: validBody.clientAttemptId,
      answers: validBody.answers,
    });
  });

  it('returns 500 when the service fails unexpectedly', async () => {
    authOk();
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    submitQuizAttemptMock.mockRejectedValue(new Error('db connection lost'));

    const res = await POST(postRequest(validBody));
    const { status, body } = await readJson(res);

    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Failed to save quiz attempt' });
    consoleSpy.mockRestore();
  });
});
