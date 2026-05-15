import { useRef, useState } from 'react';
import { parseApprovedJson } from '../lib/tpApproved';

export interface ApprovedCodesState {
  codes: Set<string>;
  filename: string;
  count: number;
}

interface Props {
  value: ApprovedCodesState | null;
  onChange: (value: ApprovedCodesState | null) => void;
}

export function TpApprovedLoader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
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
        {value ? (
          <>
            <span className="tp-approved-label">
              Approved codes: <strong>{value.filename}</strong>
              <span className="tp-approved-meta"> · {value.count} codes</span>
            </span>
            <span className="tp-approved-actions">
              <button type="button" className="ghost" onClick={openPicker}>
                Replace…
              </button>
              <button type="button" className="ghost" onClick={handleClear}>
                Clear
              </button>
            </span>
          </>
        ) : (
          <>
            <span className="tp-approved-label muted">
              Approved TP codes not loaded — format-only checks active
            </span>
            <button type="button" className="primary" onClick={openPicker}>
              Load JSON…
            </button>
          </>
        )}
      </div>

      {parseError && (
        <div className="tp-approved-error" role="alert">
          {parseError}
        </div>
      )}
      {warn && !parseError && <div className="tp-approved-warn">{warn}</div>}
    </div>
  );
}
