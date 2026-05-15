import { useRef, useState } from 'react';
import { parseApprovedJson } from '../lib/tpApproved';
import { TpApiSync } from './TpApiSync';

export interface ApprovedCodesState {
  codes: Set<string>;
  filename: string;
  count: number;
  source?: 'file' | 'api';
}

interface Props {
  value: ApprovedCodesState | null;
  onChange: (value: ApprovedCodesState | null) => void;
}

type SourceTab = 'file' | 'api';

export function TpApprovedLoader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceTab, setSourceTab] = useState<SourceTab>('file');
  const [parseError, setParseError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const openPicker = () => inputRef.current?.click();

  const handleFile = (file: File | undefined) => {
    setParseError(null);
    setWarn(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const result = parseApprovedJson(text);
      if (result.error) {
        setParseError(result.error);
        onChange(null);
        return;
      }
      setWarn(result.warn ?? null);
      onChange({
        codes: result.codes,
        filename: file.name,
        count: result.count,
        source: 'file',
      });
    };
    reader.onerror = () => {
      setParseError('Could not read file');
      onChange(null);
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    setParseError(null);
    setWarn(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const sourceKind: 'file' | 'api' | null = value
    ? value.source ?? (value.filename.startsWith('API:') ? 'api' : 'file')
    : null;

  return (
    <div className="tp-approved-wrap">
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="tp-approved-file-input"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className={`tp-approved-bar ${value ? 'loaded' : ''}`}>
        {value && sourceKind ? (
          <>
            <span className="tp-approved-label">
              <span
                className={`tp-source-badge tp-source-badge-${sourceKind}`}
                title={sourceKind === 'api' ? 'Synced from e2 API' : 'Loaded from JSON file'}
              >
                {sourceKind === 'api' ? 'API' : 'FILE'}
              </span>
              <strong className="tp-approved-name">
                {sourceKind === 'api'
                  ? value.filename.replace(/^API:\s*/, '')
                  : value.filename}
              </strong>
              <span className="tp-approved-meta">
                {value.count.toLocaleString()} codes
              </span>
            </span>
            <span className="tp-approved-actions">
              {sourceKind === 'file' && (
                <button type="button" className="ghost" onClick={openPicker}>
                  Replace…
                </button>
              )}
              <button type="button" className="ghost" onClick={handleClear}>
                Clear
              </button>
            </span>
          </>
        ) : (
          <span className="tp-approved-label muted">
            Approved TP codes not loaded — format-only checks active
          </span>
        )}
      </div>

      <div className="tp-source-tabs" role="tablist" aria-label="Approved codes source">
        <button
          type="button"
          role="tab"
          id="tp-tab-file"
          aria-selected={sourceTab === 'file'}
          className={`tp-source-tab ${sourceTab === 'file' ? 'active' : ''}`}
          onClick={() => setSourceTab('file')}
        >
          From file
        </button>
        <button
          type="button"
          role="tab"
          id="tp-tab-api"
          aria-selected={sourceTab === 'api'}
          className={`tp-source-tab ${sourceTab === 'api' ? 'active' : ''}`}
          onClick={() => setSourceTab('api')}
        >
          From API
        </button>
      </div>

      <div
        role="tabpanel"
        aria-labelledby={sourceTab === 'file' ? 'tp-tab-file' : 'tp-tab-api'}
        className="tp-source-panel"
      >
        {sourceTab === 'file' && (
          <div className="tp-approved-file-pane">
            <p className="tp-source-intro muted">
              Load a JSON file of approved TP codes. Replacing clears any API-synced list.
            </p>
            <div className="tp-approved-file-actions">
              <button type="button" className="primary" onClick={openPicker}>
                {sourceKind === 'file' ? 'Replace JSON…' : 'Load JSON…'}
              </button>
            </div>
            {parseError && (
              <div className="tp-approved-error" role="alert">
                {parseError}
              </div>
            )}
            {warn && !parseError && <div className="tp-approved-warn">{warn}</div>}
          </div>
        )}

        {sourceTab === 'api' && <TpApiSync value={value} onChange={onChange} />}
      </div>
    </div>
  );
}
