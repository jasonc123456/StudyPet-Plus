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
    questions: QuizQuestionData[];
  } | null;
};

export type ActiveQuizSession = {
  noteTitle: string;
  questions: QuizQuestionData[];
};
