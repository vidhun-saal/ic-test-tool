import { getApiConfig } from './config';
import { getValidAccessToken, markAccessPotentiallyStale } from './tokenStore';
import type { Ctp, TeachingPointRow } from '../shared/types';

async function fetchAuthedJson(path: string): Promise<unknown> {
  const cfg = getApiConfig();
  const url = `${cfg.e2ApiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const doFetch = async (): Promise<Response> => {
    const token = await getValidAccessToken();
    return fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  };

  let res = await doFetch();
  if (res.status === 401) {
    markAccessPotentiallyStale();
    res = await doFetch();
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`E2 API ${res.status}: ${text.slice(0, 400)}`);
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('E2 API returned non-JSON');
  }
}

interface RawCtp {
  id: string;
  name?: string;
  code?: string;
  abbreviation?: string;
  type?: string;
  parentCtpId?: string;
  version?: string | number;
}

function parseRawCtps(body: unknown): RawCtp[] {
  if (!body || typeof body !== 'object') return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const out: RawCtp[] = [];
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    if (typeof o.id !== 'string') continue;
    out.push({
      id: o.id,
      name: typeof o.name === 'string' ? o.name : undefined,
      code: typeof o.code === 'string' ? o.code : undefined,
      abbreviation:
        typeof o.abbreviation === 'string' ? o.abbreviation : undefined,
      type: typeof o.type === 'string' ? o.type : undefined,
      parentCtpId:
        typeof o.parentCtpId === 'string' ? o.parentCtpId : undefined,
      version:
        typeof o.version === 'string' || typeof o.version === 'number'
          ? o.version
          : undefined,
    });
  }
  return out;
}

function buildCtpListExcludingBase(
  rawChildren: RawCtp[],
  baseById: Map<string, RawCtp>,
): {
  list: Ctp[];
  skippedNoBaseParent: number;
} {
  const out: Ctp[] = [];
  let skippedNoBaseParent = 0;
  for (const c of rawChildren) {
    if (c.type && c.type.toUpperCase() === 'BASE') continue;
    if (!c.parentCtpId || !baseById.has(c.parentCtpId)) {
      skippedNoBaseParent += 1;
      continue;
    }
    const parent = baseById.get(c.parentCtpId)!;
    const resolvedCode = parent.code ?? c.code;
    const resolvedName = parent.name ?? c.name ?? c.id;
    const resolvedVersion = parent.version ?? c.version;
    out.push({
      id: c.id,
      name: resolvedName,
      code: resolvedCode,
      abbreviation: c.abbreviation,
      type: c.type,
      parentCtpId: c.parentCtpId,
      version: resolvedVersion,
    });
  }

  out.sort((a, b) => {
    const ka = `${a.code ?? ''} ${a.name}`.toLocaleLowerCase();
    const kb = `${b.code ?? ''} ${b.name}`.toLocaleLowerCase();
    return ka.localeCompare(kb);
  });

  return { list: out, skippedNoBaseParent };
}

/** Collect BASE rows into a map (later entries overwrite earlier for same id). */
function indexBaseCtps(rows: RawCtp[]): Map<string, RawCtp> {
  const baseById = new Map<string, RawCtp>();
  for (const c of rows) {
    if (c.type && c.type.toUpperCase() === 'BASE') {
      baseById.set(c.id, c);
    }
  }
  return baseById;
}

function asTeachingPointList(body: unknown): TeachingPointRow[] {
  if (!body || typeof body !== 'object') return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return data.filter((x): x is TeachingPointRow => x !== null && typeof x === 'object');
}

function ctpListQuery(params: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    p.set(k, v);
  }
  return `/ctp/?${p.toString()}`;
}

/**
 * When `isInPositiveEndState` (or similar) filters the /ctp/ list, the response may omit
 * BASE parents. We then fetch BASE rows separately and merge so parent resolution still works.
 */
export async function listCtps(): Promise<Ctp[]> {
  const basePath = ctpListQuery({ limit: '1000', 'types[]': 'BASE' });
  const filteredPath = ctpListQuery({
    limit: '1000',
    isInPositiveEndState: 'true',
  });
  const cfg = getApiConfig();
  console.log('[e2Api] listCtps (BASE) →', `${cfg.e2ApiBaseUrl}${basePath}`);
  console.log('[e2Api] listCtps (filtered) →', `${cfg.e2ApiBaseUrl}${filteredPath}`);

  const [bodyBase, bodyFiltered] = await Promise.all([
    fetchAuthedJson(basePath),
    fetchAuthedJson(filteredPath),
  ]);

  const rawBases = parseRawCtps(bodyBase);
  const rawFiltered = parseRawCtps(bodyFiltered);

  let baseById = indexBaseCtps(rawBases);
  if (baseById.size === 0 && rawFiltered.length > 0) {
    console.warn(
      '[e2Api] listCtps: no BASE from types[]=BASE; fetching unfiltered /ctp/ for parent map',
    );
    const bodyAll = await fetchAuthedJson(ctpListQuery({ limit: '1000' }));
    baseById = indexBaseCtps(parseRawCtps(bodyAll));
  }

  for (const c of rawFiltered) {
    if (c.type && c.type.toUpperCase() === 'BASE') {
      baseById.set(c.id, c);
    }
  }

  const baseCount = baseById.size;
  const { list, skippedNoBaseParent } = buildCtpListExcludingBase(
    rawFiltered,
    baseById,
  );

  console.log(
    `[e2Api] listCtps ← ${list.length} CTP(s) (${baseCount} BASE id(s) for parents, ${skippedNoBaseParent} child rows skipped — no known BASE parent)`,
  );
  if (rawFiltered.length > 0 && list.length === 0 && skippedNoBaseParent > 0) {
    console.warn(
      '[e2Api] hint: filtered /ctp/ returned rows but none kept — check parentCtpId vs BASE ids, or increase BASE fetch (types[]=BASE).',
    );
  }
  return list;
}

export async function listTeachingPoints(ctpId: string): Promise<TeachingPointRow[]> {
  const q =
    `/ctp-teaching-points?limit=1000` +
    `&ctpIds%5B%5D=${encodeURIComponent(ctpId)}` +
    `&includeBloomVerb=true` +
    `&includeParentOrders=true`;
  console.log('[e2Api] listTeachingPoints →', ctpId);
  const body = await fetchAuthedJson(q);
  const rows = asTeachingPointList(body);
  console.log(`[e2Api] listTeachingPoints ← ${rows.length} row(s)`);
  if (rows.length > 0) {
    const sample = rows[0];
    console.log('[e2Api] sample row keys:', Object.keys(sample).join(', '));
    console.log('[e2Api] sample toOrder=%s eoOrder=%s order=%s', sample.toOrder, sample.eoOrder, sample.order);
  }
  return rows;
}
