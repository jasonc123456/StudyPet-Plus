/**
 * Deterministic tutor fallback + display adapters for quiz feedback.
 *
 * Live AI feedback lives in `src/lib/ai/quiz-feedback.ts`. This module:
 * - Provides a concise non-template fallback when AI is unavailable
 * - Salvages shallow stored explanations at display time
 * - Maps tutor fields into ResultRow-friendly shapes
 */

export type TutorFeedback = {
  hint: string;
  whyCorrect: string;
  whySelectedMisses: string | null;
  conceptToReview: string;
  reviewNextReason: string;
};

export type QuizResultFeedback = {
  verdict: string;
  whyCorrect: string;
  whyWrong: string | null;
  concept: string | null;
};

const SHALLOW_PHRASE_RE =
  /\b(?:common\s+mix[- ]?up|source\s+material|the\s+notes?\s+(?:say|state|states|says|define|defines|list|lists|mention|mentions|identify|identifies)|according\s+to\s+the\s+(?:notes?|source)|concept\s+this\s+question\s+is\s+testing|points?\s+at\s+a\s+related\s+idea|best\s+(?:choice|match)|that\s+is\s+why\b|correct\s+choice\s+is|identifies\s+.+\s+as\b|listed\s+as\b)\b/i;

const CITATION_LEAD_RE =
  /^(?:the\s+(?:notes?|source(?:\s+material)?)\s+(?:explicitly\s+|directly\s+)?(?:define|list|state|say|mention|show|describe|call|identify|identifies)|according\s+to\s+the\s+(?:notes?|source)|as\s+(?:stated|listed|mentioned|defined)\s+in\s+the\s+notes?)\b[,:]?\s*/i;

const CITATION_INLINE_RE =
  /\b(?:the\s+notes?\s+(?:explicitly\s+|directly\s+)?(?:define|list|state|say|mention|show|describe|call|identify|identifies)|according\s+to\s+the\s+(?:notes?|source)|the\s+source(?:\s+material)?\s+(?:states?|says?|lists?|defines?|identifies?)|per\s+the\s+(?:notes?|source))\b[,:]?\s*/gi;

export function isShallowTeachingText(
  text: string | null | undefined
): boolean {
  const raw = (text ?? '').trim();
  if (!raw) return true;
  if (SHALLOW_PHRASE_RE.test(raw)) return true;
  if (CITATION_LEAD_RE.test(raw)) return true;
  const stripped = stripCitationPhrases(raw);
  return stripped.length < 28;
}

function stripCitationPhrases(explanation: string): string {
  return explanation
    .replace(CITATION_LEAD_RE, '')
    .replace(CITATION_INLINE_RE, '')
    .replace(
      /\b(?:source\s+material|the\s+notes?)\s+(?:identifies?|defines?|lists?|states?|says?)\s+/gi,
      ''
    )
    .replace(/\bas\s+a\s+mathematical\s+representation\s+for\b/gi, 'represents')
    .replace(/\s{2,}/g, ' ')
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

function firstSentence(text: string, maxLen = 180): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const split = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  if (split.length <= maxLen) return split;
  return `${split.slice(0, maxLen - 1).trim()}…`;
}

/** Compact meaning cues for common CS notation — short, not essay-like. */
const NOTATION: Array<{ match: RegExp; cue: string }> = [
  {
    match: /^(?:o?\(?\s*)?1(?:\s*\)?)?$|^constant(?:\s+growth)?$/i,
    cue: 'constant growth (stays the same as n grows)',
  },
  {
    match: /^(?:o?\(?\s*)?n(?:\s*\)?)?$|^linear(?:\s+growth)?$/i,
    cue: 'linear growth (scales in proportion to n)',
  },
  {
    match: /^(?:o?\(?\s*)?(?:n\^?2|n²)(?:\s*\)?)?$|^quadratic(?:\s+growth)?$/i,
    cue: 'quadratic growth (scales with n²)',
  },
  {
    match:
      /^(?:o?\(?\s*)?(?:log\s*n|lg\s*n)(?:\s*\)?)?$|^logarithmic(?:\s+growth)?$/i,
    cue: 'logarithmic growth (grows slowly as log n)',
  },
  {
    match:
      /^(?:o?\(?\s*)?n\s*log\s*n(?:\s*\)?)?$|^linearithmic(?:\s+growth)?$/i,
    cue: 'linearithmic growth (n log n has an extra n factor)',
  },
  {
    match:
      /^(?:o?\(?\s*)?(?:[a-z]|[2-9]|10)\s*\^\s*n(?:\s*\)?)?$|^exponential(?:\s+growth)?$/i,
    cue: 'exponential growth (multiplies by a constant as n increases)',
  },
];

function notationCue(answer: string): string | null {
  const cleaned = answer.trim();
  for (const entry of NOTATION) {
    if (entry.match.test(cleaned)) return entry.cue;
  }
  return null;
}

function salvageExplanation(
  explanation: string | null | undefined
): string | null {
  const raw = (explanation ?? '').trim();
  if (!raw || isShallowTeachingText(raw)) return null;
  const cleaned = stripCitationPhrases(raw);
  if (!cleaned || isShallowTeachingText(cleaned)) return null;
  return ensurePeriod(sentenceCase(firstSentence(cleaned, 220)));
}

/** Clean one stored per-choice rationale, or null if it's empty/too shallow. */
function salvageStoredRationale(
  text: string | null | undefined
): string | null {
  const raw = (text ?? '').trim();
  if (!raw || isShallowTeachingText(raw)) return null;
  const cleaned = stripCitationPhrases(raw);
  if (!cleaned || isShallowTeachingText(cleaned)) return null;
  return ensurePeriod(sentenceCase(firstSentence(cleaned, 240)));
}

/**
 * Normalize AI-generated per-choice rationales into an array aligned to
 * `choices` for storage: exactly `choices.length` entries, empty string at the
 * correct index and wherever the model gave missing or too-shallow text. Empty
 * slots let the reader fall back to deterministic feedback at display time.
 */
export function normalizeChoiceRationales(
  rationales: string[] | null | undefined,
  choices: string[],
  correctIndex: number
): string[] {
  return choices.map((_, i) => {
    if (i === correctIndex) return '';
    return salvageStoredRationale((rationales ?? [])[i]) ?? '';
  });
}

/**
 * Assemble tutor feedback for one question entirely from stored fields — no
 * live AI call. Uses the precomputed `choiceRationales[selectedIndex]` for
 * "why your answer misses", falling back to deterministic text when a slot is
 * empty (older quizzes generated before rationales existed).
 */
export function buildStoredTutorFeedback(args: {
  question: string;
  choices: string[];
  selectedIndex?: number;
  correctIndex: number;
  topic?: string | null;
  explanation?: string | null;
  choiceRationales?: string[] | null;
  correct: boolean;
}): TutorFeedback {
  const selectedAnswer =
    args.selectedIndex !== undefined &&
    args.selectedIndex >= 0 &&
    args.selectedIndex < args.choices.length
      ? (args.choices[args.selectedIndex] ?? null)
      : null;

  const base = buildFallbackTutorFeedback({
    question: args.question,
    choices: args.choices,
    selectedAnswer,
    correctAnswer: args.choices[args.correctIndex] ?? '',
    topic: args.topic,
    correct: args.correct,
    purpose: 'feedback',
    explanation: args.explanation,
  });

  if (args.correct || args.selectedIndex === undefined) return base;

  const stored = salvageStoredRationale(
    (args.choiceRationales ?? [])[args.selectedIndex]
  );
  return stored ? { ...base, whySelectedMisses: stored } : base;
}

/**
 * Concise deterministic tutor feedback (AI fallback only).
 * Short sentences. No banned citation/template phrases.
 */
export function buildFallbackTutorFeedback(args: {
  question: string;
  choices: string[];
  selectedAnswer?: string | null;
  correctAnswer: string;
  topic?: string | null;
  correct?: boolean | null;
  purpose?: 'hint' | 'feedback' | 'both';
  explanation?: string | null;
}): TutorFeedback {
  const topic = args.topic?.trim() || 'This topic';
  const correctAnswer = args.correctAnswer.trim();
  const selected = (args.selectedAnswer ?? '').trim();
  const correctCue = notationCue(correctAnswer);
  const selectedCue = selected ? notationCue(selected) : null;
  const salvaged = salvageExplanation(args.explanation);

  const hint = (() => {
    if (
      /growth|asymptot|complexit|big[- ]?o|runtime/i.test(
        `${topic} ${args.question}`
      )
    ) {
      return ensurePeriod(
        'Compare how each expression changes as n gets larger'
      );
    }
    return ensurePeriod(
      `Focus on what “${topic}” really requires, then match that idea to a choice`
    );
  })();

  const whyCorrect = salvaged
    ? salvaged
    : correctCue
      ? ensurePeriod(`“${correctAnswer}” fits because it means ${correctCue}`)
      : ensurePeriod(
          `“${correctAnswer}” captures the idea asked by this question`
        );

  let whySelectedMisses: string | null = null;
  if (args.correct === false && selected && selected !== 'No answer') {
    if (selectedCue && correctCue && selectedCue !== correctCue) {
      whySelectedMisses = ensurePeriod(
        `“${selected}” means ${selectedCue}. “${correctAnswer}” means ${correctCue}`
      );
    } else if (
      /formula|equation|calculation/i.test(selected) &&
      /algorithm|sequence|step|process/i.test(correctAnswer)
    ) {
      whySelectedMisses = ensurePeriod(
        `A formula computes a value. An algorithm is a full step-by-step process from input to output`
      );
    } else {
      whySelectedMisses = ensurePeriod(
        `“${selected}” points to a nearby idea. “${correctAnswer}” matches the definition more precisely`
      );
    }
  } else if (
    args.correct === false &&
    (!selected || selected === 'No answer')
  ) {
    whySelectedMisses =
      'No answer was selected, so this question was marked incorrect.';
  }

  const reviewNextReason =
    args.correct === false && selected && selectedCue && correctCue
      ? ensurePeriod(
          `You confused ${selectedCue} with ${correctCue}. Review that difference`
        )
      : args.correct === false
        ? ensurePeriod(
            `Review “${topic}” and how “${correctAnswer}” differs from your choice`
          )
        : ensurePeriod(
            `You answered this well. A quick refresh on “${topic}” still helps`
          );

  return {
    hint,
    whyCorrect,
    whySelectedMisses,
    conceptToReview: topic,
    reviewNextReason,
  };
}

export function tutorToResultFeedback(
  feedback: TutorFeedback,
  correct: boolean
): QuizResultFeedback {
  return {
    verdict: correct ? 'Correct' : 'Not quite',
    whyCorrect: feedback.whyCorrect,
    whyWrong: correct ? null : feedback.whySelectedMisses,
    concept: correct ? null : `Concept to review: ${feedback.conceptToReview}.`,
  };
}

/** Build structured review feedback (prefers stored explanation, else fallback). */
export function buildQuizResultFeedback(args: {
  correct: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation?: string | null;
  topic?: string | null;
  question?: string | null;
  choices?: string[];
}): QuizResultFeedback {
  const tutor = buildFallbackTutorFeedback({
    question: args.question ?? '',
    choices: args.choices ?? [],
    selectedAnswer: args.userAnswer,
    correctAnswer: args.correctAnswer,
    topic: args.topic,
    correct: args.correct,
    purpose: 'feedback',
    explanation: args.explanation,
  });
  return tutorToResultFeedback(tutor, args.correct);
}

export function formatImmediateQuizFeedback(args: {
  correct: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation?: string | null;
  topic?: string | null;
  question?: string | null;
  choices?: string[];
}): string {
  const feedback = buildQuizResultFeedback(args);
  if (args.correct) return `Correct — ${feedback.whyCorrect}`;
  return ['Not quite.', feedback.whyWrong, feedback.whyCorrect]
    .filter(Boolean)
    .join(' ');
}

export function buildPracticeHint(args: {
  level: 1 | 2;
  storedHint?: string | null;
  choices: string[];
  correctIndex: number;
  topic?: string | null;
  question?: string | null;
}): string {
  const stored = normalizeGeneratedHint(args.storedHint);
  if (args.level === 1 && stored) return stored;

  const fallback = buildFallbackTutorFeedback({
    question: args.question ?? '',
    choices: args.choices,
    correctAnswer: args.choices[args.correctIndex] ?? '',
    topic: args.topic,
    correct: null,
    purpose: 'hint',
  });

  if (args.level === 1) return fallback.hint;

  const withCues = args.choices
    .map((choice) => ({ choice, cue: notationCue(choice) }))
    .filter((row) => row.cue);
  if (withCues.length >= 2) {
    const a = withCues[0]!;
    const b = withCues[1]!;
    return ensurePeriod(
      `Compare “${a.choice}” and “${b.choice}”. Notice how ${a.cue} differs from ${b.cue}`
    );
  }
  return ensurePeriod(
    `Compare your top two options and ask which one fully matches “${args.topic?.trim() || 'the concept'}”`
  );
}

export function normalizeGeneratedHint(
  hint: string | null | undefined
): string {
  const raw = (hint ?? '').trim();
  if (!raw) return '';
  if (
    /\b(the\s+)?answer\s+is\b/i.test(raw) ||
    /\bcorrect\s+choice\s+is\b/i.test(raw) ||
    isShallowTeachingText(raw)
  ) {
    return ensurePeriod(
      'Compare how the options differ in meaning before you choose'
    );
  }
  return ensurePeriod(sentenceCase(stripCitationPhrases(raw)));
}

export function normalizeGeneratedExplanation(
  explanation: string | null | undefined,
  correctAnswer: string,
  opts?: { question?: string | null; topic?: string | null }
): string {
  const salvaged = salvageExplanation(explanation);
  if (salvaged) return salvaged;
  return buildFallbackTutorFeedback({
    question: opts?.question ?? '',
    choices: [],
    correctAnswer,
    topic: opts?.topic,
    correct: true,
    purpose: 'feedback',
  }).whyCorrect;
}

export function mergeTeachingExplanation(parts: {
  explanation?: string | null;
  misconception?: string | null;
  correctAnswer: string;
  question?: string | null;
  topic?: string | null;
}): string {
  const main = normalizeGeneratedExplanation(
    parts.explanation,
    parts.correctAnswer,
    { question: parts.question, topic: parts.topic }
  );
  const miss = (parts.misconception ?? '').trim();
  if (!miss || isShallowTeachingText(miss)) return main;
  const missClean = ensurePeriod(sentenceCase(stripCitationPhrases(miss)));
  if (!missClean || main.includes(missClean.slice(0, 40))) return main;
  // Keep stored text as two short sentences max.
  return `${firstSentence(main, 200)} ${firstSentence(missClean, 180)}`.trim();
}

export function buildWeakTopicMisconceptionReason(args: {
  topic: string;
  missCount: number;
  userAnswer?: string | null;
  correctAnswer?: string | null;
  question?: string | null;
}): string {
  const topic = args.topic.trim();
  const userAnswer = args.userAnswer?.trim() || '';
  const correctAnswer = args.correctAnswer?.trim() || '';

  if (userAnswer && correctAnswer) {
    return buildFallbackTutorFeedback({
      question: args.question ?? '',
      choices: [],
      selectedAnswer: userAnswer,
      correctAnswer,
      topic,
      correct: false,
      purpose: 'feedback',
    }).reviewNextReason;
  }

  if (args.missCount <= 1) {
    return ensurePeriod(
      `You missed a question on “${topic}”. Review that concept with one concrete example`
    );
  }
  return ensurePeriod(
    `You missed ${args.missCount} questions on “${topic}”. Focus a short review there next`
  );
}
