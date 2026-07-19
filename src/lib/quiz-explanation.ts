/**
 * Formats quiz review feedback for the completion screen.
 *
 * Works for both newly generated quizzes (richer AI explanations) and older
 * saved quizzes (citation-style explanations), by structuring the display and
 * adding misconception guidance when the learner is wrong.
 */

export type QuizResultFeedback = {
  /** Short header line for correct or incorrect state. */
  verdict: string;
  /** Why the correct choice is right. */
  whyCorrect: string;
  /** Why the learner's pick is wrong (null when they were correct). */
  whyWrong: string | null;
  /** Optional one-line concept cue. */
  concept: string | null;
};

/** Common asymptotic / growth-rate notations seen in CS course notes. */
const GROWTH_MEANINGS: Array<{
  match: RegExp;
  label: string;
  meaning: string;
}> = [
  {
    match: /^(?:o?\(?\s*)?1(?:\s*\)?)?$/i,
    label: '1',
    meaning:
      'constant growth — the amount of work stays the same even as input size n increases',
  },
  {
    match: /^(?:o?\(?\s*)?n(?:\s*\)?)?$/i,
    label: 'n',
    meaning: 'linear growth — work increases in proportion to the input size n',
  },
  {
    match: /^(?:o?\(?\s*)?(?:n\^?2|n²)(?:\s*\)?)?$/i,
    label: 'n²',
    meaning:
      'quadratic growth — work increases with the square of the input size',
  },
  {
    match: /^(?:o?\(?\s*)?(?:n\^?3|n³)(?:\s*\)?)?$/i,
    label: 'n³',
    meaning: 'cubic growth — work grows with the cube of the input size',
  },
  {
    match: /^(?:o?\(?\s*)?(?:log\s*n|lg\s*n)(?:\s*\)?)?$/i,
    label: 'log n',
    meaning:
      'logarithmic growth — work grows slowly as the input size increases',
  },
  {
    match: /^(?:o?\(?\s*)?n\s*log\s*n(?:\s*\)?)?$/i,
    label: 'n log n',
    meaning:
      'linearithmic growth — work grows faster than linear but slower than quadratic',
  },
];

function growthMeaning(answer: string): {
  label: string;
  meaning: string;
} | null {
  const cleaned = answer.trim();
  for (const entry of GROWTH_MEANINGS) {
    if (entry.match.test(cleaned)) {
      return { label: entry.label, meaning: entry.meaning };
    }
  }
  return null;
}

function isCitationOnly(explanation: string): boolean {
  const text = explanation.trim();
  if (!text) return true;
  return (
    /^(the\s+notes?\b|according\s+to\s+the\s+(notes?|source)|as\s+(stated|listed|mentioned)\s+in\s+the\s+notes?|source\s+material)/i.test(
      text
    ) ||
    /\bnotes?\s+(directly\s+)?(list|state|say|mention|show|define)\b/i.test(
      text
    )
  );
}

function stripCitationPadding(explanation: string): string {
  return explanation
    .trim()
    .replace(
      /^(the\s+notes?\s+(directly\s+)?(list|state|say|mention|show)\s+)/i,
      ''
    )
    .replace(/^according\s+to\s+the\s+(notes?|source)[,:]?\s*/i, '')
    .replace(/^as\s+(stated|listed|mentioned)\s+in\s+the\s+notes?[,:]?\s*/i, '')
    .trim();
}

function sentenceCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Build structured review feedback for one quiz question result.
 */
export function buildQuizResultFeedback(args: {
  correct: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation?: string | null;
  topic?: string | null;
}): QuizResultFeedback {
  const userAnswer = args.userAnswer.trim() || 'No answer';
  const correctAnswer = args.correctAnswer.trim();
  const rawExplanation = args.explanation?.trim() || '';
  const topic = args.topic?.trim() || null;

  const correctGrowth = growthMeaning(correctAnswer);
  const userGrowth = growthMeaning(userAnswer);

  let whyCorrect: string;
  if (correctGrowth) {
    whyCorrect = ensurePeriod(
      `${correctAnswer} represents ${correctGrowth.meaning}`
    );
    if (rawExplanation && !isCitationOnly(rawExplanation)) {
      whyCorrect = ensurePeriod(
        `${whyCorrect} ${sentenceCase(stripCitationPadding(rawExplanation))}`
      );
    }
  } else if (rawExplanation && !isCitationOnly(rawExplanation)) {
    whyCorrect = ensurePeriod(
      sentenceCase(stripCitationPadding(rawExplanation))
    );
  } else if (rawExplanation) {
    const cleaned = stripCitationPadding(rawExplanation);
    whyCorrect = ensurePeriod(
      cleaned
        ? `The correct choice is “${correctAnswer}” — ${cleaned}`
        : `The correct choice is “${correctAnswer}” based on the concept in your notes`
    );
  } else {
    whyCorrect = ensurePeriod(`The correct choice is “${correctAnswer}”`);
  }

  let whyWrong: string | null = null;
  if (!args.correct) {
    if (
      userGrowth &&
      correctGrowth &&
      userGrowth.label !== correctGrowth.label
    ) {
      whyWrong = ensurePeriod(
        `Your answer “${userAnswer}” represents ${userGrowth.meaning}, which is a different growth rate than this question asked for`
      );
    } else if (userAnswer === 'No answer') {
      whyWrong =
        'You did not select an answer for this question, so it was counted incorrect.';
    } else {
      whyWrong = ensurePeriod(
        `“${userAnswer}” is a common mix-up for this item — it does not match the concept the question is testing`
      );
    }
  }

  let concept: string | null = null;
  if (correctGrowth) {
    concept = `Concept: ${correctGrowth.meaning}.`;
  } else if (topic) {
    concept = `Concept to review: ${topic}.`;
  }

  if (args.correct) {
    return {
      verdict: 'Correct',
      whyCorrect,
      whyWrong: null,
      concept,
    };
  }

  return {
    verdict: 'Not quite',
    whyCorrect,
    whyWrong,
    concept,
  };
}
