import { useEffect, useState } from 'react';
import type {
  LaunchConfig,
  PackageInfo,
} from '../../../electron/shared/types';

interface Props {
  pkg: PackageInfo | null;
  config: LaunchConfig | null;
  launchUrl: string | null;
  onChange: (next: LaunchConfig) => void;
  onRelaunch: () => void;
  onClear: () => void;
  onOpenExternal: () => void;
  onUnload: () => void;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return '';
  }
}

export function LaunchToolbar({
  pkg,
  config,
  launchUrl,
  onChange,
  onRelaunch,
  onClear,
  onOpenExternal,
  onUnload,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [actorText, setActorText] = useState('');
  const [actorError, setActorError] = useState<string | null>(null);
  const [copyUrlState, setCopyUrlState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (config) setActorText(safeStringify(config.actor));
  }, [config]);

  const copyLaunchUrl = async () => {
    if (!launchUrl) return;
    try {
      await navigator.clipboard.writeText(launchUrl);
      setCopyUrlState('copied');
      window.setTimeout(() => setCopyUrlState('idle'), 1500);
    } catch {
      setCopyUrlState('error');
      window.setTimeout(() => setCopyUrlState('idle'), 2000);
    }
  };

  if (!pkg || !config) {
    return (
      <div className="toolbar">
        <div className="toolbar-summary">
          <span style={{ color: 'var(--text-muted)' }}>No package loaded.</span>
        </div>
      </div>
    );
  }

  const update = (patch: Partial<LaunchConfig>) =>
    onChange({ ...config, ...patch });

  const onActorBlur = () => {
    try {
      const parsed = JSON.parse(actorText);
      setActorError(null);
      onChange({ ...config, actor: parsed });
    } catch (e) {
      setActorError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-row toolbar-row-main">
        <div className="toolbar-summary">
          <span className="pkg" title={pkg.originalName}>
            {pkg.originalName}
          </span>
          <span className="toolbar-summary-meta">
            entry: {pkg.entryPath}
          </span>
        </div>
        <div className="toolbar-actions-group">
          <button type="button" onClick={onRelaunch} className="primary">
            Relaunch
          </button>
          <button type="button" onClick={onOpenExternal}>
            Open in browser
          </button>
          <button type="button" onClick={copyLaunchUrl} className="ghost" title="Copy launch URL">
            {copyUrlState === 'copied'
              ? 'Copied URL'
              : copyUrlState === 'error'
                ? 'Copy failed'
                : 'Copy URL'}
          </button>
          <button type="button" onClick={onClear} className="ghost">
            Clear log
          </button>
          <button type="button" onClick={onUnload} className="danger">
            Unload
          </button>
        </div>
      </div>

      <div className="toolbar-row toolbar-row-disclose">
        <button
          type="button"
          className="disclose-btn"
          onClick={() => setExpanded((x) => !x)}
        >
          {expanded ? '▾' : '▸'} Launch parameters
        </button>
      </div>

      {expanded && (
        <>
          {launchUrl && (
            <div className="toolbar-launch-url">
              <label className="toolbar-launch-url-label">Launch URL (sensitive — do not share)</label>
              <div className="toolbar-launch-url-row">
                <input readOnly value={launchUrl} className="toolbar-launch-url-field" spellCheck={false} />
                <button type="button" className="ghost" onClick={() => void copyLaunchUrl()}>
                  Copy
                </button>
              </div>
            </div>
          )}
          <div className="toolbar-grid">
            <div className="toolbar-field">
              <label>Endpoint</label>
              <input
                value={config.endpoint}
                onChange={(e) => update({ endpoint: e.target.value })}
              />
            </div>
            <div className="toolbar-field">
              <label>Auth</label>
              <input
                value={config.auth}
                onChange={(e) => update({ auth: e.target.value })}
              />
            </div>
            <div className="toolbar-field">
              <label>Activity ID</label>
              <input
                value={config.activityId}
                onChange={(e) => update({ activityId: e.target.value })}
              />
            </div>
            <div className="toolbar-field">
              <label>Registration</label>
              <input
                value={config.registration}
                onChange={(e) => update({ registration: e.target.value })}
              />
            </div>
            <div className="toolbar-field full">
              <label>
                Actor (JSON){' '}
                {actorError && (
                  <span style={{ color: 'var(--danger)', textTransform: 'none' }}>
                    · {actorError}
                  </span>
                )}
              </label>
              <textarea
                value={actorText}
                onChange={(e) => setActorText(e.target.value)}
                onBlur={onActorBlur}
                spellCheck={false}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
