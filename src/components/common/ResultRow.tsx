import type { ReactNode } from 'react';

export type ResultRowProps = {
  correct: boolean;
  /** The question prompt. */
  question: ReactNode;
  /** What the user picked. */
  userAnswer: ReactNode;
  /** The right answer; shown when the user was wrong. */
  correctAnswer?: ReactNode;
  /** Optional legacy single-paragraph explanation. */
  explanation?: ReactNode;
  /** Structured teaching feedback (preferred over bare explanation). */
  feedback?: {
    verdict?: string;
    whyCorrect?: string | null;
    whyWrong?: string | null;
    concept?: string | null;
  };
};

/**
 * One reviewed question in the quiz results list: a coloured left border plus
 * the user's answer and, when wrong, the correct one. Semantic colours are
 * dark-aware via the status tokens.
 */
export function ResultRow({
  correct,
  question,
  userAnswer,
  correctAnswer,
  explanation,
  feedback,
}: ResultRowProps) {
  const tone = correct ? 'var(--success)' : 'var(--danger)';
  const soft = correct ? 'var(--success-soft)' : 'var(--danger-soft)';
  const hasStructured =
    Boolean(feedback?.whyCorrect) ||
    Boolean(feedback?.whyWrong) ||
    Boolean(feedback?.concept);

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: 'var(--card-border)',
        borderLeftWidth: 4,
        borderLeftColor: tone,
        background: soft,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{question}</p>
        <span className="shrink-0 text-lg" style={{ color: tone }}>
          {correct ? '✓' : '✗'}
        </span>
      </div>
      <div className="mt-2 space-y-1.5 text-sm">
        <p>
          <span className="theme-muted">Your answer: </span>
          <span style={{ color: tone }}>{userAnswer}</span>
        </p>
        {!correct && correctAnswer !== undefined && (
          <p>
            <span className="theme-muted">Correct answer: </span>
            <span style={{ color: 'var(--success)' }}>{correctAnswer}</span>
          </p>
        )}

        {hasStructured ? (
          <div className="space-y-1.5 pt-1">
            {feedback?.whyCorrect ? (
              <p>
                <span className="theme-muted">Why this is correct: </span>
                <span>{feedback.whyCorrect}</span>
              </p>
            ) : null}
            {!correct && feedback?.whyWrong ? (
              <p>
                <span className="theme-muted">
                  Why your answer was not correct:{' '}
                </span>
                <span>{feedback.whyWrong}</span>
              </p>
            ) : null}
            {feedback?.concept ? (
              <p className="theme-muted">{feedback.concept}</p>
            ) : null}
          </div>
        ) : explanation ? (
          <p className="theme-muted pt-1">{explanation}</p>
        ) : null}
      </div>
    </div>
  );
}
