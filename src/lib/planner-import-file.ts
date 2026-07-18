/**
 * Convert an uploaded course-plan file into plain text for AI import.
 * Supports .txt / .csv (as-is) and .xlsx / .xls (SheetJS → CSV per sheet).
 */

const MAX_XLSX_BYTES = 5 * 1024 * 1024;

function isSpreadsheetName(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls');
}

function isPlainPlanName(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith('.txt') || lower.endsWith('.csv');
}

export function isSupportedPlanImportFile(name: string) {
  return isPlainPlanName(name) || isSpreadsheetName(name);
}

function isInstructionSheetName(name: string): boolean {
  return /\b(instruction|instructions|readme|legend|howto|how\s*to|guide|faq|office\s*use)\b/i.test(
    name
  );
}

export async function readPlanImportFileAsText(file: File): Promise<string> {
  if (!isSupportedPlanImportFile(file.name)) {
    throw new Error(
      'Only .txt, .csv, or .xlsx files are supported. PDF and screenshots are not available yet.'
    );
  }

  if (isPlainPlanName(file.name)) {
    return file.text();
  }

  if (file.size <= 0) {
    throw new Error('Spreadsheet file is empty.');
  }

  if (file.size > MAX_XLSX_BYTES) {
    throw new Error('Spreadsheet must be 5 MB or smaller.');
  }

  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (!workbook.SheetNames.length) {
    throw new Error('No sheets found in that spreadsheet.');
  }

  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    if (isInstructionSheetName(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet).trim();
    if (!csv) continue;
    parts.push(`# Sheet: ${sheetName}\n${csv}`);
  }

  const text = parts.join('\n\n').trim();
  if (!text) {
    throw new Error('No readable cells found in that spreadsheet.');
  }

  return text;
}
