const ALLOWED_TAGS = new Set([
  'p',
  'div',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'span',
  'font',
]);

const BLOCK_TAG_PATTERN = /<\/?(?:p|div|li|ul|ol)\b[^>]*>/gi;
const BREAK_TAG_PATTERN = /<br\s*\/?>/gi;
const TAG_PATTERN = /<\/?([a-z0-9]+)([^>]*)>/gi;
const ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function sanitizeColor(value: string): string | null {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(trimmed)) return trimmed;
  if (/^(?:rgb|rgba)\([\d\s.,%]+\)$/i.test(trimmed)) return trimmed;
  if (/^[a-z]{3,20}$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

function sanitizeFontSize(value: string): string | null {
  const trimmed = value.trim();
  if (/^[1-7]$/.test(trimmed)) return trimmed;
  if (/^\d{1,2}px$/i.test(trimmed)) return trimmed;
  return null;
}

function sanitizeStyleAttribute(style: string): string | null {
  const safeEntries = style
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [rawProperty, ...rawValueParts] = entry.split(':');
      if (!rawProperty || rawValueParts.length === 0) return [];

      const property = rawProperty.trim().toLowerCase();
      const value = rawValueParts.join(':').trim();

      if (property === 'color') {
        const safeValue = sanitizeColor(value);
        return safeValue ? [`color: ${safeValue}`] : [];
      }

      if (property === 'font-size') {
        const safeValue = sanitizeFontSize(value);
        return safeValue ? [`font-size: ${safeValue}`] : [];
      }

      return [];
    });

  return safeEntries.length > 0 ? safeEntries.join('; ') : null;
}

function sanitizeAttributes(tag: string, attrs: string): string {
  if (!attrs.trim()) return '';

  const pieces: string[] = [];
  const styleMatch = attrs.match(/style\s*=\s*(['"])(.*?)\1/i);
  const colorMatch = attrs.match(/color\s*=\s*(['"])(.*?)\1/i);
  const sizeMatch = attrs.match(/size\s*=\s*(['"])(.*?)\1/i);

  if (tag === 'span' || tag === 'p' || tag === 'div') {
    const safeStyle = styleMatch?.[2]
      ? sanitizeStyleAttribute(styleMatch[2])
      : null;
    if (safeStyle) {
      pieces.push(`style="${safeStyle}"`);
    }
  }

  if (tag === 'font') {
    const safeColor = colorMatch?.[2] ? sanitizeColor(colorMatch[2]) : null;
    const safeSize = sizeMatch?.[2] ? sanitizeFontSize(sizeMatch[2]) : null;
    if (safeColor) {
      pieces.push(`color="${safeColor}"`);
    }
    if (safeSize) {
      pieces.push(`size="${safeSize}"`);
    }
  }

  return pieces.length > 0 ? ` ${pieces.join(' ')}` : '';
}

export function sanitizeRichTextHtml(input: string): string {
  if (!input.trim()) return '';

  const withoutDangerousBlocks = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<(script|style|iframe|object|embed|link|meta|head|html|body)[^>]*>[\s\S]*?<\/\1>/gi,
      ''
    );

  const sanitized = withoutDangerousBlocks.replace(
    TAG_PATTERN,
    (fullMatch, rawTagName: string, rawAttrs: string) => {
      const tagName = rawTagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tagName)) {
        return '';
      }

      const isClosingTag = fullMatch.startsWith('</');
      if (isClosingTag) {
        return `</${tagName}>`;
      }

      const safeAttrs = sanitizeAttributes(tagName, rawAttrs);
      const isSelfClosing = /\/>$/.test(fullMatch) || tagName === 'br';
      return isSelfClosing
        ? `<${tagName}${safeAttrs}>`
        : `<${tagName}${safeAttrs}>`;
    }
  );

  return sanitized.trim();
}

export function richTextToPlainText(content: string): string {
  if (!content.trim()) return '';

  const withBreaks = content
    .replace(BREAK_TAG_PATTERN, '\n')
    .replace(BLOCK_TAG_PATTERN, '\n');

  const withoutTags = withBreaks.replace(/<[^>]+>/g, '');
  const decoded = withoutTags
    .replace(
      /&(nbsp|amp|lt|gt|quot|#39);/g,
      (entity) => ENTITY_MAP[entity] ?? entity
    )
    .replace(/&#(\d+);/g, (_, codePoint: string) => {
      const parsed = Number(codePoint);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : '';
    });

  return decoded
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function hasVisibleRichText(content: string): boolean {
  return richTextToPlainText(content).trim().length > 0;
}
