export type QuizQuestionData = {
  id: string;
  topic: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
  /**
   * Parallel to `choices`: precomputed "why this option is wrong" per choice,
   * empty at the correct index. Generated with the quiz, so results/review need
   * no live AI call. Empty for quizzes made before this existed.
   */
  choiceRationales: string[];
  hint: string | null;
};

export type QuizCourse = { id: string; name: string; color: string };

/** A source note referenced by a quiz. */
export type QuizSourceNote = { id: string; title: string };

/** A note that can be picked as a quiz source. */
export type QuizNoteOption = {
  id: string;
  title: string;
  hasContent: boolean;
  /** True when the note has an attached PDF passed through to the AI. */
  hasPdf: boolean;
  course: QuizCourse | null;
};

/** A generated quiz, shown as one row on the quizzes page. */
export type QuizEntity = {
  id: string;
  title: string;
  course: QuizCourse | null;
  sourceNotes: QuizSourceNote[];
  questions: QuizQuestionData[];
  /** How many times this quiz has been submitted. */
  attemptCount: number;
  /** Score (0–100) of the most recent attempt, or null if never taken. */
  lastScorePercent: number | null;
  /** True once the quiz has been fully completed for its reward. */
  completed: boolean;
};

/** The three ways to take a quiz. */
export type QuizMode = 'review' | 'practice' | 'exam';

/** What the page hands to QuizSession; the session owns mode + timer state. */
export type ActiveQuizSession = {
  quizId: string;
  title: string;
  questions: QuizQuestionData[];
};
