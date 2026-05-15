import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

export interface SearchableOption {
  id: string;
  label: string;
  /** Optional secondary line (e.g. id, abbreviation). Also matched by search. */
  subtitle?: string;
  /** Extra free-text included in search matching but not displayed. */
  searchText?: string;
}

interface Props {
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  ariaLabel?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  disabled = false,
  emptyMessage = 'No matches',
  ariaLabel,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const haystack =
        `${o.label} ${o.subtitle ?? ''} ${o.searchText ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    if (item) {
      const top = item.offsetTop;
      const bottom = top + item.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = bottom - list.clientHeight;
      }
    }
  }, [highlight, isOpen]);

  const open = () => {
    if (disabled) return;
    setIsOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const close = () => {
    setIsOpen(false);
    setQuery('');
  };

  const select = (id: string) => {
    onChange(id);
    close();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) select(opt.id);
      return;
    }
    if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <div
      ref={wrapRef}
      className={`ssel ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
    >
      {!isOpen ? (
        <button
          type="button"
          className="ssel-trigger"
          onClick={open}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          title={selected?.subtitle}
        >
          <span
            className={`ssel-trigger-text ${selected ? '' : 'placeholder'}`}
          >
            {selected ? selected.label : placeholder}
          </span>
          <span className="ssel-trigger-caret" aria-hidden>
            ▾
          </span>
        </button>
      ) : (
        <div className="ssel-search-wrap">
          <span className="ssel-search-icon" aria-hidden>
            ⌕
          </span>
          <input
            ref={inputRef}
            type="text"
            className="ssel-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            aria-label={ariaLabel}
            aria-autocomplete="list"
            aria-controls="ssel-listbox"
            aria-activedescendant={
              filtered[highlight] ? `ssel-opt-${filtered[highlight].id}` : undefined
            }
          />
        </div>
      )}

      {isOpen && (
        <div
          ref={listRef}
          id="ssel-listbox"
          className="ssel-list"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <div className="ssel-empty">{emptyMessage}</div>
          ) : (
            filtered.map((o, i) => (
              <div
                key={o.id}
                id={`ssel-opt-${o.id}`}
                role="option"
                data-idx={i}
                aria-selected={o.id === value}
                className={`ssel-item ${i === highlight ? 'active' : ''} ${
                  o.id === value ? 'selected' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(o.id);
                }}
                onMouseEnter={() => setHighlight(i)}
                title={o.subtitle}
              >
                <span className="ssel-item-label">{o.label}</span>
                {o.subtitle && (
                  <span className="ssel-item-sub">{o.subtitle}</span>
                )}
                {o.id === value && (
                  <span className="ssel-item-check" aria-hidden>
                    ✓
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
