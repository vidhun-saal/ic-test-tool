import { useMemo, useState } from 'react';
import type { HttpLogEntry } from '../../../electron/shared/types';
import { JsonView } from './JsonView';

interface Props {
  entries: HttpLogEntry[];
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

function statusClass(status: number): string {
  if (status >= 500) return 's5';
  if (status >= 400) return 's4';
  if (status >= 300) return 's3';
  if (status >= 200) return 's2';
  return '';
}

export function HttpLog({ entries }: Props) {
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!filter.trim()) return entries;
    const q = filter.trim().toLowerCase();
    return entries.filter(
      (e) =>
        e.url.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        String(e.status).includes(q),
    );
  }, [entries, filter]);

  if (entries.length === 0) {
    return (
      <div className="list">
        <div className="empty-state">
          <div className="icon">🌐</div>
          <div>No HTTP traffic captured yet.</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>
            xAPI requests to the local LRS will be logged here with headers and
            body.
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
          placeholder="Filter by URL, method, status…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="list">
        {filtered.map((e) => {
          const isOpen = openId === e.id;
          return (
            <div
              key={e.id}
              className={`http-row ${isOpen ? 'open' : ''}`}
              onClick={() => setOpenId(isOpen ? null : e.id)}
            >
              <div className="row-summary">
                <span className="row-time">{formatTime(e.timestamp)}</span>
                <span className={`method-pill ${e.method}`}>{e.method}</span>
                <span className={`status-pill ${statusClass(e.status)}`}>
                  {e.status}
                </span>
                <span className="row-detail" title={e.url}>
                  {e.url}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {e.durationMs}ms
                </span>
              </div>
              {isOpen && (
                <div className="row-expanded" onClick={(ev) => ev.stopPropagation()}>
                  <div className="row-section">Request headers</div>
                  <JsonView value={e.requestHeaders} maxHeight={220} />
                  {e.requestBody && (
                    <>
                      <div className="row-section">Request body</div>
                      <JsonView text={e.requestBody} maxHeight={360} />
                    </>
                  )}
                  {e.responseBody && (
                    <>
                      <div className="row-section">Response body</div>
                      <JsonView text={e.responseBody} maxHeight={360} />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="list-empty">No requests match your filter.</div>
        )}
      </div>
    </div>
  );
}
