export type QuizQuestionData = {
  id: string;
  topic: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
};

export type QuizNoteOption = {
  id: string;
  title: string;
  hasContent: boolean;
  questionCount: number;
  course: { id: string; name: string; color: string } | null;
  latestQuiz: {
    id: string;
    completed: boolean;
    questions: QuizQuestionData[];
    /** How many times this quiz has been submitted. */
    attemptCount: number;
    /** Score (0–100) of the most recent attempt, or null if never taken. */
    lastScorePercent: number | null;
  } | null;
};

export type ActiveQuizSession = {
  quizId: string;
  noteId: string;
  noteTitle: string;
  questions: QuizQuestionData[];
};
