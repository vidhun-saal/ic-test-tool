import { useMemo, useState } from 'react';
import type { XapiStatement } from '../../../electron/shared/types';
import {
  validateTpLabel,
  type TpIssue,
} from '../lib/tpApproved';
import {
  extractTpNameFromStatement,
  parseTpName,
  type ParseTpNameResult,
} from '../../../electron/shared/tpValidator';
import { JsonView } from './JsonView';

interface Props {
  statements: XapiStatement[];
  approvedCodes: Set<string> | null;
}

interface DecoratedStatement {
  s: XapiStatement;
  tpRaw: string | null;
  tp: ParseTpNameResult | null;
  issue: TpIssue;
  reason?: string;
}

function verbName(verb: XapiStatement['verb']): string {
  if (!verb || !verb.id) return 'unknown';
  if (verb.display) {
    const en = verb.display['en-US'] ?? verb.display['en'];
    if (en) return en;
    const first = Object.values(verb.display)[0];
    if (first) return first;
  }
  const tail = verb.id.split('/').pop();
  return tail ?? verb.id;
}

function actorName(actor: XapiStatement['actor']): string {
  if (!actor) return 'unknown';
  if (actor.name) return actor.name;
  if (actor.mbox) return actor.mbox.replace(/^mailto:/, '');
  if (actor.account) return `${actor.account.name}@${actor.account.homePage}`;
  return 'unknown';
}

function objectName(object: XapiStatement['object']): string {
  if (!object) return '';
  const def = (object as { definition?: { name?: Record<string, string> } })
    .definition;
  if (def?.name) {
    const und = def.name['und'];
    if (und) return und;
    const en = def.name['en-US'] ?? def.name['en'];
    if (en) return en;
    const first = Object.values(def.name)[0];
    if (first) return first;
  }
  if (typeof object.id === 'string') return object.id;
  return '';
}

function statementObjectLabel(d: DecoratedStatement): string {
  return d.tpRaw ?? objectName(d.s.object);
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function rowReasonText(d: DecoratedStatement): string {
  if (d.issue === 'format') return `Invalid TP label: ${d.reason}`;
  if (d.issue === 'unknown') return d.reason ?? 'Unknown TP code';
  return '';
}

export function StatementList({ statements, approvedCodes }: Props) {
  const [filter, setFilter] = useState('');
  const [invalidOnly, setInvalidOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const decorated = useMemo<DecoratedStatement[]>(
    () =>
      statements.map((s) => {
        const tpRaw = extractTpNameFromStatement(s) ?? null;
        const tp = tpRaw !== null ? parseTpName(tpRaw) : null;
        const v = validateTpLabel(tpRaw, tp, approvedCodes);
        return {
          s,
          tpRaw,
          tp,
          issue: v.issue,
          reason: v.reason,
        };
      }),
    [statements, approvedCodes],
  );

  const invalidCount = useMemo(
    () => decorated.filter((d) => d.issue !== null).length,
    [decorated],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return decorated.filter((d) => {
      if (invalidOnly && d.issue === null) return false;
      if (!q) return true;
      const haystack = [
        verbName(d.s.verb),
        actorName(d.s.actor),
        statementObjectLabel(d),
        d.tpRaw ?? '',
        d.s.verb?.id ?? '',
        typeof d.s.object?.id === 'string' ? d.s.object.id : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [decorated, filter, invalidOnly]);

  if (statements.length === 0) {
    return (
      <div className="list">
        <div className="empty-state">
          <div className="icon">📡</div>
          <div>No xAPI statements received yet.</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>
            Statements posted by the course will appear here in real time.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div className="statement-toolbar">
        <input
          placeholder="Filter by verb, actor, object…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className={`statement-toolbar-toggle ${invalidOnly ? 'active' : ''}`}
          onClick={() => setInvalidOnly((v) => !v)}
          disabled={invalidCount === 0 && !invalidOnly}
          title={
            invalidCount === 0
              ? 'No statements with TP issues'
              : 'Show only statements with format or unknown-code TP issues'
          }
        >
          Invalid TP only
          <span className="count">{invalidCount}</span>
        </button>
      </div>
      <div className="list">
        {filtered.map((d) => {
          const isOpen = openId === d.s.id;
          const verb = verbName(d.s.verb);
          const verbClass = verb.toLowerCase().replace(/\s+/g, '-');
          const hasIssue = d.issue !== null;
          const label = statementObjectLabel(d);
          const rowClass =
            d.issue === 'unknown'
              ? 'tp-invalid tp-unknown'
              : d.issue === 'format'
                ? 'tp-invalid'
                : '';
          return (
            <div
              key={d.s.id}
              className={`statement-row ${isOpen ? 'open' : ''} ${rowClass}`}
              onClick={() => setOpenId(isOpen ? null : (d.s.id ?? null))}
            >
              <div className="row-summary">
                <span className="row-time">{formatTime(d.s.stored ?? d.s.timestamp)}</span>
                <span className={`verb-pill ${verbClass}`}>{verb}</span>
                <span className="row-detail" title={label}>
                  <span style={{ color: 'var(--text-dim)' }}>{actorName(d.s.actor)}</span>
                  {label && (
                    <>
                      <span style={{ color: 'var(--text-muted)' }}> → </span>
                      <span className={hasIssue ? 'tp-label-bad' : undefined}>{label}</span>
                    </>
                  )}
                </span>
              </div>
              {hasIssue && (
                <div
                  className={`tp-row-reason ${d.issue === 'unknown' ? 'tp-row-reason-unknown' : ''}`}
                >
                  <span className="tp-row-reason-icon" aria-hidden="true">!</span>
                  {rowReasonText(d)}
                </div>
              )}
              {isOpen && (
                <div className="row-expanded" onClick={(e) => e.stopPropagation()}>
                  <JsonView value={d.s} defaultExpandDepth={3} stringCollapse={500} maxHeight={480} />
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="list-empty">
            {invalidOnly
              ? 'No statements with TP format or unknown-code issues.'
              : 'No statements match your filter.'}
          </div>
        )}
      </div>
    </div>
  );
}
