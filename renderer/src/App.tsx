import { useCallback, useEffect, useMemo, useState } from 'react';
import { lms } from './lib/ipc';
import { UploadDropzone } from './components/UploadDropzone';
import { LaunchToolbar } from './components/LaunchToolbar';
import { ContentFrame } from './components/ContentFrame';
import { StatementList } from './components/StatementList';
import { HttpLog } from './components/HttpLog';
import type {
  HttpLogEntry,
  LaunchConfig,
  PackageInfo,
  ServerInfo,
  UploadResult,
  XapiStatement,
} from '../../electron/shared/types';

type Tab = 'statements' | 'http';

function buildLaunchUrl(
  serverInfo: ServerInfo,
  pkg: PackageInfo,
  cfg: LaunchConfig,
): string {
  const base = `${serverInfo.baseUrl}${pkg.contentUrl}`;
  const params = new URLSearchParams();
  params.set('endpoint', cfg.endpoint);
  params.set('auth', cfg.auth);
  params.set('actor', JSON.stringify(cfg.actor));
  params.set('activity_id', cfg.activityId);
  params.set('registration', cfg.registration);
  return `${base}?${params.toString()}`;
}

export default function App() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [pkg, setPkg] = useState<PackageInfo | null>(null);
  const [launchConfig, setLaunchConfig] = useState<LaunchConfig | null>(null);
  const [statements, setStatements] = useState<XapiStatement[]>([]);
  const [httpLog, setHttpLog] = useState<HttpLogEntry[]>([]);
  const [tab, setTab] = useState<Tab>('statements');
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const state = await lms.getState();
      setServerInfo(state.serverInfo);
      setPkg(state.package);
      setStatements(state.statements);
      setHttpLog(state.httpLog);
    })();

    const offStatement = lms.onStatement((s) => {
      setStatements((prev) => [s, ...prev].slice(0, 1000));
    });
    const offHttp = lms.onHttp((h) => {
      setHttpLog((prev) => [h, ...prev].slice(0, 500));
    });
    return () => {
      offStatement();
      offHttp();
    };
  }, []);

  const launchUrl = useMemo(() => {
    if (!serverInfo || !pkg || !launchConfig) return null;
    return buildLaunchUrl(serverInfo, pkg, launchConfig);
  }, [serverInfo, pkg, launchConfig, reloadKey]);

  const onUploaded = useCallback((result: UploadResult) => {
    if (result.ok && result.package && result.defaultLaunch) {
      setPkg(result.package);
      setLaunchConfig(result.defaultLaunch);
      setError(null);
    }
  }, []);

  const handleRelaunch = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const handleClear = useCallback(async () => {
    await lms.clearLog();
    setStatements([]);
    setHttpLog([]);
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (launchUrl) {
      window.open(launchUrl, '_blank', 'noopener,noreferrer');
    }
  }, [launchUrl]);

  const handleUnload = useCallback(() => {
    setPkg(null);
    setLaunchConfig(null);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className={`brand-dot ${serverInfo ? '' : 'idle'}`} />
          <h1>xAPI LMS Tester</h1>
        </div>
        <div className="meta">
          {serverInfo ? `LRS · ${serverInfo.baseUrl}/xapi/` : 'Starting…'}
        </div>
      </header>

      {error && <div className="notice">{error}</div>}

      <div className="app-body">
        <div className="left-pane">
          <LaunchToolbar
            pkg={pkg}
            config={launchConfig}
            launchUrl={launchUrl}
            onChange={setLaunchConfig}
            onRelaunch={handleRelaunch}
            onClear={handleClear}
            onOpenExternal={handleOpenExternal}
            onUnload={handleUnload}
          />
          {pkg && launchUrl ? (
            <ContentFrame src={launchUrl} reloadKey={reloadKey} />
          ) : (
            <UploadDropzone onUploaded={onUploaded} onError={setError} />
          )}
        </div>

        <div className="right-pane">
          <div className="tabs">
            <button
              className={`tab ${tab === 'statements' ? 'active' : ''}`}
              onClick={() => setTab('statements')}
            >
              xAPI Statements
              <span className="count">{statements.length}</span>
            </button>
            <button
              className={`tab ${tab === 'http' ? 'active' : ''}`}
              onClick={() => setTab('http')}
            >
              HTTP Log
              <span className="count">{httpLog.length}</span>
            </button>
          </div>
          <div className="right-pane-body">
            {tab === 'statements' ? (
              <StatementList statements={statements} />
            ) : (
              <HttpLog entries={httpLog} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
