/** Teaching-point code rule from E2 API: TP. {toOrder}.{eoOrder}.{order} */

export interface E2TeachingPointOrders {
  toOrder?: unknown;
  eoOrder?: unknown;
  order?: unknown;
}

function isFiniteNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Returns null if any order field is missing or not a finite number. */
export function formatE2TeachingPointCode(
  tp: E2TeachingPointOrders,
): string | null {
  if (!isFiniteNum(tp.toOrder) || !isFiniteNum(tp.eoOrder) || !isFiniteNum(tp.order)) {
    return null;
  }
  return `TP. ${tp.toOrder}.${tp.eoOrder}.${tp.order}`;
}

export function computeCodesFromTeachingPoints(
  rows: E2TeachingPointOrders[],
): { codes: string[]; skipped: number } {
  const codes: string[] = [];
  let skipped = 0;
  for (const row of rows) {
    const code = formatE2TeachingPointCode(row);
    if (code !== null) codes.push(code);
    else skipped += 1;
  }
  return { codes, skipped };
}
