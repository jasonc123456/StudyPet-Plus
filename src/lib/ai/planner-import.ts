// Course Planner Import v1 — separate from flashcard/quiz generation.
//
// Parses pasted / CSV / spreadsheet text into structured term + course drafts.
// Aggressively filters academic-form metadata so only likely planned courses
// (and short placeholders like "CS Elective") become draft rows.

import { getAiRuntimeStatus } from '@/lib/ai/config';
import {
  AiProviderError,
  hasConfiguredProvider,
  runWithFallback,
  type JsonPrompt,
} from '@/lib/ai/provider';
import type { AiProviderName } from '@/lib/ai/types';
import type {
  PlannerImportDraft,
  PlannerImportDraftCourse,
  PlannerImportDraftSection,
} from '@/lib/validators';
import { sanitizePlanImportText } from '@/lib/planner-import-file';
import { z } from 'zod';

const MAX_TITLE_LEN = 80;
const MAX_NOTES_LEN = 1000;

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const nullableUnits = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || num < 0 || num > 30) return null;
    return num;
  });

const courseTitleSchema = z
  .union([z.string().trim().min(1).max(150), z.null(), z.undefined()])
  .optional();

/** Loose AI row shape — accepts title/name and number/courseNumber. */
const aiCourseSchema = z
  .object({
    title: courseTitleSchema,
    name: courseTitleSchema,
    number: nullableString.optional(),
    courseNumber: nullableString.optional(),
    code: nullableString.optional(),
    units: nullableUnits.optional(),
    credits: nullableUnits.optional(),
    professor: nullableString.optional(),
    instructor: nullableString.optional(),
    lectureDays: nullableString.optional(),
    lectureTime: nullableString.optional(),
    lectureLocation: nullableString.optional(),
    notes: nullableString.optional(),
    isAlternate: z.boolean().optional(),
  })
  .transform((course, ctx) => {
    const title = (course.title ?? course.name ?? '').trim();
    if (!title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Course title is required',
      });
      return z.NEVER;
    }
    return {
      title,
      courseNumber: course.courseNumber ?? course.number ?? course.code ?? null,
      units: course.units ?? course.credits ?? null,
      professor: course.professor ?? course.instructor ?? null,
      lectureDays: course.lectureDays ?? null,
      lectureTime: course.lectureTime ?? null,
      lectureLocation: course.lectureLocation ?? null,
      notes: course.notes ?? null,
      isAlternate: course.isAlternate ?? false,
    } satisfies PlannerImportDraftCourse;
  });

/** Loose AI section shape — accepts title/label/term/name. */
const aiSectionSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    label: z.string().trim().min(1).max(100).optional(),
    term: z.string().trim().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    courses: z.array(aiCourseSchema).optional().default([]),
  })
  .transform((section, ctx) => {
    const label =
      section.label ?? section.title ?? section.term ?? section.name;
    if (!label) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Section title is required',
      });
      return z.NEVER;
    }
    return {
      label,
      courses: section.courses ?? [],
    } satisfies PlannerImportDraftSection;
  });

export const plannerImportAiResponseSchema = z.object({
  sections: z.array(aiSectionSchema).optional().default([]),
});

export type { PlannerImportDraft, PlannerImportDraftSection };
export type { PlannerImportDraftCourse };

export type PlannerImportStats = {
  keptCourses: number;
  ignoredRows: number;
};

export type PlannerImportResult = {
  draft: PlannerImportDraft;
  provider: AiProviderName | 'local-parser';
  stats: PlannerImportStats;
};

function prepareSource(text: string): string {
  return sanitizePlanImportText(text);
}

function emptyCourse(): Omit<PlannerImportDraftCourse, 'title'> {
  return {
    courseNumber: null,
    units: null,
    professor: null,
    lectureDays: null,
    lectureTime: null,
    lectureLocation: null,
    notes: null,
    isAlternate: false,
  };
}

function countDraftCourses(draft: PlannerImportDraft): number {
  return draft.sections.reduce(
    (total, section) => total + section.courses.length,
    0
  );
}

function buildStats(
  source: string,
  draft: PlannerImportDraft
): PlannerImportStats {
  const keptCourses = countDraftCourses(draft);
  const nonEmptyLines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^#\s*Sheet:/i.test(line)).length;
  const ignoredRows = Math.max(0, nonEmptyLines - keptCourses);
  return { keptCourses, ignoredRows };
}

// ---------------------------------------------------------------------------
// Course / metadata detection
// ---------------------------------------------------------------------------

/** Dept + number, e.g. CSE 102, CSE115A, MATH-19A, ECE 30 */
const COURSE_CODE_GLOBAL = /\b([A-Za-z]{2,8})\s*-?\s*(\d{1,4}[A-Za-z]{0,2})\b/g;

const TERM_NAMES = ['Fall', 'Winter', 'Spring', 'Summer'] as const;
type TermName = (typeof TERM_NAMES)[number];

const TERM_LINE =
  /^(fall|winter|spring|summer|autumn)\s+(?:quarter\s+|semester\s+)?(\d{4})\b/i;
const YEAR_FIRST_TERM = /^(\d{4})\s+(fall|winter|spring|summer|autumn)\b/i;
const SHEET_HEADER = /^#\s*Sheet:\s*(.+)$/i;
const UNITS_RE = /(\d+(?:\.\d+)?)\s*(?:units?|credits?|cr)\b/i;

/** Short planning placeholders that belong in the grid. */
const PLACEHOLDER_RE =
  /^(?:CS|CSE|CE|EE|ECE|MATH|STAT|PHYS|CHEM|BIO|AMS)?\s*(?:Elective|elective)(?:\s*#?\s*\d+(?:\s*of\s*\d+)?)?$|^(?:GE|DC|PR|EL|UD|WRIT(?:ing)?)\b(?:\s*(?:requirement|course|elective|#?\d+)){0,3}$|^(?:upper[- ]?division\s+)?(?:elective|writing|composition)\b|^TBD$|^TBA$|^transfer\s+credit$/i;

const BLOCKED_PHRASE_RE =
  /\b(?:academic\s+planning\s+form|student\s+id|office\s+use\s+only|do\s+not\s+delete(?:\s+row)?|graduation\s+requirements?|see\s+all\s+graduation|general\s+education|university\s+requirements?|academic\s+calendar|transfer\s+course\s+review|consider\s+as\s+you\s+plan|troubleshooting|advisor(?:'s)?\s+notes?|signature|approval|last\s+updated|expected\s+graduation|egt\b|major\s*[12]?|minor\s*[12]?|college\b|email\b|phone\b|date\b|print\s+name|department\s+chair|faculty\s+advisor|catalog\s+year|degree\s+audit|petitions?\b|waivers?\b)\b/i;

const BLOCKED_EXACT_RE =
  /^(?:name|student\s*id|email|college|major(?:\s*[12])?|minor(?:\s*[12])?|status|advisor|date|egt|office\s+use(?:\s+only)?|fall|winter|spring|summer|year|term|units?|credits?|course|class|title|code|notes?|total|subtotal|signature|approval)$/i;

const DEPT_ALLOWLIST = new Set(
  [
    'CSE',
    'CMPS',
    'CMPG',
    'CE',
    'EE',
    'ECE',
    'MATH',
    'STAT',
    'PHYS',
    'CHEM',
    'BIO',
    'BIOL',
    'AMS',
    'AM',
    'CMPE',
    'TIM',
    'ECON',
    'PSYC',
    'LING',
    'WRIT',
    'PHIL',
    'HIST',
    'SOCY',
    'ANTH',
    'ART',
    'MUSC',
    'THEA',
    'FILM',
    'LIT',
    'LATN',
    'GREEK',
    'SPAN',
    'FREN',
    'ITAL',
    'JAPN',
    'CHIN',
    'ASTR',
    'OCEA',
    'EART',
    'ENVS',
    'BME',
    'HISC',
    'HAVC',
    'CMMU',
    'FMST',
    'LGST',
    'POLI',
    'CRSN',
    'KRSG',
    'MERR',
    'OAKS',
    'COWL',
    'STEV',
    'PORTER',
    'CLEI',
    'PRTR',
  ].map((d) => d.toUpperCase())
);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripCellNoise(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^[-*•|]+/, '')
      .replace(/[-*•|]+$/, '')
      .replace(/\u00a0/g, ' ')
  );
}

function isPunctuationOnly(value: string): boolean {
  return /^[\s.,;:/\\|_\-–—•*"'`()[\]{}]+$/.test(value);
}

function isBlockedMetadata(text: string): boolean {
  const cleaned = stripCellNoise(text);
  if (!cleaned || isPunctuationOnly(cleaned)) return true;
  if (cleaned.length > 180) return true; // long advice / GE paragraphs
  if (BLOCKED_EXACT_RE.test(cleaned)) return true;
  if (BLOCKED_PHRASE_RE.test(cleaned)) return true;
  if (/^name\s*:/i.test(cleaned)) return true;
  if (/^student\s*id\s*:/i.test(cleaned)) return true;
  if (/do\s+not\s+delete/i.test(cleaned)) return true;
  return false;
}

const REJECT_DEPT_TOKENS = new Set(
  [
    'OF',
    'OR',
    'AND',
    'TO',
    'IN',
    'ON',
    'AT',
    'BY',
    'FOR',
    'THE',
    'A',
    'AN',
    'AS',
    'IS',
    'IF',
    'NO',
    'YES',
    'ROW',
    'COL',
    'YEAR',
    'FALL',
    'WINT',
    'SPR',
    'SUMM',
    'FORM',
    'PAGE',
    'STEP',
    'PART',
    'ITEM',
    'NOTE',
    'SEE',
    'ALL',
    'USE',
    'ONLY',
    'DO',
    'NOT',
    'ID',
    'GE', // handled as placeholder, not a dept code
  ].map((d) => d.toUpperCase())
);

function extractCourseCodes(text: string): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();
  COURSE_CODE_GLOBAL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COURSE_CODE_GLOBAL.exec(text)) !== null) {
    const dept = match[1]!.toUpperCase();
    const num = match[2]!.toUpperCase();
    if (REJECT_DEPT_TOKENS.has(dept)) continue;
    if (dept.length === 4 && /^(FALL|WINT|SPRI|SUMM)$/i.test(dept)) continue;
    // Prefer known depts; still allow unknown short academic-looking codes
    if (
      !DEPT_ALLOWLIST.has(dept) &&
      !(dept.length >= 2 && dept.length <= 5 && /^[A-Z]+$/.test(dept))
    ) {
      continue;
    }
    // Reject year-like numbers (e.g. accidental "Form 2025")
    if (/^\d{4}$/.test(num) && Number(num) >= 1900 && Number(num) <= 2100) {
      continue;
    }
    const code = `${dept} ${num}`;
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }
  return codes;
}

function isPlaceholderCourse(text: string): boolean {
  const cleaned = stripCellNoise(text);
  if (!cleaned || cleaned.length > 60) return false;
  if (PLACEHOLDER_RE.test(cleaned)) return true;
  return false;
}

function looksLikeCourseCandidate(text: string): boolean {
  const cleaned = stripCellNoise(text);
  if (!cleaned || isPunctuationOnly(cleaned)) return false;
  if (isBlockedMetadata(cleaned)) return false;
  if (extractCourseCodes(cleaned).length > 0) return true;
  if (isPlaceholderCourse(cleaned)) return true;
  return false;
}

function formatTermLabel(term: string, year?: string | null): string {
  const nice =
    term.charAt(0).toUpperCase() +
    term.slice(1).toLowerCase().replace('autumn', 'fall');
  const termName = nice === 'Autumn' ? 'Fall' : nice;
  if (year) return `${year} ${termName}`;
  return termName;
}

function parseYearToken(value: string): string | null {
  const cleaned = stripCellNoise(value);
  const yearMatch = cleaned.match(/\b(20\d{2})\b/);
  if (yearMatch) return yearMatch[1]!;
  const ordinal = cleaned.match(
    /\b(?:1st|2nd|3rd|4th|5th|first|second|third|fourth|fifth)\s*year\b/i
  );
  if (ordinal) return cleaned;
  if (/^year\s*[1-5]$/i.test(cleaned)) return cleaned;
  return null;
}

function detectTermHeader(cell: string): TermName | null {
  const cleaned = stripCellNoise(cell).toLowerCase();
  if (/^fall\b/.test(cleaned)) return 'Fall';
  if (/^winter\b/.test(cleaned)) return 'Winter';
  if (/^spring\b/.test(cleaned)) return 'Spring';
  if (/^summer\b/.test(cleaned)) return 'Summer';
  return null;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((cell) => stripCellNoise(cell));
}

function courseFromCell(
  cell: string,
  fallbackNotes: string | null = null
): PlannerImportDraftCourse[] {
  const cleaned = stripCellNoise(cell);
  if (!cleaned || isPunctuationOnly(cleaned)) return [];
  // Placeholders first so "CS Elective #4 of 4" is not misread as "OF 4"
  if (
    isPlaceholderCourse(cleaned) &&
    extractCourseCodes(cleaned).length === 0
  ) {
    const course = cleanCourse({
      ...emptyCourse(),
      title: cleaned.slice(0, MAX_TITLE_LEN),
      notes: fallbackNotes,
    });
    return course ? [course] : [];
  }
  if (!looksLikeCourseCandidate(cleaned)) return [];

  const codes = extractCourseCodes(cleaned);
  const unitsMatch = cleaned.match(UNITS_RE);
  const units = unitsMatch ? Number(unitsMatch[1]) : null;

  if (codes.length >= 2 && /\bor\b|\//i.test(cleaned)) {
    // Ambiguous alternatives — keep first code, put the rest in notes.
    const primary = codes[0]!;
    const rest = codes.slice(1).join(' / ');
    let title = cleaned
      .replace(COURSE_CODE_GLOBAL, ' ')
      .replace(UNITS_RE, ' ')
      .replace(/\bor\b/gi, ' ')
      .replace(/[|/]+/g, ' ');
    title = normalizeWhitespace(title);
    if (!title || title === primary || /^[·.•-]+$/.test(title)) {
      title = primary;
    }
    return [
      cleanCourse({
        ...emptyCourse(),
        title,
        courseNumber: primary,
        units:
          units !== null && Number.isFinite(units) && units >= 0 && units <= 30
            ? units
            : null,
        notes:
          normalizeWhitespace(
            [fallbackNotes, `Alternatives: ${rest}`].filter(Boolean).join(' · ')
          ).slice(0, MAX_NOTES_LEN) || null,
      }),
    ].filter(Boolean) as PlannerImportDraftCourse[];
  }

  if (codes.length >= 2) {
    // Multiple distinct codes in one cell without "or" — split into rows.
    return codes
      .map((code) =>
        cleanCourse({
          ...emptyCourse(),
          title: code,
          courseNumber: code,
          units: null,
          notes: fallbackNotes,
        })
      )
      .filter((course): course is PlannerImportDraftCourse => course !== null);
  }

  if (codes.length === 1) {
    const code = codes[0]!;
    let title = cleaned
      .replace(new RegExp(code.replace(' ', '\\s*'), 'i'), ' ')
      .replace(UNITS_RE, ' ');
    title = normalizeWhitespace(title.replace(/^[·.•:/-]+|[·.•:/-]+$/g, ''));

    // "CSE 151 · /L" → title CSE 151, note /L
    let notes = fallbackNotes;
    const labNote = title.match(/^\/?L\b(.*)$/i);
    if (labNote) {
      notes = normalizeWhitespace(
        [`/L${labNote[1] || ''}`, notes].filter(Boolean).join(' · ')
      ).slice(0, MAX_NOTES_LEN);
      title = code;
    }

    if (!title || title.toUpperCase() === code || /^[·.•-]+$/.test(title)) {
      title = code;
    }

    return [
      cleanCourse({
        ...emptyCourse(),
        title,
        courseNumber: code,
        units:
          units !== null && Number.isFinite(units) && units >= 0 && units <= 30
            ? units
            : null,
        notes,
      }),
    ].filter(Boolean) as PlannerImportDraftCourse[];
  }

  // Placeholder / short planned slot
  if (isPlaceholderCourse(cleaned)) {
    return [
      cleanCourse({
        ...emptyCourse(),
        title: cleaned.slice(0, MAX_TITLE_LEN),
        notes: fallbackNotes,
      }),
    ].filter(Boolean) as PlannerImportDraftCourse[];
  }

  return [];
}

function cleanCourse(
  course: PlannerImportDraftCourse
): PlannerImportDraftCourse | null {
  let title = normalizeWhitespace(course.title);
  let courseNumber = course.courseNumber
    ? normalizeWhitespace(course.courseNumber).toUpperCase()
    : null;
  let notes = course.notes ? normalizeWhitespace(course.notes) : null;

  if (!title) return null;
  if (isBlockedMetadata(title) && !extractCourseCodes(title).length) {
    return null;
  }

  // "CSE 102 · CSE 102" / duplicate title+number
  if (courseNumber) {
    const dup = new RegExp(
      `^${courseNumber.replace(/\s+/g, '\\s*')}(?:\\s*[·.•/-]\\s*${courseNumber.replace(/\s+/g, '\\s*')})+$`,
      'i'
    );
    if (dup.test(title) || title.toUpperCase() === courseNumber) {
      title = courseNumber;
    }
  }

  const codesInTitle = extractCourseCodes(title);
  if (!courseNumber && codesInTitle.length === 1) {
    courseNumber = codesInTitle[0]!;
  }

  if (
    !courseNumber &&
    !isPlaceholderCourse(title) &&
    codesInTitle.length === 0
  ) {
    // Reject free-text titles that are not placeholders and have no code.
    if (title.length > 40 || BLOCKED_PHRASE_RE.test(title)) return null;
    // Allow only short elective-like titles already covered by placeholder;
    // otherwise drop ambiguous metadata leftovers.
    return null;
  }

  if (title.length > MAX_TITLE_LEN) {
    const overflow = title.slice(MAX_TITLE_LEN);
    title = title.slice(0, MAX_TITLE_LEN).trim();
    notes = normalizeWhitespace([notes, overflow].filter(Boolean).join(' · '));
  }

  if (notes && notes.length > MAX_NOTES_LEN) {
    notes = notes.slice(0, MAX_NOTES_LEN);
  }

  if (isPunctuationOnly(title)) return null;

  return {
    ...emptyCourse(),
    title,
    courseNumber,
    units:
      course.units !== null &&
      course.units !== undefined &&
      Number.isFinite(course.units) &&
      course.units >= 0 &&
      course.units <= 30
        ? course.units
        : null,
    professor: course.professor?.trim() || null,
    lectureDays: course.lectureDays?.trim() || null,
    lectureTime: course.lectureTime?.trim() || null,
    lectureLocation: course.lectureLocation?.trim() || null,
    notes: notes || null,
    isAlternate: Boolean(course.isAlternate),
  };
}

function courseKey(course: PlannerImportDraftCourse): string {
  const code = (course.courseNumber || '').toUpperCase();
  const title = course.title.trim().toUpperCase();
  return `${code}::${title}`;
}

function dedupeCourses(
  courses: PlannerImportDraftCourse[]
): PlannerImportDraftCourse[] {
  const seen = new Set<string>();
  const result: PlannerImportDraftCourse[] = [];
  for (const course of courses) {
    const key = courseKey(course);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(course);
  }
  return result;
}

/**
 * Final safety net applied to AI and local drafts.
 */
export function sanitizePlannerImportDraft(
  draft: PlannerImportDraft
): PlannerImportDraft {
  const sections: PlannerImportDraftSection[] = [];

  for (const section of draft.sections) {
    let label = normalizeWhitespace(section.label).slice(0, 100);
    if (!label || BLOCKED_EXACT_RE.test(label) || isBlockedMetadata(label)) {
      // Keep year/term labels; otherwise fall back.
      if (!/\b(20\d{2}|fall|winter|spring|summer|year|plan)\b/i.test(label)) {
        label = 'Imported Plan';
      }
    }

    const courses = dedupeCourses(
      section.courses
        .map((course) => cleanCourse(course))
        .filter((course): course is PlannerImportDraftCourse => course !== null)
    );

    if (courses.length > 0) {
      sections.push({ label: label.slice(0, 100) || 'Imported Plan', courses });
    }
  }

  return { sections };
}

function normalizeDraft(
  sections: PlannerImportDraftSection[]
): PlannerImportDraft {
  return sanitizePlannerImportDraft({ sections });
}

// ---------------------------------------------------------------------------
// Local parsers (grid + line)
// ---------------------------------------------------------------------------

function parseTermYearGrid(source: string): PlannerImportDraft | null {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sectionMap = new Map<string, PlannerImportDraftCourse[]>();

  let termColumns: Array<{ index: number; term: TermName }> | null = null;

  for (const line of lines) {
    if (SHEET_HEADER.test(line)) {
      termColumns = null;
      continue;
    }

    const cells = line.includes(',') ? splitCsvLine(line) : [line];
    if (cells.length < 2) continue;

    // Header row: locate Fall/Winter/Spring/Summer columns
    const headerTerms: Array<{ index: number; term: TermName }> = [];
    cells.forEach((cell, index) => {
      const term = detectTermHeader(cell);
      if (term) headerTerms.push({ index, term });
    });
    if (headerTerms.length >= 2) {
      termColumns = headerTerms;
      continue;
    }

    if (!termColumns) continue;

    const yearToken =
      parseYearToken(cells[0] || '') || parseYearToken(cells[1] || '') || null;

    for (const { index, term } of termColumns) {
      const cell = cells[index];
      if (!cell) continue;
      const courses = courseFromCell(cell);
      if (courses.length === 0) continue;
      const sectionLabel = /^\d{4}$/.test(yearToken || '')
        ? `${yearToken} ${term}`
        : yearToken
          ? `${yearToken} · ${term}`
          : `Imported Plan · ${term}`;
      const existing = sectionMap.get(sectionLabel) ?? [];
      existing.push(...courses);
      sectionMap.set(sectionLabel, existing);
    }
  }

  if (sectionMap.size === 0) return null;

  const sections: PlannerImportDraftSection[] = [...sectionMap.entries()].map(
    ([label, courses]) => ({
      label,
      courses: dedupeCourses(courses),
    })
  );

  return normalizeDraft(sections);
}

/**
 * Deterministic fallback parser for pasted / CSV / spreadsheet text.
 */
export function parseCoursePlanTextLocally(
  sourceText: string
): PlannerImportDraft {
  const source = prepareSource(sourceText);

  const grid = parseTermYearGrid(source);
  if (grid && grid.sections.length > 0) {
    return grid;
  }

  const lines = source.split(/\r?\n/);
  const sections: PlannerImportDraftSection[] = [];
  let current: PlannerImportDraftSection = {
    label: 'Imported Plan',
    courses: [],
  };
  let currentYear: string | null = null;

  function pushCurrent() {
    if (current.courses.length > 0) {
      sections.push(current);
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SHEET_HEADER.test(line)) continue;

    const yearFirst = line.match(YEAR_FIRST_TERM);
    if (yearFirst && line.length < 40) {
      pushCurrent();
      current = {
        label: formatTermLabel(yearFirst[2]!, yearFirst[1]),
        courses: [],
      };
      currentYear = yearFirst[1]!;
      continue;
    }

    const termMatch = line.match(TERM_LINE);
    if (termMatch && line.length < 80) {
      pushCurrent();
      current = {
        label: formatTermLabel(termMatch[1]!, termMatch[2]),
        courses: [],
      };
      currentYear = termMatch[2]!;
      continue;
    }

    const yearOnly = parseYearToken(line);
    if (yearOnly && /^\d{4}$/.test(yearOnly) && line.length < 20) {
      currentYear = yearOnly;
      continue;
    }

    // CSV row: try each cell independently
    const cells = line.includes(',') ? splitCsvLine(line) : [line];
    let matchedAny = false;
    for (const cell of cells) {
      if (!looksLikeCourseCandidate(cell)) continue;
      const courses = courseFromCell(cell);
      if (courses.length === 0) continue;
      matchedAny = true;
      current.courses.push(...courses);
    }
    if (matchedAny) continue;

    // Non-CSV whole-line parse only if it looks like a course
    if (!looksLikeCourseCandidate(line)) continue;
    const courses = courseFromCell(line);
    current.courses.push(...courses);
  }

  pushCurrent();

  // If we never found term headers but did find a year, rename default section.
  if (
    sections.length === 1 &&
    sections[0]!.label === 'Imported Plan' &&
    currentYear &&
    /^\d{4}$/.test(currentYear)
  ) {
    sections[0]!.label = `${currentYear} Plan`;
  }

  return normalizeDraft(sections);
}

function plannerImportPrompt(source: string): JsonPrompt {
  return {
    system:
      'You extract ONLY real planned courses from messy academic planning ' +
      'forms, CSV, or spreadsheet text. Ignore form metadata and instructions. ' +
      'Never invent courses. Respond with JSON only — no markdown fences.',
    user:
      "Parse the student's course plan into terms (sections) and courses.\n\n" +
      'Return JSON of this exact shape:\n' +
      '{\n' +
      '  "sections": [\n' +
      '    {\n' +
      '      "title": "2026 Fall",\n' +
      '      "courses": [\n' +
      '        {\n' +
      '          "title": "Introduction to Algorithms",\n' +
      '          "number": "CSE 102",\n' +
      '          "units": 5,\n' +
      '          "professor": null,\n' +
      '          "lectureDays": null,\n' +
      '          "lectureTime": null,\n' +
      '          "lectureLocation": null,\n' +
      '          "notes": null,\n' +
      '          "isAlternate": false\n' +
      '        }\n' +
      '      ]\n' +
      '    }\n' +
      '  ]\n' +
      '}\n\n' +
      'STRICT RULES:\n' +
      '- Only output real planned courses or short plan placeholders.\n' +
      '- KEEP: course codes (CSE 102, MATH 19A, ECE 30), short titles next to codes, ' +
      'placeholders like "CS Elective #4 of 4", "GE", "DC" when they sit in a term grid.\n' +
      '- IGNORE completely: student Name/ID/Email/College/Major/Minor, form titles ' +
      '("UCSC Academic Planning Form"), "Office use only", advisor notes, signatures, ' +
      'approval/EGT/Last Updated/Date fields, graduation requirement explanations, ' +
      'GE instruction paragraphs, academic calendar text, "Do Not Delete Row", ' +
      'troubleshooting, transfer-course review prose, empty/punctuation-only cells.\n' +
      '- Prefer section titles like "2025 Fall", "2026 Winter" when year+term columns exist.\n' +
      '- If term mapping is unclear, use "Imported Plan" (do not invent nonsense terms).\n' +
      '- Do not invent courses, professors, or units.\n' +
      '- If a cell has alternatives (CSE 102 or 103), use one course and put uncertainty in notes.\n' +
      '- If no real courses are found, return {"sections":[]}.\n' +
      '- Units must be a number or null. Schedule fields only when obvious.\n\n' +
      'SOURCE:\n"""\n' +
      source +
      '\n"""',
  };
}

function demoPlannerImport(source: string): PlannerImportDraft {
  const local = parseCoursePlanTextLocally(source);
  if (local.sections.length > 0) {
    return local;
  }

  return {
    sections: [
      {
        label: /fall/i.test(source) ? '2026 Fall' : 'Imported Plan',
        courses: [
          {
            ...emptyCourse(),
            title: 'Introduction to Algorithms',
            courseNumber: 'CSE 102',
            units: 5,
            notes:
              'Demo import — set AI keys and AI_DEMO_MODE=false for real parses.',
          },
          {
            ...emptyCourse(),
            title: 'Discrete Mathematics',
            courseNumber: 'CSE 16',
            units: 5,
          },
        ],
      },
    ],
  };
}

/**
 * Parse plan text into a validated draft. Does not write to the database.
 */
export async function parseCoursePlanText(
  sourceText: string
): Promise<PlannerImportResult> {
  const source = prepareSource(sourceText);
  if (!source) {
    throw new Error('Paste or upload plan text before importing.');
  }

  const status = getAiRuntimeStatus();
  console.info('[ai] parseCoursePlanText start', {
    geminiConfigured: status.geminiConfigured,
    localConfigured: status.localConfigured,
    demoMode: status.demoMode,
    chars: source.length,
  });

  const finish = (
    draft: PlannerImportDraft,
    provider: PlannerImportResult['provider']
  ): PlannerImportResult => {
    const cleaned = sanitizePlannerImportDraft(draft);
    return {
      draft: cleaned,
      provider,
      stats: buildStats(source, cleaned),
    };
  };

  if (status.demoMode) {
    console.warn('[ai] parseCoursePlanText selected provider=demo');
    return finish(demoPlannerImport(source), 'demo');
  }

  if (!hasConfiguredProvider()) {
    const local = parseCoursePlanTextLocally(source);
    if (local.sections.length > 0) {
      console.warn(
        '[ai] parseCoursePlanText no provider — using local text parser'
      );
      return finish(local, 'local-parser');
    }
    throw new AiProviderError(
      'gemini',
      'AI is not configured and no courses could be detected from the text. Set LOCAL_AI_BASE_URL or GEMINI_API_KEY, or paste clearer term/course lines.'
    );
  }

  try {
    const run = await runWithFallback(
      plannerImportPrompt(source),
      (value) => plannerImportAiResponseSchema.safeParse(value).success
    );

    const parsed = plannerImportAiResponseSchema.parse(run.value);
    const draft = normalizeDraft(parsed.sections);

    if (draft.sections.length > 0) {
      console.info('[ai] parseCoursePlanText ok', {
        provider: run.provider,
        sections: draft.sections.length,
        courses: countDraftCourses(draft),
      });
      return finish(draft, run.provider);
    }

    console.warn(
      '[ai] parseCoursePlanText empty AI draft — falling back to local parser'
    );
  } catch (error) {
    console.warn('[ai] parseCoursePlanText AI failed — trying local parser', {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const local = parseCoursePlanTextLocally(source);
  if (local.sections.length > 0) {
    return finish(local, 'local-parser');
  }

  throw new Error('No courses detected in the pasted plan text.');
}
