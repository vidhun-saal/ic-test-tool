import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Ctp, KeycloakStatus } from '../../../electron/shared/types';
import { computeCodesFromTeachingPoints } from '../../../electron/shared/tpE2Format';
import { lms } from '../lib/ipc';
import type { ApprovedCodesState } from './TpApprovedLoader';
import {
  SearchableSelect,
  type SearchableOption,
} from './SearchableSelect';

interface Props {
  onChange: (value: ApprovedCodesState | null) => void;
  value: ApprovedCodesState | null;
}

type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'success'; codes: number; skipped: number; ctpName: string }
  | { kind: 'empty'; ctpName: string }
  | { kind: 'error'; message: string };

function formatCtpLabel(c: Ctp): string {
  const versionStr =
    c.version !== undefined && c.version !== null && `${c.version}`.trim() !== ''
      ? `v${c.version}`
      : '';
  return [c.code, c.name, versionStr]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .join(' - ');
}

function formatExpiry(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TpApiSync({ onChange, value }: Props) {
  const [kc, setKc] = useState<KeycloakStatus | null>(null);
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' });
  const [ctpList, setCtpList] = useState<Ctp[]>([]);
  const [ctpId, setCtpId] = useState('');
  const [busy, setBusy] = useState<'ctps' | 'sync' | 'login' | null>(null);
  const [showCodes, setShowCodes] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const refreshCtps = useCallback(async () => {
    setStatus({ kind: 'idle' });
    setBusy('ctps');
    try {
      const list = await lms.listCtps();
      setCtpList(list);
      setCtpId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? '';
      });
    } catch (e) {
      setCtpList([]);
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void lms.kcStatus().then(setKc);
    const off = lms.onKcStatus((s) => {
      setKc(s);
      if (s.state === 'logged-in') {
        void refreshCtps();
      } else {
        setCtpList([]);
        setCtpId('');
        setStatus({ kind: 'idle' });
      }
    });
    return off;
  }, [refreshCtps]);

  const handleLogin = async () => {
    setStatus({ kind: 'idle' });
    setBusy('login');
    try {
      const r = await lms.kcLogin();
      if (!r.ok) {
        if (r.error !== 'cancelled') {
          setStatus({ kind: 'error', message: r.error ?? 'Login failed' });
        }
        return;
      }
      await refreshCtps();
    } finally {
      setBusy(null);
    }
  };

  const handleLogout = async () => {
    await lms.kcLogout();
    setCtpList([]);
    setCtpId('');
    setStatus({ kind: 'idle' });
    if (value?.source === 'api') {
      onChange(null);
    }
  };

  const handleSync = async () => {
    if (!ctpId.trim()) return;
    setBusy('sync');
    setStatus({ kind: 'idle' });
    try {
      const rows = await lms.listTeachingPoints(ctpId.trim());
      const { codes, skipped } = computeCodesFromTeachingPoints(rows);
      const ctpMeta = ctpList.find((c) => c.id === ctpId.trim()) ?? null;
      const ctpName = ctpMeta ? formatCtpLabel(ctpMeta) : ctpId.trim();
      onChange({
        codes: new Set(codes),
        filename: ctpName,
        count: codes.length,
        source: 'api',
      });
      setStatus(
        codes.length === 0
          ? { kind: 'empty', ctpName }
          : { kind: 'success', codes: codes.length, skipped, ctpName },
      );
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const loggedIn = kc?.state === 'logged-in';
  const username = loggedIn ? kc.username : undefined;
  const expiryAt = loggedIn ? formatExpiry(kc.expiresAt) : '';

  const ctpOptions = useMemo<SearchableOption[]>(
    () =>
      ctpList.map((c) => ({
        id: c.id,
        label: formatCtpLabel(c),
        subtitle: c.id,
        searchText: [c.code, c.abbreviation, c.name, `${c.version ?? ''}`].join(' '),
      })),
    [ctpList],
  );

  const sortedSyncedCodes = useMemo<string[]>(() => {
    if (!value || value.source !== 'api') return [];
    return Array.from(value.codes).sort((a, b) => a.localeCompare(b));
  }, [value]);

  const handleCopyCodes = async () => {
    try {
      await navigator.clipboard.writeText(sortedSyncedCodes.join('\n'));
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  if (!loggedIn) {
    return (
      <div className="tp-api-sync">
        <div className="tp-api-card tp-api-signin">
          <div className="tp-api-card-body">
            <div className="tp-api-card-title">Sync from e2 question bank</div>
            <p className="tp-api-card-text">
              Sign in with Keycloak to load curriculum topic packages and pull approved teaching-point
              codes directly from the API.
            </p>
          </div>
          <button
            type="button"
            className="primary tp-api-signin-btn"
            disabled={busy === 'login'}
            onClick={() => void handleLogin()}
          >
            {busy === 'login' ? 'Opening sign-in…' : 'Sign in with Keycloak'}
          </button>
        </div>
        {status.kind === 'error' && (
          <div className="tp-approved-error" role="alert">
            {status.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tp-api-sync">
      <div className="tp-api-conn">
        <span className="tp-api-conn-dot" aria-hidden />
        <span className="tp-api-conn-text">
          Connected as <strong>{username ?? 'user'}</strong>
          {expiryAt && (
            <span className="tp-api-conn-expiry" title={`Token expires at ${expiryAt}`}>
              {' · '}token until {expiryAt}
            </span>
          )}
        </span>
        <button
          type="button"
          className="tp-api-link"
          onClick={() => void handleLogout()}
          disabled={!!busy}
        >
          Sign out
        </button>
      </div>

      {ctpList.length === 0 && busy !== 'ctps' ? (
        <div className="tp-api-empty">
          <div className="tp-api-empty-text">
            No curriculum topic packages available for this account.
          </div>
          <button
            type="button"
            className="tp-api-link"
            onClick={() => void refreshCtps()}
            disabled={!!busy}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="tp-api-picker">
            <SearchableSelect
              options={ctpOptions}
              value={ctpId}
              onChange={setCtpId}
              disabled={!!busy || ctpList.length === 0}
              placeholder={
                busy === 'ctps' && ctpList.length === 0
                  ? 'Loading packages…'
                  : 'Search by code, name, or version…'
              }
              ariaLabel="Curriculum topic package"
              emptyMessage="No matching packages"
            />
            <button
              type="button"
              className="primary"
              disabled={!!busy || !ctpId.trim()}
              onClick={() => void handleSync()}
            >
              {busy === 'sync' ? 'Syncing…' : 'Sync'}
            </button>
          </div>

          <div className="tp-api-actions">
            <span className="tp-api-actions-meta">
              {ctpList.length.toLocaleString()} packages
            </span>
            <button
              type="button"
              className="tp-api-link"
              onClick={() => void refreshCtps()}
              disabled={!!busy}
            >
              {busy === 'ctps' ? 'Refreshing…' : 'Refresh package list'}
            </button>
          </div>
        </>
      )}

      {status.kind === 'success' && (
        <>
          <div className="tp-api-status tp-api-status-ok" role="status">
            <span className="tp-api-status-icon" aria-hidden>✓</span>
            <span className="tp-api-status-text">
              Synced <strong>{status.codes.toLocaleString()}</strong> codes from{' '}
              <strong>{status.ctpName}</strong>
              {status.skipped > 0 && (
                <span className="tp-api-status-meta">
                  {' · '}
                  {status.skipped} row{status.skipped === 1 ? '' : 's'} skipped (missing order fields)
                </span>
              )}
            </span>
            <button
              type="button"
              className="tp-api-link"
              onClick={() => setShowCodes((v) => !v)}
              aria-expanded={showCodes}
            >
              {showCodes ? 'Hide codes' : 'View codes'}
            </button>
          </div>

          {showCodes && sortedSyncedCodes.length > 0 && (
            <div className="tp-api-codes" role="region" aria-label="Synced teaching point codes">
              <div className="tp-api-codes-head">
                <span className="tp-api-codes-title">
                  {sortedSyncedCodes.length.toLocaleString()} teaching-point code
                  {sortedSyncedCodes.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  className="ghost tp-api-codes-copy"
                  onClick={() => void handleCopyCodes()}
                  title="Copy all codes to clipboard"
                >
                  {copyState === 'copied'
                    ? '✓ Copied'
                    : copyState === 'error'
                      ? 'Copy failed'
                      : 'Copy all'}
                </button>
              </div>
              <div className="tp-api-codes-grid" role="list">
                {sortedSyncedCodes.map((c) => (
                  <code key={c} role="listitem" className="tp-api-code-chip" title={c}>
                    {c}
                  </code>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {status.kind === 'empty' && (
        <div className="tp-api-status tp-api-status-warn" role="status">
          <span className="tp-api-status-icon" aria-hidden>!</span>
          <span>
            <strong>{status.ctpName}</strong> returned no usable teaching-point codes.
            <span className="tp-api-status-meta">
              {' '}This package may not have any teaching points yet, or rows are missing the required
              order fields.
            </span>
          </span>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="tp-approved-error" role="alert">
          {status.message}
        </div>
      )}
    </div>
  );
}
