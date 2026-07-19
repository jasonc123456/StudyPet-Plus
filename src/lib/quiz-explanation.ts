/**
 * Formats quiz review feedback for completion + in-quiz review.
 *
 * Prefers concept-based teaching over “the notes say…” citations. Works for
 * newly generated quizzes and older saved citation-style explanations.
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

const CITATION_PHRASE_RE =
  /\b(?:the\s+notes?\s+(?:explicitly\s+|directly\s+)?(?:define|list|state|say|mention|show|describe|call)|according\s+to\s+the\s+(?:notes?|source)|as\s+(?:stated|listed|mentioned|defined)\s+in\s+the\s+notes?|the\s+source(?:\s+material)?\s+(?:states?|says?|lists?|defines?)|per\s+the\s+(?:notes?|source)|in\s+(?:your\s+)?notes)\b[,:]?\s*/gi;

function stripCitationPhrases(explanation: string): string {
  return explanation
    .replace(CITATION_PHRASE_RE, '')
    .replace(
      /\bnotes?\s+(?:explicitly\s+|directly\s+)?(?:define|list|state|say)\s+/gi,
      ''
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isMostlyCitation(explanation: string): boolean {
  const text = explanation.trim();
  if (!text) return true;
  const stripped = stripCitationPhrases(text);
  // If removing citation scaffolding leaves little substance, treat as citation-led.
  if (stripped.length < 24) return true;
  if (
    /^(the\s+notes?\b|according\s+to\s+the\s+(notes?|source)|as\s+(stated|listed|mentioned)\s+in\s+the\s+notes?|source\s+material)/i.test(
      text
    )
  ) {
    return true;
  }
  return /\bnotes?\s+(explicitly\s+|directly\s+)?(define|list|state|say|mention)\b/i.test(
    text
  );
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
 * Turn a citation-led explanation into concept-first teaching prose.
 * Also used when persisting newly generated quiz explanations.
 */
export function normalizeGeneratedExplanation(
  explanation: string | null | undefined,
  correctAnswer: string
): string {
  const raw = (explanation ?? '').trim();
  if (!raw) {
    return ensurePeriod(
      `“${correctAnswer}” is the best match for the concept this question is testing`
    );
  }

  let cleaned = stripCitationPhrases(raw);

  // “an algorithm as a precise…” → “An algorithm is a precise…”
  cleaned = cleaned.replace(
    /^((?:an?\s+)?)([A-Za-z][\w\s/-]{0,40}?)\s+as\s+/i,
    (_match, article: string, subject: string) => {
      const noun = subject.trim();
      const head = article?.trim()
        ? `${sentenceCase(article.trim())} ${noun}`
        : sentenceCase(noun);
      return `${head} is `;
    }
  );

  // Dangling leftovers like “an algorithm as …”
  cleaned = cleaned.replace(/\bas\s+(?:a|an|the)\s+/gi, 'a ').trim();

  if (!cleaned) {
    return ensurePeriod(
      `“${correctAnswer}” captures the core idea this question is testing`
    );
  }

  // Prefer teaching frame when the text still reads as a quote-definition dump.
  if (isMostlyCitation(raw) || /^(?:an?\s+)?["'“]/.test(cleaned)) {
    const body = cleaned.replace(/^["'“]+|["'”]+$/g, '').trim();
    return ensurePeriod(
      `${sentenceCase(body)} That is why “${correctAnswer}” is the best choice`
    );
  }

  return ensurePeriod(sentenceCase(cleaned));
}

function buildWhyCorrect(args: {
  correctAnswer: string;
  explanation: string;
  correctGrowth: ReturnType<typeof growthMeaning>;
}): string {
  const { correctAnswer, explanation, correctGrowth } = args;

  if (correctGrowth) {
    return ensurePeriod(`${correctAnswer} represents ${correctGrowth.meaning}`);
  }

  const taught = normalizeGeneratedExplanation(explanation, correctAnswer);

  // Avoid the awkward “correct choice is X — The notes…” pattern entirely.
  if (/correct choice is/i.test(taught) || isMostlyCitation(explanation)) {
    const body = stripCitationPhrases(explanation);
    if (body && body.length > 20) {
      const reframed = normalizeGeneratedExplanation(body, correctAnswer);
      if (!/correct choice is/i.test(reframed)) {
        return reframed;
      }
    }
    return ensurePeriod(
      `“${correctAnswer}” is right because it matches the idea the question is testing`
    );
  }

  return taught;
}

function buildWhyWrong(args: {
  userAnswer: string;
  correctAnswer: string;
  userGrowth: ReturnType<typeof growthMeaning>;
  correctGrowth: ReturnType<typeof growthMeaning>;
}): string | null {
  const { userAnswer, correctAnswer, userGrowth, correctGrowth } = args;

  if (userAnswer === 'No answer') {
    return 'You did not select an answer for this question, so it was counted incorrect.';
  }

  if (userGrowth && correctGrowth && userGrowth.label !== correctGrowth.label) {
    return ensurePeriod(
      `Your answer “${userAnswer}” represents ${userGrowth.meaning}, while the question asked about ${correctGrowth.meaning}`
    );
  }

  // Algorithm vs formula / calculation mix-up
  if (
    /formula|equation|expression|calculation/i.test(userAnswer) &&
    /algorithm|sequence of steps|step-by-step|process|procedure/i.test(
      correctAnswer
    )
  ) {
    return ensurePeriod(
      `A formula can appear inside an algorithm, but an algorithm is broader than a single calculation — it describes a full step-by-step process, including how input is handled, what operations happen, and when the process stops`
    );
  }

  if (
    /halt|stop|terminate/i.test(userAnswer) &&
    /input|output|transform|sequence/i.test(correctAnswer)
  ) {
    return ensurePeriod(
      `Halting matters for algorithms, but the question is asking for the broader definition — a complete process that transforms input into output through precise steps`
    );
  }

  if (
    /program|code|software/i.test(userAnswer) &&
    /algorithm|sequence|process/i.test(correctAnswer)
  ) {
    return ensurePeriod(
      `A program is one way to implement an algorithm, but an algorithm itself is the abstract step-by-step idea — it can exist before any code is written`
    );
  }

  return ensurePeriod(
    `“${userAnswer}” is a common mix-up here — it points at a related idea, but not the concept this question is testing`
  );
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

  const whyCorrect = buildWhyCorrect({
    correctAnswer,
    explanation: rawExplanation,
    correctGrowth,
  });

  const whyWrong = args.correct
    ? null
    : buildWhyWrong({
        userAnswer,
        correctAnswer,
        userGrowth,
        correctGrowth,
      });

  let concept: string | null = null;
  if (correctGrowth) {
    concept = `Concept to review: ${correctGrowth.meaning}.`;
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

/**
 * Short paragraph for in-quiz review mode (shown right after answering).
 */
export function formatImmediateQuizFeedback(args: {
  correct: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation?: string | null;
  topic?: string | null;
}): string {
  const feedback = buildQuizResultFeedback(args);
  if (args.correct) {
    return feedback.whyCorrect;
  }
  const parts = [feedback.whyWrong, feedback.whyCorrect].filter(Boolean);
  return parts.join(' ');
}

/**
 * Practical Review Next reason from the learner's actual wrong pick.
 */
export function buildWeakTopicMisconceptionReason(args: {
  topic: string;
  missCount: number;
  userAnswer?: string | null;
  correctAnswer?: string | null;
}): string {
  const topic = args.topic.trim();
  const userAnswer = args.userAnswer?.trim() || '';
  const correctAnswer = args.correctAnswer?.trim() || '';

  if (userAnswer && correctAnswer) {
    const userGrowth = growthMeaning(userAnswer);
    const correctGrowth = growthMeaning(correctAnswer);
    if (
      userGrowth &&
      correctGrowth &&
      userGrowth.label !== correctGrowth.label
    ) {
      if (correctGrowth.label === '1' && userGrowth.label === 'n') {
        return (
          'You confused constant growth with linear growth. Constant growth ' +
          'stays the same as input size grows, while linear growth increases with n.'
        );
      }
      return (
        `You confused ${correctGrowth.meaning.split('—')[0]!.trim()} ` +
        `with ${userGrowth.meaning.split('—')[0]!.trim()}. ` +
        `Review what “${correctAnswer}” means versus “${userAnswer}”.`
      );
    }

    if (
      /formula|equation|calculation/i.test(userAnswer) &&
      /algorithm|sequence|process|step/i.test(correctAnswer)
    ) {
      return `You confused an algorithm with a formula. Review how algorithms describe a complete step-by-step process, not just a single calculation.`;
    }

    return `You mixed up “${userAnswer}” with “${correctAnswer}” on ${topic}. Review what makes the correct idea different.`;
  }

  if (args.missCount <= 1) {
    return `You missed a question on “${topic}”. Review that concept, then try a similar question again.`;
  }

  return `You missed ${args.missCount} questions on “${topic}” — your weakest topic this run. Focus a short review there before retrying.`;
}
