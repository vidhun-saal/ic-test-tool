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

  useEffect(() => {
    if (config) setActorText(safeStringify(config.actor));
  }, [config]);

  if (!pkg || !config) {
    return (
      <div className="toolbar">
        <div className="toolbar-summary">
          <span style={{ color: 'var(--text-muted)' }}>
            No package loaded.
          </span>
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
      <div className="toolbar-row" style={{ justifyContent: 'space-between' }}>
        <div className="toolbar-summary">
          <span className="pkg" title={pkg.originalName}>
            {pkg.originalName}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            entry: {pkg.entryPath}
          </span>
        </div>
        <div className="toolbar-row">
          <button onClick={onRelaunch} className="primary">
            Relaunch
          </button>
          <button onClick={onOpenExternal}>Open in browser</button>
          <button onClick={onClear} className="ghost">
            Clear log
          </button>
          <button onClick={onUnload} className="danger">
            Unload
          </button>
        </div>
      </div>

      <div className="toolbar-row" style={{ marginTop: 8 }}>
        <button
          className="disclose-btn"
          onClick={() => setExpanded((x) => !x)}
        >
          {expanded ? '▾' : '▸'} Launch parameters
        </button>
        {launchUrl && (
          <span
            className="pkg"
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
            title={launchUrl}
          >
            {launchUrl}
          </span>
        )}
      </div>

      {expanded && (
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
      )}
    </div>
  );
}
