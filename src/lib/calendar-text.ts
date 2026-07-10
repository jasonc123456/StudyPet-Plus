// Text handling for imported ICS feeds.
//
// Feed descriptions arrive doubly-encoded: RFC 5545 escapes newlines/commas as
// literal backslash sequences, and Canvas stuffs raw HTML inside that. Rendering
// the raw value is what produces the "\n\nEach question worth 10pts... PDF\, or"
// soup. cleanIcsText() undoes both layers; toRichTextSegments() then finds the
// links so the UI can render real anchors.

export type RichTextSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string };

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Undo RFC 5545 escaping: `\n` `\N` -> newline, `\,` `\;` -> literal, `\\` -> `\`. */
function unescapeIcsText(raw: string) {
  let out = '';

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (char !== '\\') {
      out += char;
      continue;
    }

    const next = raw[index + 1];
    if (next === undefined) {
      out += char;
      continue;
    }

    index += 1;
    if (next === 'n' || next === 'N') out += '\n';
    else if (next === '\\') out += '\\';
    else out += next; // covers \, \; and any stray escape
  }

  return out;
}

/**
 * Flatten Canvas' HTML into plain text, keeping anchor targets visible as
 * `label (url)` so the linkifier below can turn them back into real links.
 */
function stripHtml(input: string) {
  if (!/<[a-z!/]/i.test(input)) return input;

  return (
    input
      .replace(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_full, href, label) => {
          const text = label.replace(/<[^>]*>/g, '').trim();
          if (!text) return href;
          return text === href ? href : `${text} (${href})`;
        }
      )
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|ul|ol|h[1-6])>/gi, '\n')
      // Leading newline: a bullet must start its own line even when the previous
      // block didn't close with one ("…calculator".<ul><li>Ch 4</li></ul>).
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<[^>]+>/g, '')
  );
}

function decodeEntities(input: string) {
  return input.replace(/&[a-z]+;|&#\d+;/gi, (entity) => {
    const named = HTML_ENTITIES[entity.toLowerCase()];
    if (named) return named;

    const numeric = /^&#(\d+);$/.exec(entity);
    if (numeric) return String.fromCodePoint(Number(numeric[1]));

    return entity;
  });
}

/** Full pipeline: ICS unescape -> HTML flatten -> entity decode -> tidy blank lines. */
export function cleanIcsText(raw: string | null | undefined): string {
  if (!raw) return '';

  const text = decodeEntities(stripHtml(unescapeIcsText(raw)));

  return (
    text
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      // `</li>` and the next `<li>` each contribute a newline; keep list items
      // on consecutive lines instead of double-spaced.
      .replace(/\n{2,}(?=• )/g, '\n')
      .trim()
  );
}

// Markdown-ish `[label](url)` and `[label] (url)` (Canvas emits both), then any
// bare http(s) URL. Ordered so the labelled form wins over the bare URL inside it.
const LINK_PATTERN =
  /\[([^\]\n]+)\]\s*\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"')\]]+)/gi;

// Trailing punctuation is almost always prose, not part of the URL:
// "see https://x.com/a." stops at "a". Closing parens never reach here — the
// patterns above already exclude ")" from a URL, which is why a link like
// ".../Foo_(bar)" truncates at "(bar". Canvas feeds don't emit those.
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

function trimUrl(url: string) {
  return url.replace(TRAILING_PUNCTUATION, '');
}

/**
 * Split already-cleaned text into renderable segments. Callers render `link`
 * segments as anchors (target=_blank) and `text` segments verbatim.
 */
export function toRichTextSegments(text: string): RichTextSegment[] {
  if (!text) return [];

  const segments: RichTextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, start) });
    }

    const [full, label, labelledUrl, bareUrl] = match;
    const href = trimUrl(labelledUrl ?? bareUrl ?? '');

    if (href) {
      segments.push({ type: 'link', value: label ?? href, href });
    }

    // A bare URL may have shed trailing punctuation — hand it back as text.
    const consumed = labelledUrl ? full.length : href.length;
    cursor = start + consumed;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', value: text.slice(cursor) });
  }

  return segments;
}

// Canvas suffixes every calendar title with its course code: "HW2 [CSE-102-01]".
const COURSE_CODE_PATTERN = /^(.*?)\s*\[([^\][]+)\]\s*$/;

/**
 * Split "HW2 [CSE-102-01]" into its assignment title and course code. Returns a
 * null code when the title has no bracketed suffix (non-Canvas feeds).
 */
export function parseCourseCode(rawTitle: string): {
  title: string;
  courseCode: string | null;
} {
  const match = COURSE_CODE_PATTERN.exec(rawTitle.trim());
  if (!match) return { title: rawTitle.trim(), courseCode: null };

  const [, title, courseCode] = match;
  const cleanTitle = title.trim();

  // "[CSE-102-01]" alone: keep the code as the title rather than emptying it.
  if (!cleanTitle)
    return { title: courseCode.trim(), courseCode: courseCode.trim() };

  return { title: cleanTitle, courseCode: courseCode.trim() };
}

const TYPE_KEYWORDS: Array<{ type: string; pattern: RegExp }> = [
  { type: 'exam', pattern: /\b(exam|midterm|final|quiz|test)\b/i },
  { type: 'project', pattern: /\b(project|lab|milestone|presentation)\b/i },
  { type: 'reading', pattern: /\b(read(ing)?|chapter|textbook)\b/i },
  {
    type: 'homework',
    pattern: /\b(hw|homework|assignment|problem set|pset)\b/i,
  },
];

/** Best-effort assignment type from the feed title. Falls back to homework. */
export function guessAssignmentType(title: string): string {
  for (const { type, pattern } of TYPE_KEYWORDS) {
    if (pattern.test(title)) return type;
  }
  return 'homework';
}
