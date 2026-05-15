import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [collapsed, setCollapsed] = useState(false);
  const [viewCodesOpen, setViewCodesOpen] = useState(false);
  const [copyCodesState, setCopyCodesState] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );
  const [pickerFocusRevision, setPickerFocusRevision] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const valueSigRef = useRef('');

  useEffect(() => {
    if (!value) {
      valueSigRef.current = '';
      setCollapsed(false);
      setViewCodesOpen(false);
      return;
    }
    const sig = `${value.filename}|${value.count}|${value.source ?? ''}`;
    if (valueSigRef.current !== sig) {
      valueSigRef.current = sig;
      setCollapsed(true);
      setViewCodesOpen(false);
    }
  }, [value]);

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

  const handleChangeSource = () => {
    if (value) {
      setSourceTab(value.source === 'api' ? 'api' : 'file');
    }
    setPickerFocusRevision((n) => n + 1);
    setCollapsed(false);
  };

  const sortedCodes = useMemo(() => {
    if (!value || value.count === 0) return [];
    return Array.from(value.codes).sort((a, b) => a.localeCompare(b));
  }, [value]);

  const handleCopyCodes = async () => {
    try {
      await navigator.clipboard.writeText(sortedCodes.join('\n'));
      setCopyCodesState('copied');
      window.setTimeout(() => setCopyCodesState('idle'), 1500);
    } catch {
      setCopyCodesState('error');
      window.setTimeout(() => setCopyCodesState('idle'), 2000);
    }
  };

  const sourceKind: 'file' | 'api' | null = value
    ? value.source ?? (value.filename.startsWith('API:') ? 'api' : 'file')
    : null;

  const displayName =
    value && sourceKind === 'api'
      ? value.filename.replace(/^API:\s*/, '')
      : value?.filename ?? '';

  const panelHidden = !!value && collapsed;

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
              <strong className="tp-approved-name" title={displayName}>
                {displayName}
              </strong>
              <span className="tp-approved-meta">
                {value.count.toLocaleString()} codes
              </span>
            </span>
            <span className="tp-approved-actions">
              {sortedCodes.length > 0 && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setViewCodesOpen((v) => !v)}
                  aria-expanded={viewCodesOpen}
                >
                  {viewCodesOpen ? 'Hide codes' : 'View codes'}
                </button>
              )}
              <button type="button" className="ghost" onClick={handleChangeSource}>
                Change source
              </button>
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

      {viewCodesOpen && sortedCodes.length > 0 && (
        <div className="tp-approved-codes" role="region" aria-label="Approved teaching point codes">
          <div className="tp-approved-codes-head">
            <span className="tp-approved-codes-title">
              {sortedCodes.length.toLocaleString()} code{sortedCodes.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className="ghost tp-approved-codes-copy"
              onClick={() => void handleCopyCodes()}
              title="Copy all codes to clipboard"
            >
              {copyCodesState === 'copied'
                ? 'Copied'
                : copyCodesState === 'error'
                  ? 'Copy failed'
                  : 'Copy all'}
            </button>
          </div>
          <div className="tp-approved-codes-grid" role="list">
            {sortedCodes.map((c) => (
              <code key={c} role="listitem" className="tp-api-code-chip" title={c}>
                {c}
              </code>
            ))}
          </div>
        </div>
      )}

      <div
        className={`tp-source-stack ${panelHidden ? 'tp-source-stack--collapsed' : ''}`}
        aria-hidden={panelHidden}
      >
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

          {sourceTab === 'api' && (
            <TpApiSync
              value={value}
              onChange={onChange}
              pickerFocusRevision={pickerFocusRevision}
            />
          )}
        </div>
      </div>
    </div>
  );
}
