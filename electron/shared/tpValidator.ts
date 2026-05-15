/**
 * Teaching Point display format: "<tpcode> : <name>"
 * The code does not need a "TP" prefix. Separator is the literal substring ` : `
 * (space, colon, space). Both sides are trimmed; neither may be empty.
 */
export const TP_CODE_NAME_SEPARATOR = ' : ' as const;

/**
 * Approximate pattern for quick checks; {@link parseTpName} is the source of truth
 * (splits on the first ` : ` only, so names may contain colons).
 */
export const TP_NAME_REGEX = /^([\s\S]+?) : ([\s\S]+)$/;

export interface ParseTpNameResult {
  ok: boolean;
  code?: string;
  name?: string;
  reason?: string;
}

export function parseTpName(raw: string): ParseTpNameResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty string' };
  }
  const idx = trimmed.indexOf(TP_CODE_NAME_SEPARATOR);
  if (idx === -1) {
    return { ok: false, reason: "missing ' : ' separator" };
  }
  const code = trimmed.slice(0, idx).trim();
  const name = trimmed.slice(idx + TP_CODE_NAME_SEPARATOR.length).trim();
  if (!code) {
    return { ok: false, reason: 'teaching point code is empty' };
  }
  if (!name || !/\S/.test(name)) {
    return { ok: false, reason: 'name is empty or only whitespace' };
  }
  return { ok: true, code, name };
}

function readUndFromDefinition(definition: unknown): string | undefined {
  if (!definition || typeof definition !== 'object') return undefined;
  const name = (definition as { name?: unknown }).name;
  if (!name || typeof name !== 'object') return undefined;
  const und = (name as Record<string, unknown>)['und'];
  return typeof und === 'string' ? und : undefined;
}

/**
 * xAPI Activity object: object.definition.name.und
 */
export function extractTpNameFromObject(obj: unknown): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const o = obj as { definition?: unknown; requestData?: unknown };
  const fromDef = readUndFromDefinition(o.definition);
  if (fromDef !== undefined) return fromDef;
  const rd = o.requestData;
  if (rd && typeof rd === 'object') {
    const inner = (rd as { object?: unknown }).object;
    if (inner && typeof inner === 'object') {
      return readUndFromDefinition(
        (inner as { definition?: unknown }).definition,
      );
    }
  }
  return undefined;
}

/** xAPI statement: object.definition.name.und or statement.requestData.object… */
export function extractTpNameFromStatement(statement: unknown): string | undefined {
  if (!statement || typeof statement !== 'object') return undefined;
  const s = statement as { object?: unknown; requestData?: unknown };
  const fromObject = extractTpNameFromObject(s.object);
  if (fromObject !== undefined) return fromObject;
  const rd = s.requestData;
  if (rd && typeof rd === 'object') {
    return extractTpNameFromObject((rd as { object?: unknown }).object);
  }
  return undefined;
}
