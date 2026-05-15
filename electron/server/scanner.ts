import { promises as fs } from 'fs';
import path from 'path';
import type { ScannedTpHit } from '../shared/types';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  '.json',
  '.js',
  '.html',
  '.htm',
  '.xml',
  '.txt',
]);

/** Matches embedded JSON-ish definition.name.und in JS/HTML */
const EMBEDDED_UND_REGEX =
  /"definition"\s*:\s*\{[\s\S]*?"name"\s*:\s*\{[\s\S]*?"und"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

function dedupeKey(file: string, raw: string): string {
  return `${file}\0${raw}`;
}

function walkJsonForUnd(node: unknown, hits: Set<string>, file: string): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkJsonForUnd(item, hits, file);
    return;
  }
  if (typeof node !== 'object') return;
  const o = node as Record<string, unknown>;

  const def = o.definition;
  if (def && typeof def === 'object') {
    const name = (def as { name?: unknown }).name;
    if (name && typeof name === 'object') {
      const und = (name as Record<string, unknown>)['und'];
      if (typeof und === 'string' && und.length > 0) {
        hits.add(dedupeKey(file, und));
      }
    }
  }

  const rd = o.requestData;
  if (rd && typeof rd === 'object') {
    const obj = (rd as { object?: unknown }).object;
    if (obj && typeof obj === 'object') {
      const innerDef = (obj as { definition?: unknown }).definition;
      if (innerDef && typeof innerDef === 'object') {
        const name = (innerDef as { name?: unknown }).name;
        if (name && typeof name === 'object') {
          const und = (name as Record<string, unknown>)['und'];
          if (typeof und === 'string' && und.length > 0) {
            hits.add(dedupeKey(file, und));
          }
        }
      }
    }
  }

  for (const v of Object.values(o)) walkJsonForUnd(v, hits, file);
}

function regexExtractUnd(content: string, file: string, hits: Set<string>): void {
  EMBEDDED_UND_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EMBEDDED_UND_REGEX.exec(content)) !== null) {
    const raw = m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    if (raw.length > 0) hits.add(dedupeKey(file, raw));
  }
}

async function scanFile(filePath: string, relPath: string): Promise<ScannedTpHit[]> {
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return [];

  let stat: { size: number };
  try {
    stat = await fs.stat(filePath);
  } catch {
    return [];
  }
  if (stat.size > MAX_FILE_BYTES) return [];

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    return [];
  }

  const hits = new Set<string>();

  if (ext === '.json') {
    try {
      const parsed = JSON.parse(content) as unknown;
      walkJsonForUnd(parsed, hits, relPath);
    } catch {
      /* ignore invalid JSON */
    }
  }

  regexExtractUnd(content, relPath, hits);

  const out: ScannedTpHit[] = [];
  for (const key of hits) {
    const sep = key.indexOf('\0');
    const file = key.slice(0, sep);
    const raw = key.slice(sep + 1);
    out.push({ raw, file });
  }
  return out;
}

async function walkDir(
  root: string,
  current: string,
  out: ScannedTpHit[],
): Promise<void> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(current, e.name);
    const rel = path.relative(root, full);
    if (e.isDirectory()) {
      await walkDir(root, full, out);
    } else if (e.isFile()) {
      const hits = await scanFile(full, rel);
      out.push(...hits);
    }
  }
}

/** Walk extracted package directory and collect definition.name.und strings */
export async function scanPackage(packageRoot: string): Promise<ScannedTpHit[]> {
  const out: ScannedTpHit[] = [];
  await walkDir(packageRoot, packageRoot, out);
  return out;
}
