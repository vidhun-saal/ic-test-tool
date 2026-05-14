import { useCallback, useMemo, useState } from 'react';

type ViewMode = 'tree' | 'raw';

export interface JsonViewProps {
  /** Parsed JSON value (preferred). */
  value?: unknown;
  /** Raw string; parsed as JSON when possible, otherwise shown as text. */
  text?: string;
  /** How many nesting levels start expanded in tree mode. */
  defaultExpandDepth?: number;
  /** Collapse string values longer than this in tree mode (0 = never). */
  stringCollapse?: number;
  maxHeight?: number;
  className?: string;
}

function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function formatRaw(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function copyText(s: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(s);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="jsonv-null">null</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="jsonv-bool">{value ? 'true' : 'false'}</span>;
  }
  if (typeof value === 'number') {
    return (
      <span className="jsonv-num">
        {Number.isFinite(value) ? String(value) : JSON.stringify(value)}
      </span>
    );
  }
  if (typeof value === 'string') {
    return <span className="jsonv-str">{JSON.stringify(value)}</span>;
  }
  if (typeof value === 'undefined') {
    return <span className="jsonv-undef">undefined</span>;
  }
  return <span className="jsonv-str">{JSON.stringify(value)}</span>;
}

function KeyLabel({ name }: { name: string | number }) {
  if (typeof name === 'number') {
    return <span className="jsonv-key jsonv-index">{name}</span>;
  }
  return <span className="jsonv-key">{JSON.stringify(name)}</span>;
}

interface NodeProps {
  name: string | number | null;
  value: unknown;
  depth: number;
  defaultExpandDepth: number;
  stringCollapse: number;
}

function CollapsedString({ s, limit }: { s: string; limit: number }) {
  const [full, setFull] = useState(false);
  if (full || s.length <= limit) {
    return <span className="jsonv-str">{JSON.stringify(s)}</span>;
  }
  const partial = JSON.stringify(s.slice(0, limit));
  const head = partial.slice(0, -1);
  return (
    <span className="jsonv-str-wrap">
      <span className="jsonv-str">
        {head}
        <span className="jsonv-str-trunc">…</span>&quot;
      </span>
      <button
        type="button"
        className="jsonv-more"
        onClick={(e) => {
          e.stopPropagation();
          setFull(true);
        }}
      >
        Show all ({s.length} chars)
      </button>
    </span>
  );
}

function JsonNode({
  name,
  value,
  depth,
  defaultExpandDepth,
  stringCollapse,
}: NodeProps) {
  const isArr = Array.isArray(value);
  const isObj = value !== null && typeof value === 'object' && !isArr;
  const composite = isArr || isObj;
  const keys = isObj ? Object.keys(value as object) : [];
  const len = isArr ? (value as unknown[]).length : keys.length;
  const empty = composite && len === 0;

  const [open, setOpen] = useState(
    () => !composite || empty || depth < defaultExpandDepth,
  );

  if (!composite) {
    return (
      <div className="jsonv-line" style={{ paddingLeft: depth * 14 }}>
        {name !== null && (
          <>
            <KeyLabel name={name} />
            <span className="jsonv-punct">: </span>
          </>
        )}
        {typeof value === 'string' &&
        stringCollapse > 0 &&
        value.length > stringCollapse ? (
          <CollapsedString s={value} limit={stringCollapse} />
        ) : (
          <JsonPrimitive value={value} />
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="jsonv-line" style={{ paddingLeft: depth * 14 }}>
        {name !== null && (
          <>
            <KeyLabel name={name} />
            <span className="jsonv-punct">: </span>
          </>
        )}
        <span className="jsonv-punct">{isArr ? '[]' : '{}'}</span>
      </div>
    );
  }

  const summary = isArr ? `Array(${len})` : `Object(${len})`;

  return (
    <div className="jsonv-branch">
      <div
        className="jsonv-line jsonv-line-toggle"
        style={{ paddingLeft: depth * 14 }}
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <span className="jsonv-chevron">{open ? '▾' : '▸'}</span>
        {name !== null && (
          <>
            <KeyLabel name={name} />
            <span className="jsonv-punct">: </span>
          </>
        )}
        <span className="jsonv-meta">{summary}</span>
      </div>
      {open && (
        <div className="jsonv-children">
          {isArr
            ? (value as unknown[]).map((item, i) => (
                <JsonNode
                  key={i}
                  name={i}
                  value={item}
                  depth={depth + 1}
                  defaultExpandDepth={defaultExpandDepth}
                  stringCollapse={stringCollapse}
                />
              ))
            : keys.map((k) => (
                <JsonNode
                  key={k}
                  name={k}
                  value={(value as Record<string, unknown>)[k]}
                  depth={depth + 1}
                  defaultExpandDepth={defaultExpandDepth}
                  stringCollapse={stringCollapse}
                />
              ))}
        </div>
      )}
    </div>
  );
}

export function JsonView({
  value: valueProp,
  text,
  defaultExpandDepth = 3,
  stringCollapse = 400,
  maxHeight = 420,
  className = '',
}: JsonViewProps) {
  const [mode, setMode] = useState<ViewMode>('tree');
  const [copied, setCopied] = useState(false);

  const { parsed, rawFallback, displayString } = useMemo(() => {
    if (valueProp !== undefined) {
      return {
        parsed: valueProp,
        rawFallback: null as string | null,
        displayString: formatRaw(valueProp),
      };
    }
    if (text !== undefined && text !== '') {
      const r = tryParse(text);
      if (r.ok) {
        return {
          parsed: r.value,
          rawFallback: null as string | null,
          displayString: formatRaw(r.value),
        };
      }
      return {
        parsed: null,
        rawFallback: text,
        displayString: text,
      };
    }
    return {
      parsed: null,
      rawFallback: null,
      displayString: '',
    };
  }, [valueProp, text]);

  const charCount = displayString.length;

  const handleCopy = useCallback(async () => {
    await copyText(displayString);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [displayString]);

  if (valueProp === undefined && (text === undefined || text === '')) {
    return null;
  }

  const canTree = parsed !== null && rawFallback === null;

  return (
    <div
      className={`jsonv ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="jsonv-toolbar">
        <div className="jsonv-toolbar-left">
          <button type="button" className="jsonv-btn" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          {canTree && (
            <>
              <button
                type="button"
                className={`jsonv-btn ${mode === 'tree' ? 'active' : ''}`}
                onClick={() => setMode('tree')}
              >
                Tree
              </button>
              <button
                type="button"
                className={`jsonv-btn ${mode === 'raw' ? 'active' : ''}`}
                onClick={() => setMode('raw')}
              >
                Raw
              </button>
            </>
          )}
        </div>
        <span className="jsonv-chars">{charCount.toLocaleString()} chars</span>
      </div>
      <div className="jsonv-scroll" style={{ maxHeight }}>
        {rawFallback !== null ? (
          <pre className="jsonv-fallback">{rawFallback}</pre>
        ) : mode === 'raw' ? (
          <pre className="jsonv-raw">{displayString}</pre>
        ) : (
          <div className="jsonv-tree">
            <JsonNode
              name={null}
              value={parsed}
              depth={0}
              defaultExpandDepth={defaultExpandDepth}
              stringCollapse={stringCollapse}
            />
          </div>
        )}
      </div>
    </div>
  );
}
