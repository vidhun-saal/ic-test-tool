import { useMemo, useState } from 'react';
import type { XapiStatement } from '../../../electron/shared/types';
import { JsonView } from './JsonView';

interface Props {
  statements: XapiStatement[];
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
    const en = def.name['en-US'] ?? def.name['en'];
    if (en) return en;
    const first = Object.values(def.name)[0];
    if (first) return first;
  }
  if (typeof object.id === 'string') return object.id;
  return '';
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

export function StatementList({ statements }: Props) {
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!filter.trim()) return statements;
    const q = filter.trim().toLowerCase();
    return statements.filter((s) => {
      const haystack = [
        verbName(s.verb),
        actorName(s.actor),
        objectName(s.object),
        s.verb?.id ?? '',
        typeof s.object?.id === 'string' ? s.object.id : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [statements, filter]);

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
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <input
          placeholder="Filter by verb, actor, object…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="list">
        {filtered.map((s) => {
          const isOpen = openId === s.id;
          const verb = verbName(s.verb);
          const verbClass = verb.toLowerCase().replace(/\s+/g, '-');
          return (
            <div
              key={s.id}
              className={`statement-row ${isOpen ? 'open' : ''}`}
              onClick={() => setOpenId(isOpen ? null : (s.id ?? null))}
            >
              <div className="row-summary">
                <span className="row-time">{formatTime(s.stored ?? s.timestamp)}</span>
                <span className={`verb-pill ${verbClass}`}>{verb}</span>
                <span className="row-detail" title={objectName(s.object)}>
                  <span style={{ color: 'var(--text-dim)' }}>
                    {actorName(s.actor)}
                  </span>
                  {objectName(s.object) && (
                    <>
                      <span style={{ color: 'var(--text-muted)' }}> → </span>
                      {objectName(s.object)}
                    </>
                  )}
                </span>
              </div>
              {isOpen && (
                <div className="row-expanded" onClick={(e) => e.stopPropagation()}>
                  <JsonView value={s} defaultExpandDepth={3} stringCollapse={500} maxHeight={480} />
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="list-empty">No statements match your filter.</div>
        )}
      </div>
    </div>
  );
}
