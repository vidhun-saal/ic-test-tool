import { useMemo, useState } from 'react';
import type { TpEntry } from '../../../electron/shared/types';
import { issueLabel, validateTpEntry, type TpIssue } from '../lib/tpApproved';

interface Props {
  entries: TpEntry[];
  approvedCodes: Set<string> | null;
}

interface InvalidRow {
  entry: TpEntry;
  issue: TpIssue;
  reason: string;
}

function sourceLabel(sources: TpEntry['sources']): string {
  if (sources.includes('static') && sources.includes('live')) return 'package + live';
  if (sources.includes('static')) return 'package';
  if (sources.includes('live')) return 'live';
  return '—';
}

function whereSeen(e: TpEntry): string {
  const parts: string[] = [];
  if (e.files?.length) {
    parts.push(
      e.files.length <= 2 ? e.files.join(', ') : `${e.files.length} files`,
    );
  }
  if (e.statementIds?.length) {
    parts.push(`${e.statementIds.length} statement${e.statementIds.length === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}

function bannerText(
  rows: InvalidRow[],
  approvedCodes: Set<string> | null,
): string {
  const formatCount = rows.filter((r) => r.issue === 'format').length;
  const unknownCount = rows.filter((r) => r.issue === 'unknown').length;
  const parts: string[] = [];

  if (formatCount > 0) {
    parts.push(
      `${formatCount} format ${formatCount === 1 ? 'error' : 'errors'} (required: tpcode : name)`,
    );
  }
  if (unknownCount > 0) {
    parts.push(
      `${unknownCount} unknown ${unknownCount === 1 ? 'code' : 'codes'} (not in approved list)`,
    );
  }

  const summary = parts.join(' · ');
  if (approvedCodes === null && formatCount > 0) {
    return `${summary}. Approved list not loaded — only format checked.`;
  }
  return summary;
}

export function TpInvalidSummary({ entries, approvedCodes }: Props) {
  const [open, setOpen] = useState(false);

  const invalid = useMemo(() => {
    const rows: InvalidRow[] = [];
    for (const entry of entries) {
      const v = validateTpEntry(entry, approvedCodes);
      if (v.issue) {
        rows.push({
          entry,
          issue: v.issue,
          reason: v.reason ?? issueLabel(v.issue),
        });
      }
    }
    return rows;
  }, [entries, approvedCodes]);

  if (invalid.length === 0) return null;

  const showIssueCol = approvedCodes !== null;

  return (
    <div className="tp-summary tp-summary-warn" role="alert">
      <button
        type="button"
        className="tp-summary-bar"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="tp-summary-pill">{invalid.length}</span>
        <span className="tp-summary-icon" aria-hidden="true">!</span>
        <span className="tp-summary-text">
          Teaching Point {invalid.length === 1 ? 'issue' : 'issues'} in this package —{' '}
          {bannerText(invalid, approvedCodes)}
        </span>
        <span className="tp-summary-toggle" aria-hidden="true">
          {open ? 'Hide details ▴' : 'Show details ▾'}
        </span>
      </button>

      {open && (
        <div className="tp-summary-list">
          <div
            className={`tp-summary-row tp-summary-head ${showIssueCol ? 'with-issue' : ''}`}
          >
            <div>Label</div>
            {showIssueCol && <div>Issue</div>}
            <div>Reason</div>
            <div>Source</div>
            <div>Where</div>
          </div>
          {invalid.map(({ entry: e, issue, reason }) => (
            <div
              key={e.raw}
              className={`tp-summary-row ${showIssueCol ? 'with-issue' : ''}`}
            >
              <div className="tp-summary-raw" title={e.raw}>
                {e.raw || <em>(empty)</em>}
              </div>
              {showIssueCol && (
                <div>
                  <span className={`tp-issue-pill tp-issue-${issue}`}>
                    {issueLabel(issue)}
                  </span>
                </div>
              )}
              <div className="tp-summary-reason">{reason}</div>
              <div className="tp-summary-source">{sourceLabel(e.sources)}</div>
              <div className="tp-summary-where" title={whereSeen(e)}>
                {whereSeen(e) || '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
