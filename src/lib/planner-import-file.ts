/**
 * Course Planner Import — safe file → plain-text conversion.
 *
 * Only .txt / .csv / .xlsx are accepted. Spreadsheets are read as display
 * cell values only (no formula evaluation, macros, VBA, HTML, or embedded
 * objects). Uploaded content is never executed.
 */

export const MAX_PLAN_IMPORT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_PLAN_IMPORT_TEXT_CHARS = 20_000;
export const MIN_PLAN_IMPORT_TEXT_CHARS = 3;

export const UNSUPPORTED_FILE_TYPE_MESSAGE =
  'Unsupported file type. Please upload .txt, .csv, or .xlsx.';

export const FILE_TOO_LARGE_MESSAGE =
  'File is too large. Please upload a smaller export.';

export const EMPTY_FILE_MESSAGE =
  'File is empty. Please upload a plan export with course rows.';

type PlanImportKind = 'txt' | 'csv' | 'xlsx';

const TXT_MIMES = new Set(['', 'text/plain', 'application/octet-stream']);

const CSV_MIMES = new Set([
  '',
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel', // browsers sometimes label CSV this way
  'application/octet-stream',
]);

const XLSX_MIMES = new Set([
  '',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'application/zip', // some browsers report xlsx as zip
]);

/** MIME types that must never be accepted for plan import. */
const BLOCKED_MIME_RE =
  /^(?:text\/html|text\/javascript|application\/(?:javascript|x-javascript|ecmascript|pdf|msword|vnd\.ms-excel\.sheet\.macroenabled\.12|vnd\.ms-excel\.sheet\.binary\.12|x-msdownload|x-msdos-program|x-executable|x-rar-compressed)|image\/|video\/|audio\/)/i;

function getExtension(name: string): string {
  const base = name.trim().split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot).toLowerCase();
}

function detectKind(name: string): PlanImportKind | null {
  const ext = getExtension(name);
  if (ext === '.txt') return 'txt';
  if (ext === '.csv') return 'csv';
  if (ext === '.xlsx') return 'xlsx';
  return null;
}

export function isSupportedPlanImportFile(name: string): boolean {
  return detectKind(name) !== null;
}

function normalizeMime(mime: string | undefined | null): string {
  return (mime ?? '').split(';')[0]!.trim().toLowerCase();
}

function assertMimeAllowed(kind: PlanImportKind, mime: string): void {
  if (BLOCKED_MIME_RE.test(mime)) {
    throw new Error(UNSUPPORTED_FILE_TYPE_MESSAGE);
  }

  const allowed =
    kind === 'txt' ? TXT_MIMES : kind === 'csv' ? CSV_MIMES : XLSX_MIMES;

  if (!allowed.has(mime)) {
    // Extension is authoritative when MIME is odd but not explicitly dangerous.
    // Still reject clearly mismatched document types.
    if (
      mime.startsWith('application/vnd.openxmlformats-officedocument.word') ||
      mime === 'application/msword' ||
      mime === 'application/pdf' ||
      mime.includes('macroenabled') ||
      mime.includes('macro-enabled')
    ) {
      throw new Error(UNSUPPORTED_FILE_TYPE_MESSAGE);
    }
  }
}

/**
 * Strip control characters / nulls, normalize newlines, cap length.
 * Formula-like CSV cells (=, +, -, @) remain plain text — never evaluated.
 */
export function sanitizePlanImportText(raw: string): string {
  let text = String(raw ?? '');

  // Drop null bytes and most control chars; keep tab + LF.
  text = text.replace(/\0/g, '');
  text = text.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  // Normalize line endings to \n
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Collapse extreme repeated whitespace / blank lines
  text = text.replace(/[ \t]{12,}/g, '  ');
  text = text.replace(/\n{5,}/g, '\n\n\n');

  text = text.trim();

  if (text.length > MAX_PLAN_IMPORT_TEXT_CHARS) {
    text = text.slice(0, MAX_PLAN_IMPORT_TEXT_CHARS);
  }

  return text;
}

function isInstructionSheetName(name: string): boolean {
  return /\b(instruction|instructions|readme|legend|howto|how\s*to|guide|faq|office\s*use)\b/i.test(
    name
  );
}

/**
 * Convert a worksheet to plain CSV-like text using display/string cell values
 * only. Does not evaluate formulas or include drawings/objects/macros.
 */
function sheetToPlainRows(
  XLSX: {
    utils: {
      decode_range: (ref: string) => {
        s: { r: number; c: number };
        e: { r: number; c: number };
      };
      encode_cell: (addr: { r: number; c: number }) => string;
    };
  },
  sheet: Record<string, unknown>
): string {
  const ref = sheet['!ref'];
  if (!ref || typeof ref !== 'string') return '';

  let range;
  try {
    range = XLSX.utils.decode_range(ref);
  } catch {
    return '';
  }

  // Cap absurd ranges so a malicious sheet can't hang the tab.
  const maxRows = 2_000;
  const maxCols = 64;
  const endRow = Math.min(range.e.r, range.s.r + maxRows - 1);
  const endCol = Math.min(range.e.c, range.s.c + maxCols - 1);

  const lines: string[] = [];

  for (let r = range.s.r; r <= endRow; r += 1) {
    const cells: string[] = [];
    for (let c = range.s.c; c <= endCol; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      cells.push(cellDisplayText(cell));
    }

    while (cells.length > 0 && cells[cells.length - 1] === '') {
      cells.pop();
    }

    if (cells.some((value) => value.trim().length > 0)) {
      lines.push(cells.map(escapeCsvField).join(','));
    }
  }

  return lines.join('\n');
}

/** Prefer formatted text / raw value; never execute formulas. */
function cellDisplayText(cell: unknown): string {
  if (!cell || typeof cell !== 'object') return '';
  const record = cell as {
    w?: unknown;
    v?: unknown;
    t?: unknown;
    f?: unknown;
  };

  if (typeof record.w === 'string' && record.w.length > 0) {
    return record.w;
  }

  if (record.v === null || record.v === undefined) {
    // Cached formula with no value — keep as inert plain text marker, do not eval.
    if (typeof record.f === 'string' && record.f.trim()) {
      return String(record.f);
    }
    return '';
  }

  if (typeof record.v === 'string' || typeof record.v === 'number') {
    return String(record.v);
  }

  if (typeof record.v === 'boolean') {
    return record.v ? 'TRUE' : 'FALSE';
  }

  // Dates / other objects — stringify safely
  try {
    return String(record.v);
  } catch {
    return '';
  }
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function assertLooksLikeXlsxZip(buffer: ArrayBuffer): void {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  // XLSX is a ZIP package: PK\x03\x04
  if (
    bytes.length < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    throw new Error(
      'That file does not look like a valid .xlsx spreadsheet. Please export again as .xlsx.'
    );
  }

  // Reject macro-enabled packages that someone renamed to .xlsx (best-effort).
  const ascii = new TextDecoder('latin1').decode(
    new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 512_000)))
  );
  if (/vbaProject\.bin/i.test(ascii) || /xl\/macrosheets/i.test(ascii)) {
    throw new Error(
      'Macro-enabled spreadsheets are not supported. Please upload a normal .xlsx export without macros.'
    );
  }
}

async function readPlainTextFile(file: File): Promise<string> {
  const raw = await file.text();
  const text = sanitizePlanImportText(raw);
  if (text.length < MIN_PLAN_IMPORT_TEXT_CHARS) {
    throw new Error(EMPTY_FILE_MESSAGE);
  }
  return text;
}

async function readXlsxAsPlainText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  assertLooksLikeXlsxZip(buffer);

  const XLSX = await import('xlsx');

  // Safe read options: no VBA/book files/HTML; do not generate formula fields.
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    cellDates: false,
    bookVBA: false,
    bookFiles: false,
    bookProps: false,
    bookSheets: false,
  });

  if (!workbook.SheetNames?.length) {
    throw new Error('No sheets found in that spreadsheet.');
  }

  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    if (isInstructionSheetName(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName] as
      Record<string, unknown> | undefined;
    if (!sheet) continue;
    const rows = sheetToPlainRows(XLSX, sheet).trim();
    if (!rows) continue;
    parts.push(`# Sheet: ${sheetName}\n${rows}`);
  }

  const text = sanitizePlanImportText(parts.join('\n\n'));
  if (text.length < MIN_PLAN_IMPORT_TEXT_CHARS) {
    throw new Error('No readable cells found in that spreadsheet.');
  }
  return text;
}

/**
 * Validate + convert an uploaded plan file into sanitized plain text.
 * Never executes file content, macros, or formulas.
 */
export async function readPlanImportFileAsText(file: File): Promise<string> {
  const kind = detectKind(file.name);
  if (!kind) {
    throw new Error(UNSUPPORTED_FILE_TYPE_MESSAGE);
  }

  // Explicit macro / legacy Excel rejection (also covers odd names).
  const ext = getExtension(file.name);
  if (
    ext === '.xlsm' ||
    ext === '.xls' ||
    ext === '.xlsb' ||
    ext === '.xltm' ||
    ext === '.xltx'
  ) {
    throw new Error(UNSUPPORTED_FILE_TYPE_MESSAGE);
  }

  if (file.size <= 0) {
    throw new Error(EMPTY_FILE_MESSAGE);
  }

  if (file.size > MAX_PLAN_IMPORT_FILE_BYTES) {
    throw new Error(FILE_TOO_LARGE_MESSAGE);
  }

  assertMimeAllowed(kind, normalizeMime(file.type));

  if (kind === 'txt' || kind === 'csv') {
    return readPlainTextFile(file);
  }

  return readXlsxAsPlainText(file);
}
