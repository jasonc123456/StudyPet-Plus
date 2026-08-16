// Public AI generation API (US-3.2).
//
//   const { items, provider } = await generateFlashcards({ sourceText });
//   const { items, provider } = await generateQuiz({ sourceText });
//
// The self-hosted local LLM is primary whenever LOCAL_AI_BASE_URL is set and
// AI_DEMO_MODE !== "true". Gemini is the hosted fallback. Demo cards are returned
// ONLY when AI_DEMO_MODE === "true".

import { AI_NOT_CONFIGURED_MESSAGE, getAiRuntimeStatus } from '@/lib/ai/config';
import {
  AiProviderError,
  hasConfiguredProvider,
  runWithFallback,
  type JsonPrompt,
} from '@/lib/ai/provider';
import {
  flashcardResponseSchema,
  quizResponseSchema,
  type AiAttachment,
  type AiProviderName,
  type AiResult,
  type Flashcard,
  type GenerateFlashcardsInput,
  type GenerateQuizInput,
  type QuizQuestion,
} from '@/lib/ai/types';

const DEFAULT_COUNT = 8;
const MIN_COUNT = 1;
// Upper bound for a single generation request. Quizzes allow up to 50 questions;
// flashcard requests are separately capped lower by their request validator.
const MAX_COUNT = 50;
const MAX_SOURCE_CHARS = 12_000;

function clampCount(count: number | undefined): number {
  if (!count || !Number.isFinite(count)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.trunc(count)));
}

function prepareSource(text: string): string {
  return text.trim().slice(0, MAX_SOURCE_CHARS);
}

/**
 * The source-material section of a prompt. Uses the typed notes when present,
 * points at the attached document(s) when a PDF-backed note was chosen, and
 * describes both when the note has typed text *and* a PDF.
 */
function sourceSection(source: string, attachmentCount: number): string {
  const noteBlock = source ? `\n\nNOTES:\n"""\n${source}\n"""` : '';
  if (attachmentCount === 0) return noteBlock;

  const plural = attachmentCount === 1 ? '' : 's';
  const how = source
    ? 'them together with the notes above'
    : 'the attached document(s)';
  return (
    `${noteBlock}\n\nThe user also attached ${attachmentCount} document${plural} ` +
    `(e.g. a PDF). Read ${how} as the source material.`
  );
}

/**
 * Shared topic-tagging policy for cards and questions.
 *
 * Without this the model tags nearly every item with its own hyper-specific
 * topic ("Bogosort", "Bogosort Probability", "Bogosort Expectation", …), which
 * turns the deck/quiz browser into a wall of one-item categories. We ask for a
 * small number of broad themes, and hand back the topics this course already
 * uses so repeat generations land in the same buckets instead of spawning
 * near-duplicate ones.
 */
function topicPolicySection(
  count: number,
  topicHint?: string,
  existingTopics?: string[]
): string {
  // Guidance, not a cap: aim for ~3-4 items per topic so a student can tell
  // which area they're weak on, while still allowing a genuine one-off topic.
  const targetTopics = Math.max(1, Math.round(count / 3));
  const course = topicHint?.trim();
  const known = (existingTopics ?? [])
    .map((topic) => topic.trim())
    .filter(Boolean);

  const lines = [
    '\n\nTOPIC TAGGING GUIDANCE (important):',
    '- Topics exist so a student can see WHICH AREA they are weak on. A topic ' +
      'that holds a single item tells them nothing.',
    '- Group items under shared themes and reuse the same topic string across ' +
      `every item that belongs to it — roughly ${targetTopics} distinct topics ` +
      `for ${count} items is a good target, not a hard limit.`,
    '- A topic is a broad theme covering several items (e.g. "Sorting Algorithms", ' +
      '"Recurrences"), never a restatement of one item.',
    '- Do NOT split a theme into sibling tags such as "Bogosort", ' +
      '"Bogosort Probability" and "Bogosort Variants" — those are all "Bogosort" ' +
      'or, better, "Sorting Algorithms".',
    '- Use a one-item topic only when the material genuinely contains an ' +
      'unrelated one-off concept — that case is fine, just do not make it the norm.',
    '- Keep topics short (1-4 words), in Title Case.',
  ];

  if (course) {
    lines.push(
      `- Do NOT prefix topics with the course name or code ("${course}") — the ` +
        'course is already known. Tag the concept only.'
    );
  }

  if (known.length > 0) {
    lines.push(
      '- This course already uses the topics listed below. If an item fits one ' +
        'of them, reuse that EXACT string (same spelling and casing). Only ' +
        'invent a new topic when nothing here fits.',
      `  Existing topics: ${known.map((topic) => `"${topic}"`).join(', ')}`
    );
  }

  return lines.join('\n');
}

/** Collapse equivalent cards (same front+back, case/whitespace-insensitive). */
export function dedupeFlashcards(cards: Flashcard[]): Flashcard[] {
  const seen = new Set<string>();
  const unique: Flashcard[] = [];
  for (const card of cards) {
    const key = `${card.front.trim().toLowerCase()}::${card.back.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      topic: card.topic.trim(),
      front: card.front.trim(),
      back: card.back.trim(),
    });
  }
  return unique;
}

function providerDisplayName(provider: AiProviderName): string {
  if (provider === 'local') return 'StudyPet+ AI';
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'deepseek') return 'DeepSeek';
  return 'demo';
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

/**
 * Post-process a model-supplied topic: drop a leading course-code/name prefix
 * ("CSE-102-01: Bogosort" → "Bogosort") and snap onto an existing topic when it
 * differs only in case or punctuation, so the UI doesn't show two spellings of
 * the same category.
 */
function canonicalizeTopic(
  topic: string,
  topicHint?: string,
  existingTopics?: string[]
): string {
  let cleaned = topic.trim();

  const course = topicHint?.trim();
  if (course) {
    // "CSE-102-01: X", "CSE 102 — X", "CSE102-01 - X"
    const loose = course.replace(/[^a-z0-9]+/gi, '[^a-z0-9]*');
    cleaned = cleaned
      .replace(new RegExp(`^${loose}\\s*[:\\-–—]\\s*`, 'i'), '')
      .trim();
  }
  if (!cleaned) cleaned = topic.trim();

  const key = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const match = (existingTopics ?? []).find(
    (existing) =>
      existing
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim() === key
  );
  return match ?? cleaned;
}

function flashcardPrompt(
  source: string,
  count: number,
  topicHint?: string,
  attachments?: AiAttachment[],
  existingTopics?: string[]
): JsonPrompt {
  const hint = topicHint?.trim()
    ? ` The course/subject context is "${topicHint.trim()}" — use it only for topic tags when it fits the source.`
    : '';
  return {
    system:
      "You are a study assistant that turns a student's notes into concise, " +
      'accurate flashcards for exam review. Rules:\n' +
      '1. Use ONLY facts explicitly present in the provided source (notes and/or attached documents).\n' +
      '2. Never invent facts, definitions, or examples that are not in the source.\n' +
      '3. Do NOT create generic study-skill cards (spaced repetition, active recall, ' +
      'how flashcards work, meta-learning tips, or how to configure AI).\n' +
      '4. Each card must test a specific concept, term, formula, or fact from the source.\n' +
      '5. Respond with JSON only — no markdown fences or commentary.',
    user:
      `Create exactly ${count} flashcards from the source material.${hint}\n\n` +
      'Return a JSON object of this exact shape:\n' +
      '{ "cards": [ { "topic": string, "front": string, "back": string } ] }\n' +
      '- "topic": a broad theme shared by several cards (see the rules below).\n' +
      '- "front": a clear question or prompt about the source.\n' +
      '- "back": a concise answer drawn only from the source.\n' +
      '- Prefer variety across distinct facts; avoid near-duplicate cards.' +
      topicPolicySection(count, topicHint, existingTopics) +
      sourceSection(source, attachments?.length ?? 0),
    attachments,
  };
}

export async function generateFlashcards(
  input: GenerateFlashcardsInput
): Promise<AiResult<Flashcard>> {
  const source = prepareSource(input.sourceText);
  const count = clampCount(input.count);
  const attachments = input.attachments ?? [];

  if (!source && attachments.length === 0) {
    throw new Error('generateFlashcards: no source text or attachments');
  }

  const status = getAiRuntimeStatus();
  console.info('[ai] generateFlashcards start', {
    geminiConfigured: status.geminiConfigured,
    localConfigured: status.localConfigured,
    demoMode: status.demoMode,
    count,
  });

  // Demo when AI_DEMO_MODE === "true", or when the caller is not entitled to
  // spend provider credit (the shared public demo account). Never a silent
  // fallback for anyone else.
  if (status.demoMode || input.demoOnly) {
    console.warn('[ai] generateFlashcards selected provider=demo');
    return { items: demoFlashcards(count, input.topicHint), provider: 'demo' };
  }

  if (!hasConfiguredProvider()) {
    console.error('[ai] generateFlashcards missing API keys', {
      geminiConfigured: status.geminiConfigured,
      localConfigured: status.localConfigured,
      demoMode: status.demoMode,
    });
    throw new AiProviderError('gemini', AI_NOT_CONFIGURED_MESSAGE);
  }

  const run = await runWithFallback(
    flashcardPrompt(
      source,
      count,
      input.topicHint,
      attachments,
      input.existingTopics
    ),
    (value) => flashcardResponseSchema.safeParse(value).success,
    input.onProgress
  );

  const parsed = flashcardResponseSchema.parse(run.value);
  const cards = dedupeFlashcards(parsed.cards)
    .slice(0, count)
    .map((card) => ({
      ...card,
      topic: canonicalizeTopic(
        card.topic,
        input.topicHint,
        input.existingTopics
      ),
    }));

  if (cards.length === 0) {
    throw new AiProviderError(
      run.provider,
      'provider returned no usable flashcards after validation'
    );
  }

  console.info('[ai] generateFlashcards ok', {
    geminiConfigured: status.geminiConfigured,
    localConfigured: status.localConfigured,
    demoMode: status.demoMode,
    provider: run.provider,
    providerLabel: providerDisplayName(run.provider),
    cards: cards.length,
  });

  return { items: cards, provider: run.provider };
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

function quizPrompt(
  source: string,
  count: number,
  topicHint?: string,
  attachments?: AiAttachment[],
  existingTopics?: string[]
): JsonPrompt {
  const hint = topicHint?.trim()
    ? ` The course/subject context is "${topicHint.trim()}".`
    : '';
  return {
    system:
      'You are an AI tutor writing multiple-choice quiz questions from a ' +
      "student's notes and attachments. Teach concepts with reasoning and " +
      'practical intuition. Ground facts in the source, but NEVER justify an ' +
      'answer by citing the notes. Banned phrasing includes: "The notes say…", ' +
      '"The source material identifies…", "According to the source…", ' +
      '"This is a common mix-up…", "points at a related idea", and ' +
      '"the concept this question is testing". Respond with JSON only.',
    user:
      `Write ${count} multiple-choice questions from the study material.${hint}\n\n` +
      'Return a JSON object of the exact shape:\n' +
      '{ "questions": [ { "topic": string, "question": string, ' +
      '"choices": string[], "answerIndex": number, "explanation": string, ' +
      '"misconception": string, "choiceRationales": string[], "hint": string } ] }\n' +
      '- Provide 3-4 "choices" per question, exactly one correct.\n' +
      '- "answerIndex" is the 0-based index of the correct choice.\n' +
      '- "choiceRationales" is an array parallel to "choices" (same length, ' +
      'same order). For each WRONG choice, write 1 short sentence on why it is ' +
      'incorrect (reasoning, not citation). For the correct choice use "".\n' +
      '  * Good (wrong choice): "This mixes up linear and exponential growth."\n' +
      '  * No "notes say" / "source identifies" phrasing here either.\n' +
      '- "topic" is a broad concept tag shared by several questions ' +
      '(e.g. "Growth Families", "Algorithms") — see the rules below.\n' +
      '- "explanation" (2–3 short sentences) must TEACH:\n' +
      '  * Explain the concept in plain language with short sentences.\n' +
      '  * Say why the correct choice makes sense (reasoning, not citation).\n' +
      '  * Add practical intuition when helpful.\n' +
      '  * No run-on sentences. No "notes say" / "source identifies" phrasing.\n' +
      '  * Bad: "The source material identifies c^n as exponential growth."\n' +
      '  * Good: "Exponential growth is written c^n. The value multiplies by a ' +
      'constant factor as n increases. That grows much faster than linear n."\n' +
      '- "misconception" (1–2 short sentences): contrast a likely wrong choice.\n' +
      '- "hint" nudges without revealing the answer:\n' +
      '  * Good: "Compare how each expression changes when n gets bigger."\n' +
      '  * Bad: "The answer is c^n."' +
      topicPolicySection(count, topicHint, existingTopics) +
      sourceSection(source, attachments?.length ?? 0),
    attachments,
  };
}

export async function generateQuiz(
  input: GenerateQuizInput
): Promise<AiResult<QuizQuestion>> {
  const source = prepareSource(input.sourceText);
  const count = clampCount(input.count);
  const attachments = input.attachments ?? [];

  if (!source && attachments.length === 0) {
    throw new Error('generateQuiz: no source text or attachments');
  }

  const status = getAiRuntimeStatus();
  console.info('[ai] generateQuiz start', {
    geminiConfigured: status.geminiConfigured,
    localConfigured: status.localConfigured,
    demoMode: status.demoMode,
    count,
  });

  if (status.demoMode || input.demoOnly) {
    console.warn('[ai] generateQuiz selected provider=demo');
    return { items: demoQuiz(count, input.topicHint), provider: 'demo' };
  }

  if (!hasConfiguredProvider()) {
    console.error('[ai] generateQuiz missing API keys', {
      geminiConfigured: status.geminiConfigured,
      localConfigured: status.localConfigured,
      demoMode: status.demoMode,
    });
    throw new AiProviderError('gemini', AI_NOT_CONFIGURED_MESSAGE);
  }

  const run = await runWithFallback(
    quizPrompt(
      source,
      count,
      input.topicHint,
      attachments,
      input.existingTopics
    ),
    (value) => quizResponseSchema.safeParse(value).success,
    input.onProgress
  );

  const parsedQuiz = quizResponseSchema.parse(run.value);
  const questions = parsedQuiz.questions.map((question) => ({
    ...question,
    topic: canonicalizeTopic(
      question.topic,
      input.topicHint,
      input.existingTopics
    ),
  }));
  console.info('[ai] generateQuiz ok', {
    provider: run.provider,
    questions: questions.length,
  });
  return { items: questions.slice(0, count), provider: run.provider };
}

// ---------------------------------------------------------------------------
// Demo material — returned ONLY when AI_DEMO_MODE === "true".
// ---------------------------------------------------------------------------

function demoFlashcards(count: number, topicHint?: string): Flashcard[] {
  const topic = topicHint?.trim() || 'Demo';
  const base: Flashcard[] = [
    {
      topic,
      front: 'What is spaced repetition?',
      back: 'Reviewing material at increasing intervals to strengthen recall.',
    },
    {
      topic,
      front: 'Why turn notes into flashcards?',
      back: 'Active recall beats re-reading for long-term retention.',
    },
    {
      topic,
      front: '(Demo card) How do I get real cards?',
      back: 'Set LOCAL_AI_BASE_URL (or GEMINI_API_KEY) and AI_DEMO_MODE=false.',
    },
  ];
  return Array.from({ length: count }, (_, i) => base[i % base.length]);
}

function demoQuiz(count: number, topicHint?: string): QuizQuestion[] {
  const topic = topicHint?.trim() || 'Demo';
  const base: QuizQuestion[] = [
    {
      topic: topic === 'Demo' ? 'Study methods' : topic,
      question: 'Which study technique this quiz demonstrates?',
      choices: ['Cramming', 'Active recall', 'Highlighting', 'Re-reading'],
      answerIndex: 1,
      explanation:
        'Active recall means retrieving an answer from memory instead of ' +
        're-reading it. That retrieval practice strengthens long-term memory, ' +
        'unlike cramming or highlighting which feel familiar but check less.',
      misconception:
        'Cramming packs exposure into a short window, so it feels productive but does not strengthen retrieval the way active recall does.',
      choiceRationales: [
        'Cramming packs exposure into a short window but does not build durable retrieval.',
        '',
        'Highlighting marks text without forcing you to recall anything.',
        'Re-reading feels familiar but skips the retrieval that cements memory.',
      ],
      hint: 'Think about retrieving the answer from memory, not reviewing it.',
    },
    {
      topic: 'Growth Families',
      question: 'Which expression represents exponential growth?',
      choices: ['1', 'n', 'n log n', 'c^n'],
      answerIndex: 3,
      explanation:
        'Exponential growth is written like c^n because the quantity repeatedly ' +
        'multiplies by a constant factor as n increases. That grows much faster ' +
        'than linear growth, where work only increases in proportion to n.',
      misconception:
        'n represents linear growth: work grows by a roughly fixed amount per step in input size. It does not multiply by a constant factor the way c^n does.',
      choiceRationales: [
        '1 is constant — it never changes as n grows, so it is not growth at all.',
        'n is linear growth: it rises in proportion to n, not by repeated multiplication.',
        'n log n is linearithmic — faster than linear but far slower than exponential.',
        '',
      ],
      hint: 'Compare how each expression changes when n gets bigger. Linear growth adds a steady amount, while exponential growth repeatedly multiplies.',
    },
    {
      topic: 'Growth Families',
      question: 'Which growth family describes n log n?',
      choices: ['Constant', 'Logarithmic', 'Linearithmic', 'Quadratic'],
      answerIndex: 2,
      explanation:
        'n log n has an extra n factor on top of a logarithm. That means ' +
        'roughly linear work is repeated across logarithmic levels, so it ' +
        'belongs to the linearithmic family — not pure logarithmic growth ' +
        '(log n), which grows much more slowly.',
      misconception:
        'Logarithmic (log n) grows slowly; adding the n factor moves the expression into the linearithmic family.',
      choiceRationales: [
        'Constant work stays fixed regardless of n, so it cannot describe n log n.',
        'Logarithmic (log n) drops the n factor and grows far more slowly.',
        '',
        'Quadratic is n squared, which grows faster than the n log n here.',
      ],
      hint: 'Look carefully at every factor in the notation. log n and n log n are related, but the extra n changes the category.',
    },
    {
      topic: topic === 'Demo' ? 'Setup' : topic,
      question: '(Demo) How do you enable real AI quizzes?',
      choices: [
        'Nothing is needed',
        'Set an API key and AI_DEMO_MODE=false',
        'Restart your computer',
        'Upgrade Postgres',
      ],
      answerIndex: 1,
      explanation:
        'Real quiz generation needs a configured AI provider. Set ' +
        'LOCAL_AI_BASE_URL or GEMINI_API_KEY and turn AI_DEMO_MODE off so the ' +
        'app can call the model instead of returning canned demo questions.',
      choiceRationales: [
        'Some configuration is required — demo questions are canned until you set it.',
        '',
        'Restarting changes nothing; the app just needs a provider configured.',
        'The database version is unrelated to AI quiz generation.',
      ],
      hint: 'Think about software configuration rather than hardware changes.',
    },
  ];
  return Array.from({ length: count }, (_, i) => base[i % base.length]);
}
