/**
 * Tutor-style quiz feedback for Review / Practice / Exam + Review Next.
 *
 * Goals:
 * - Prefer concept reasoning over citation or template phrasing
 * - Compare the learner's pick with the correct answer using real meaning
 * - Work for any topic generated from notes (not only growth-family cases)
 * - Salvage old shallow DB explanations at display time when possible
 */

export type QuizResultFeedback = {
  verdict: string;
  whyCorrect: string;
  whyWrong: string | null;
  concept: string | null;
};

// ---------------------------------------------------------------------------
// Quality guard — catch shallow / citation / template language
// ---------------------------------------------------------------------------

const SHALLOW_PHRASE_RE =
  /\b(?:common\s+mix[- ]?up|source\s+material|the\s+notes?\s+(?:say|state|states|says|define|defines|list|lists|mention|mentions|identify|identifies|identify)|according\s+to\s+the\s+(?:notes?|source)|concept\s+this\s+question\s+is\s+testing|points?\s+at\s+a\s+related\s+idea|best\s+(?:choice|match)|that\s+is\s+why\b[^.]*best\s+choice|correct\s+choice\s+is|identifies\s+.+\s+as\b|listed\s+as\b|as\s+stated\s+in\s+the\s+notes?)\b/i;

const CITATION_LEAD_RE =
  /^(?:the\s+(?:notes?|source(?:\s+material)?)\s+(?:explicitly\s+|directly\s+)?(?:define|list|state|say|mention|show|describe|call|identify|identifies)|according\s+to\s+the\s+(?:notes?|source)|as\s+(?:stated|listed|mentioned|defined)\s+in\s+the\s+notes?|per\s+the\s+(?:notes?|source)|in\s+(?:your\s+)?notes)\b[,:]?\s*/i;

const CITATION_INLINE_RE =
  /\b(?:the\s+notes?\s+(?:explicitly\s+|directly\s+)?(?:define|list|state|say|mention|show|describe|call|identify|identifies)|according\s+to\s+the\s+(?:notes?|source)|the\s+source(?:\s+material)?\s+(?:states?|says?|lists?|defines?|identifies?)|per\s+the\s+(?:notes?|source)|in\s+(?:your\s+)?notes)\b[,:]?\s*/gi;

/** True when text is mostly citation / template filler rather than teaching. */
export function isShallowTeachingText(
  text: string | null | undefined
): boolean {
  const raw = (text ?? '').trim();
  if (!raw) return true;
  if (SHALLOW_PHRASE_RE.test(raw)) return true;
  if (CITATION_LEAD_RE.test(raw)) return true;

  const stripped = stripCitationPhrases(raw);
  if (stripped.length < 28) return true;

  // Definition dumps that only rename without reasoning.
  if (
    /^(?:the\s+)?(?:correct\s+)?(?:answer|choice)\s+is\b/i.test(stripped) &&
    stripped.length < 80
  ) {
    return true;
  }

  return false;
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

function firstClause(text: string, maxLen = 160): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const split = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  if (split.length <= maxLen) return split;
  return `${split.slice(0, maxLen - 1).trim()}…`;
}

// ---------------------------------------------------------------------------
// Answer meaning interpreter (topic-agnostic toolbox)
// ---------------------------------------------------------------------------

type AnswerMeaning = {
  label: string;
  summary: string;
  /** Short contrast phrase used in Review Next. */
  contrastCue: string;
};

/** Notation / family glossary — one tool among several, not the only path. */
const NOTATION_GLOSSARY: Array<{
  match: RegExp;
  label: string;
  summary: string;
  contrastCue: string;
}> = [
  {
    match: /^(?:o?\(?\s*)?1(?:\s*\)?)?$|^constant(?:\s+growth|\s+time)?$/i,
    label: 'constant (1)',
    summary:
      'constant growth: the amount of work stays the same even as the input size n increases',
    contrastCue: 'constant growth stays flat as n grows',
  },
  {
    match: /^(?:o?\(?\s*)?n(?:\s*\)?)?$|^linear(?:\s+growth|\s+time)?$/i,
    label: 'linear (n)',
    summary:
      'linear growth: work increases in direct proportion to the input size n',
    contrastCue: 'linear growth adds roughly proportional work as n grows',
  },
  {
    match:
      /^(?:o?\(?\s*)?(?:n\^?2|n²)(?:\s*\)?)?$|^quadratic(?:\s+growth|\s+time)?$/i,
    label: 'quadratic (n²)',
    summary:
      'quadratic growth: work increases with the square of the input size',
    contrastCue: 'quadratic growth scales with n²',
  },
  {
    match:
      /^(?:o?\(?\s*)?(?:n\^?3|n³)(?:\s*\)?)?$|^cubic(?:\s+growth|\s+time)?$/i,
    label: 'cubic (n³)',
    summary: 'cubic growth: work grows with the cube of the input size',
    contrastCue: 'cubic growth scales with n³',
  },
  {
    match:
      /^(?:o?\(?\s*)?(?:log\s*n|lg\s*n)(?:\s*\)?)?$|^logarithmic(?:\s+growth|\s+time)?$/i,
    label: 'logarithmic (log n)',
    summary:
      'logarithmic growth: work grows slowly as input size increases (written log n)',
    contrastCue: 'logarithmic growth rises slowly via log n',
  },
  {
    match:
      /^(?:o?\(?\s*)?n\s*log\s*n(?:\s*\)?)?$|^linearithmic(?:\s+growth|\s+time)?$/i,
    label: 'linearithmic (n log n)',
    summary:
      'linearithmic growth: roughly linear work repeated across logarithmic levels (written n log n)',
    contrastCue: 'linearithmic growth uses an extra n factor on top of log n',
  },
  {
    match:
      /^(?:o?\(?\s*)?(?:[a-z]|[2-9]|10)\s*\^\s*n(?:\s*\)?)?$|^exponential(?:\s+growth|\s+time)?$/i,
    label: 'exponential (c^n)',
    summary:
      'exponential growth: the quantity repeatedly multiplies by a constant factor as n increases (written like c^n)',
    contrastCue:
      'exponential growth multiplies by a constant factor as n increases',
  },
];

type ConceptContrast = {
  left: RegExp;
  right: RegExp;
  leftSummary: string;
  rightSummary: string;
  compare: string;
};

/**
 * Reusable concept contrasts (definitions, not course-specific hardcodes).
 * Fired when the learner's pick matches one side and the correct pick the other.
 */
const CONCEPT_CONTRASTS: ConceptContrast[] = [
  {
    left: /formula|equation|expression|calculation|math formula/i,
    right: /algorithm|sequence of steps|step-by-step|process|procedure/i,
    leftSummary:
      'a formula or calculation — a mathematical expression that computes a value',
    rightSummary:
      'an algorithm — a precise, finite sequence of steps that takes input and produces output',
    compare:
      'A formula can appear inside an algorithm, but an algorithm is broader: it covers how input is handled, which operations run, and when the process stops',
  },
  {
    left: /program|code|software|implementation/i,
    right:
      /algorithm|sequence of steps|step-by-step|process|procedure|abstract/i,
    leftSummary:
      'a program — concrete code that implements an idea in a specific language',
    rightSummary:
      'an algorithm — the abstract step-by-step idea that can exist before any code is written',
    compare:
      'A program implements an algorithm; the algorithm itself is the language-independent plan',
  },
  {
    left: /halt|stop|terminate|termination/i,
    right: /input|output|transform|sequence|finite sequence|precise steps/i,
    leftSummary: 'halting / termination — that the process eventually stops',
    rightSummary:
      'the broader definition of an algorithm as a complete process that transforms input into output through precise steps',
    compare:
      'Halting matters, but it is only one property — the question asks for the fuller definition of the process',
  },
];

function glossaryMeaning(answer: string): AnswerMeaning | null {
  const cleaned = answer.trim();
  for (const entry of NOTATION_GLOSSARY) {
    if (entry.match.test(cleaned)) {
      return {
        label: entry.label,
        summary: entry.summary,
        contrastCue: entry.contrastCue,
      };
    }
  }
  return null;
}

function findConceptContrast(
  userAnswer: string,
  correctAnswer: string
): {
  userSummary: string;
  correctSummary: string;
  compare: string;
} | null {
  for (const pair of CONCEPT_CONTRASTS) {
    if (pair.left.test(userAnswer) && pair.right.test(correctAnswer)) {
      return {
        userSummary: pair.leftSummary,
        correctSummary: pair.rightSummary,
        compare: pair.compare,
      };
    }
    if (pair.right.test(userAnswer) && pair.left.test(correctAnswer)) {
      return {
        userSummary: pair.rightSummary,
        correctSummary: pair.leftSummary,
        compare: pair.compare,
      };
    }
  }
  return null;
}

/**
 * Infer a practical meaning for an answer choice using glossary, contrast cues,
 * question stem, and the choice text itself — works for any topic.
 */
function interpretAnswer(
  answer: string,
  context?: { question?: string | null; topic?: string | null }
): AnswerMeaning {
  const trimmed = answer.trim();
  if (!trimmed || trimmed === 'No answer') {
    return {
      label: 'no answer',
      summary: 'no selection was made',
      contrastCue: 'selecting an answer',
    };
  }

  const glossary = glossaryMeaning(trimmed);
  if (glossary) return glossary;

  // Short label-like choices: lean on the words themselves as the concept name.
  if (trimmed.length <= 48 && !/[.?!]/.test(trimmed)) {
    const topic = context?.topic?.trim();
    const question = context?.question?.trim() ?? '';
    const aboutGrowth = /growth|asymptot|complexit|big[- ]?o|runtime/i.test(
      `${topic ?? ''} ${question}`
    );
    if (aboutGrowth) {
      return {
        label: trimmed,
        summary: `the “${trimmed}” growth/complexity idea`,
        contrastCue: `what “${trimmed}” means as n grows`,
      };
    }
    return {
      label: trimmed,
      summary: `the idea labeled “${trimmed}”`,
      contrastCue: `what “${trimmed}” actually means`,
    };
  }

  // Longer definition-style answers: use the content as the explanation.
  return {
    label: firstClause(trimmed, 60),
    summary: firstClause(trimmed, 180),
    contrastCue: firstClause(trimmed, 80),
  };
}

function extractUsableTeaching(
  explanation: string | null | undefined,
  correctAnswer: string
): string | null {
  const raw = (explanation ?? '').trim();
  if (!raw) return null;

  let cleaned = stripCitationPhrases(raw);

  // “identifies X as Y” → “X is Y”
  cleaned = cleaned.replace(
    /^["'“]?([^"'”]+?)["'”]?\s+(?:as|for)\s+/i,
    (_m, subject: string) => `${sentenceCase(subject.trim())} is `
  );

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

  cleaned = cleaned
    .replace(/\bthat is why\b[^.]*$/i, '')
    .replace(
      /\b(?:this|that)\s+is\s+why\s+[“"][^”"]+[”"]\s+is\s+the\s+best\s+choice\.?/gi,
      ''
    )
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned || isShallowTeachingText(cleaned)) {
    // Try removing shallow sentences and keeping the rest.
    const sentences = raw
      .split(/(?<=[.!?])\s+/)
      .map((s) => stripCitationPhrases(s).trim())
      .filter((s) => s && !isShallowTeachingText(s));
    if (sentences.length === 0) return null;
    cleaned = sentences.join(' ');
  }

  if (!cleaned || isShallowTeachingText(cleaned)) return null;

  // Avoid ending on a bare “best choice” slogan.
  cleaned = cleaned
    .replace(/\s*That is why [“"].+[”"] is the best choice\.?$/i, '')
    .trim();

  if (!cleaned) return null;
  return ensurePeriod(sentenceCase(cleaned));
}

// ---------------------------------------------------------------------------
// Teach: why correct / why wrong (generic)
// ---------------------------------------------------------------------------

function isThinTeaching(text: string, correctAnswer: string): boolean {
  const cleaned = text.trim();
  if (cleaned.length < 100) {
    if (/represents the .+ (?:family|concept|idea)\.?$/i.test(cleaned)) {
      return true;
    }
    const words = cleaned.split(/\s+/).length;
    if (
      words < 14 &&
      cleaned.toLowerCase().includes(correctAnswer.trim().toLowerCase())
    ) {
      return true;
    }
  }
  return false;
}

function buildWhyCorrect(args: {
  correctAnswer: string;
  userAnswer: string;
  explanation: string;
  question?: string | null;
  topic?: string | null;
  choices?: string[];
}): string {
  const correctMeaning = interpretAnswer(args.correctAnswer, args);
  const teaching = extractUsableTeaching(args.explanation, args.correctAnswer);
  const glossary = glossaryMeaning(args.correctAnswer);

  if (
    teaching &&
    !isShallowTeachingText(teaching) &&
    !isThinTeaching(teaching, args.correctAnswer)
  ) {
    return teaching;
  }

  if (glossary) {
    return ensurePeriod(
      `“${args.correctAnswer}” represents ${glossary.summary}`
    );
  }

  const contrast = findConceptContrast(args.userAnswer, args.correctAnswer);
  if (contrast) {
    return ensurePeriod(
      `The correct idea is ${contrast.correctSummary}. ${contrast.compare}`
    );
  }

  // Prefer a salvaged thin line over inventing nothing, then enrich.
  if (teaching && !isShallowTeachingText(teaching)) {
    return ensurePeriod(
      `${teaching.replace(/\.$/, '')} — in practice, that means ${correctMeaning.summary}`
    );
  }

  const topic = args.topic?.trim();
  if (topic) {
    return ensurePeriod(
      `“${args.correctAnswer}” is the right fit for ${topic}: ${correctMeaning.summary}`
    );
  }

  return ensurePeriod(
    `“${args.correctAnswer}” works here because it captures ${correctMeaning.summary}`
  );
}

function buildWhyWrong(args: {
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  question?: string | null;
  topic?: string | null;
}): string | null {
  const { userAnswer, correctAnswer } = args;

  if (userAnswer === 'No answer') {
    return 'You did not select an answer for this question, so it was counted incorrect.';
  }

  const userMeaning = interpretAnswer(userAnswer, args);
  const correctMeaning = interpretAnswer(correctAnswer, args);

  const userGlossary = glossaryMeaning(userAnswer);
  const correctGlossary = glossaryMeaning(correctAnswer);
  if (
    userGlossary &&
    correctGlossary &&
    userGlossary.label !== correctGlossary.label
  ) {
    // Compare growth / notation families with intuition (including exponential).
    if (
      userGlossary.label.includes('linear') &&
      correctGlossary.label.includes('exponential')
    ) {
      return ensurePeriod(
        `“${userAnswer}” represents linear growth because the amount of work grows in direct proportion to the input size. Exponential growth is written like c^n because the value repeatedly multiplies by a constant factor as n increases, which grows much faster than linear growth`
      );
    }
    if (
      userGlossary.label.includes('logarithmic') &&
      correctGlossary.label.includes('linearithmic')
    ) {
      return ensurePeriod(
        `Logarithmic growth is written as log n, where the work grows slowly as the input size increases. n log n has an extra n factor, meaning there is roughly linear work repeated across logarithmic levels, so it belongs to the linearithmic family — not purely logarithmic`
      );
    }
    if (
      userGlossary.label.includes('linear (n)') &&
      correctGlossary.label.includes('constant')
    ) {
      return ensurePeriod(
        `“${userAnswer}” is linear growth — work scales with n. Constant growth stays the same even as n increases, so it is written as 1 rather than n`
      );
    }

    return ensurePeriod(
      `“${userAnswer}” means ${userGlossary.summary}, while the question needed ${correctGlossary.summary}. Those behave differently as n grows, so they are not interchangeable`
    );
  }

  const contrast = findConceptContrast(userAnswer, correctAnswer);
  if (contrast) {
    return ensurePeriod(
      `Your answer points to ${contrast.userSummary}. ${contrast.compare}`
    );
  }

  // Try to pull a contrast sentence from a good stored explanation.
  const teaching = extractUsableTeaching(args.explanation, correctAnswer);
  if (teaching && teaching.length > 60) {
    return ensurePeriod(
      `“${userAnswer}” does not capture the idea asked here (${userMeaning.summary}). ${firstClause(teaching, 220)}`
    );
  }

  const topic = args.topic?.trim();
  if (topic) {
    return ensurePeriod(
      `“${userAnswer}” reflects ${userMeaning.summary}, but “${topic}” here hinges on ${correctMeaning.summary} — which is what “${correctAnswer}” expresses`
    );
  }

  return ensurePeriod(
    `“${userAnswer}” reflects ${userMeaning.summary}. The question instead asks for ${correctMeaning.summary}, which is why “${correctAnswer}” is the better fit`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Clean / salvage an explanation before persisting a newly generated quiz.
 * Does not invent a full tutor paragraph without question context — that
 * happens at display time via buildQuizResultFeedback.
 */
export function normalizeGeneratedExplanation(
  explanation: string | null | undefined,
  correctAnswer: string,
  opts?: {
    question?: string | null;
    topic?: string | null;
  }
): string {
  const teaching = extractUsableTeaching(explanation, correctAnswer);
  const glossary = glossaryMeaning(correctAnswer);

  if (
    teaching &&
    !isShallowTeachingText(teaching) &&
    !isThinTeaching(teaching, correctAnswer)
  ) {
    return teaching;
  }

  if (glossary) {
    return ensurePeriod(`“${correctAnswer}” represents ${glossary.summary}`);
  }

  if (teaching && !isShallowTeachingText(teaching)) {
    const meaning = interpretAnswer(correctAnswer, opts);
    return ensurePeriod(
      `${teaching.replace(/\.$/, '')} — in practice, that means ${meaning.summary}`
    );
  }

  const meaning = interpretAnswer(correctAnswer, opts);
  return ensurePeriod(`“${correctAnswer}” represents ${meaning.summary}`);
}

/** Keep hints helpful but scrub explicit answer leaks. */
export function normalizeGeneratedHint(
  hint: string | null | undefined
): string {
  const raw = (hint ?? '').trim();
  if (!raw) return '';
  if (
    /\b(the\s+)?answer\s+is\b/i.test(raw) ||
    /\bcorrect\s+choice\s+is\b/i.test(raw) ||
    /\bpick\s+[“"]?[A-D]/i.test(raw)
  ) {
    return ensurePeriod(
      'Compare how each option differs in meaning — look for the detail that changes the category or definition'
    );
  }
  if (isShallowTeachingText(raw)) {
    return ensurePeriod(
      'Focus on the underlying definition or relationship, then match it to the option that captures the whole idea'
    );
  }
  return ensurePeriod(sentenceCase(stripCitationPhrases(raw)));
}

/**
 * Merge AI teaching pieces into one stored explanation (no schema migration).
 */
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
    {
      question: parts.question,
      topic: parts.topic,
    }
  );
  const miss = (parts.misconception ?? '').trim();
  if (!miss || isShallowTeachingText(miss)) return main;

  const missClean = ensurePeriod(sentenceCase(stripCitationPhrases(miss)));
  if (!missClean || main.includes(missClean.slice(0, 40))) return main;
  return `${main} ${missClean}`.trim();
}

/**
 * Structured tutor feedback for one question result (all modes).
 */
export function buildQuizResultFeedback(args: {
  correct: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation?: string | null;
  topic?: string | null;
  question?: string | null;
  choices?: string[];
}): QuizResultFeedback {
  const userAnswer = args.userAnswer.trim() || 'No answer';
  const correctAnswer = args.correctAnswer.trim();
  const rawExplanation = args.explanation?.trim() || '';
  const topic = args.topic?.trim() || null;

  const whyCorrect = buildWhyCorrect({
    correctAnswer,
    userAnswer,
    explanation: rawExplanation,
    question: args.question,
    topic,
    choices: args.choices,
  });

  const whyWrong = args.correct
    ? null
    : buildWhyWrong({
        userAnswer,
        correctAnswer,
        explanation: rawExplanation,
        question: args.question,
        topic,
      });

  const correctMeaning = interpretAnswer(correctAnswer, args);
  const concept = topic
    ? `Concept to review: ${topic} — focus on ${correctMeaning.contrastCue}.`
    : `Concept to review: ${correctMeaning.contrastCue}.`;

  if (args.correct) {
    return {
      verdict: 'Correct',
      whyCorrect,
      whyWrong: null,
      concept: topic ? `Concept: ${topic}.` : null,
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
 * Short paragraph for in-quiz Review / Practice after answering.
 */
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
  if (args.correct) {
    return `Correct — ${feedback.whyCorrect}`;
  }
  const parts = [
    feedback.whyWrong ? `Not quite. ${feedback.whyWrong}` : 'Not quite.',
    feedback.whyCorrect,
  ].filter(Boolean);
  return parts.join(' ');
}

/**
 * Layered Practice-mode hints that nudge without naming the answer.
 */
export function buildPracticeHint(args: {
  level: 1 | 2;
  storedHint?: string | null;
  choices: string[];
  correctIndex: number;
  topic?: string | null;
  question?: string | null;
}): string {
  const topic = args.topic?.trim() || 'this concept';
  const stored = normalizeGeneratedHint(args.storedHint);
  const question = args.question?.trim() ?? '';

  if (args.level === 1) {
    if (stored) return stored;

    if (
      /growth|asymptot|complexit|big[- ]?o|runtime/i.test(
        `${topic} ${question}`
      )
    ) {
      return ensurePeriod(
        'Compare how each expression changes when n gets bigger. Some grow by adding a steady amount; others multiply repeatedly or grow much more slowly'
      );
    }
    if (/algorithm|definition|means|what is/i.test(question)) {
      return ensurePeriod(
        `For “${topic}”, start from the definition — ask which option captures the whole idea, not just one related property`
      );
    }
    return ensurePeriod(
      `Focus on the core idea behind “${topic}” — what relationship or definition must be true for a choice to fit?`
    );
  }

  // Level 2: compare related options without naming which is correct.
  const meanings = args.choices.map((choice) => ({
    choice,
    meaning: glossaryMeaning(choice),
  }));
  const withMeaning = meanings.filter((row) => row.meaning);
  if (withMeaning.length >= 2) {
    const a = withMeaning[0]!;
    const b = withMeaning[1]!;
    return ensurePeriod(
      `Compare “${a.choice}” and “${b.choice}”: one ${a.meaning!.contrastCue}, the other ${b.meaning!.contrastCue}. That difference decides the category`
    );
  }

  const samples = args.choices
    .filter((_, i) => i !== args.correctIndex)
    .slice(0, 2);
  if (samples.length >= 1) {
    return ensurePeriod(
      `Line up the two options you find most plausible and ask: which detail would make one fit “${topic}” while the other only sounds related?`
    );
  }

  return ensurePeriod(
    `Eliminate choices that are related to “${topic}” but too narrow, too broad, or describing a neighboring idea`
  );
}

/**
 * Practical Review Next reason from the learner's actual wrong pick.
 */
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
    const userMeaning = interpretAnswer(userAnswer, {
      topic,
      question: args.question,
    });
    const correctMeaning = interpretAnswer(correctAnswer, {
      topic,
      question: args.question,
    });

    const userGlossary = glossaryMeaning(userAnswer);
    const correctGlossary = glossaryMeaning(correctAnswer);
    if (
      userGlossary &&
      correctGlossary &&
      userGlossary.label !== correctGlossary.label
    ) {
      if (
        userGlossary.label.includes('linear') &&
        correctGlossary.label.includes('exponential')
      ) {
        return 'You confused linear growth with exponential growth. Review how n grows by adding proportional work, while c^n grows by repeated multiplication.';
      }
      if (
        userGlossary.label.includes('logarithmic') &&
        correctGlossary.label.includes('linearithmic')
      ) {
        return 'You confused logarithmic growth with linearithmic growth. Focus on how adding an n factor changes log n into n log n.';
      }
      return (
        `You confused ${userGlossary.label} with ${correctGlossary.label}. ` +
        `Review how ${userGlossary.contrastCue} differs from ${correctGlossary.contrastCue}.`
      );
    }

    const contrast = findConceptContrast(userAnswer, correctAnswer);
    if (contrast) {
      return `You mixed up ${contrast.userSummary} with ${contrast.correctSummary}. ${contrast.compare}.`;
    }

    return (
      `You confused “${userAnswer}” with “${correctAnswer}” on ${topic}. ` +
      `Review how ${userMeaning.contrastCue} differs from ${correctMeaning.contrastCue}.`
    );
  }

  if (args.missCount <= 1) {
    return `You missed a question on “${topic}”. Review that concept with a concrete example, then try a similar question again.`;
  }

  return `You missed ${args.missCount} questions on “${topic}” — your weakest topic this run. Focus a short review there before retrying.`;
}
