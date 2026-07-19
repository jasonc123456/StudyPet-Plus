/**
 * Client helper for AI tutor feedback (safe to import from client components).
 * Calls POST /api/quizzes/feedback and falls back locally if the request fails.
 */

import {
  buildFallbackTutorFeedback,
  type TutorFeedback,
} from '@/lib/quiz-explanation';

export type QuizTutorFeedbackRequestItem = {
  id: string;
  question: string;
  choices: string[];
  selectedAnswer?: string | null;
  correctAnswer: string;
  topic?: string | null;
  correct?: boolean | null;
  purpose?: 'hint' | 'feedback' | 'both';
  explanation?: string | null;
};

type ApiFeedbackItem = {
  id: string | null;
  fromFallback: boolean;
  feedback: TutorFeedback;
};

export async function fetchQuizTutorFeedback(args: {
  mode: 'review' | 'practice' | 'exam';
  items: QuizTutorFeedbackRequestItem[];
  sourceSnippet?: string | null;
  signal?: AbortSignal;
}): Promise<Record<string, TutorFeedback>> {
  const fallbackMap: Record<string, TutorFeedback> = {};
  for (const item of args.items) {
    fallbackMap[item.id] = buildFallbackTutorFeedback({
      question: item.question,
      choices: item.choices,
      selectedAnswer: item.selectedAnswer ?? null,
      correctAnswer: item.correctAnswer,
      topic: item.topic,
      correct: item.correct ?? null,
      purpose: item.purpose ?? 'feedback',
      explanation: item.explanation,
    });
  }

  if (args.items.length === 0) return fallbackMap;

  try {
    const response = await fetch('/api/quizzes/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: args.signal,
      body: JSON.stringify({
        mode: args.mode,
        sourceSnippet: args.sourceSnippet ?? null,
        items: args.items.map((item) => ({
          id: item.id,
          question: item.question,
          choices: item.choices,
          selectedAnswer: item.selectedAnswer ?? null,
          correctAnswer: item.correctAnswer,
          topic: item.topic ?? null,
          correct: item.correct ?? null,
          purpose: item.purpose ?? 'feedback',
        })),
      }),
    });

    if (!response.ok) return fallbackMap;

    const data = (await response.json()) as {
      items?: ApiFeedbackItem[];
      error?: string;
    };
    const map = { ...fallbackMap };
    for (const row of data.items ?? []) {
      if (!row?.id || !row.feedback) continue;
      map[row.id] = row.feedback;
    }
    return map;
  } catch {
    return fallbackMap;
  }
}

export function feedbackCacheKey(
  questionId: string,
  kind: 'hint' | 'answer',
  selectedIndex?: number
): string {
  if (kind === 'hint') return `${questionId}:hint`;
  return `${questionId}:answer:${selectedIndex ?? 'none'}`;
}
