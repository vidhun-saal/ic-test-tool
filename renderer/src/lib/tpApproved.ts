import type { TpEntry } from '../../../electron/shared/types';
import type { ParseTpNameResult } from '../../../electron/shared/tpValidator';

export type TpIssue = 'format' | 'unknown' | null;

export interface ParseApprovedResult {
  codes: Set<string>;
  count: number;
  error?: string;
  warn?: string;
}

const MAX_BYTES_SOFT_WARN = 1024 * 1024;

export function parseApprovedJson(text: string): ParseApprovedResult {
  if (text.length > MAX_BYTES_SOFT_WARN) {
    // still parse; surface warn to UI
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { codes: new Set(), count: 0, error: 'File is not valid JSON' };
  }

  if (!Array.isArray(data)) {
    return {
      codes: new Set(),
      count: 0,
      error: 'JSON must be an array of objects, e.g. [{ "code": "TP 1.1.1" }]',
    };
  }

  const codes = new Set<string>();
  let skipped = 0;

  for (const item of data) {
    if (!item || typeof item !== 'object') {
      return {
        codes: new Set(),
        count: 0,
        error: 'Every array element must be an object with a "code" string',
      };
    }
    const code = (item as { code?: unknown }).code;
    if (typeof code !== 'string') {
      skipped += 1;
      continue;
    }
    const trimmed = code.trim();
    if (trimmed) codes.add(trimmed);
  }

  if (codes.size === 0) {
    return {
      codes,
      count: 0,
      error:
        data.length === 0
          ? 'Approved list is empty'
          : 'No valid "code" strings found in file',
    };
  }

  const warn =
    text.length > MAX_BYTES_SOFT_WARN
      ? 'File is larger than 1 MB; parsing may be slow'
      : skipped > 0
        ? `${skipped} row(s) skipped (missing or non-string code)`
        : undefined;

  return { codes, count: codes.size, warn };
}

export function validateTpEntry(
  entry: TpEntry,
  approved: Set<string> | null,
): { issue: TpIssue; reason?: string } {
  if (!entry.formatOk) {
    return { issue: 'format', reason: entry.formatReason ?? 'invalid format' };
  }
  if (approved === null) return { issue: null };
  const code = entry.code?.trim();
  if (!code) return { issue: null };
  if (!approved.has(code)) {
    return {
      issue: 'unknown',
      reason: `TP code "${code}" not in approved list`,
    };
  }
  return { issue: null };
}

export function validateTpLabel(
  raw: string | null,
  parsed: ParseTpNameResult | null,
  approved: Set<string> | null,
): { issue: TpIssue; reason?: string } {
  if (!raw || parsed === null) return { issue: null };
  if (!parsed.ok) {
    return { issue: 'format', reason: parsed.reason ?? 'invalid format' };
  }
  if (approved === null) return { issue: null };
  const code = parsed.code?.trim();
  if (!code) return { issue: null };
  if (!approved.has(code)) {
    return {
      issue: 'unknown',
      reason: `TP code "${code}" not in approved list`,
    };
  }
  return { issue: null };
}

export function issueLabel(issue: TpIssue): string {
  if (issue === 'format') return 'Format';
  if (issue === 'unknown') return 'Unknown code';
  return '';
}
