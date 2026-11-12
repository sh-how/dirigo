// A select drawn with the design tokens, so the open list matches the closed control.
// Follows the ARIA "select-only combobox" pattern: a button opens a listbox; arrow keys,
// Home, End, Enter, Space, Escape, Tab and typing the first letters all work.

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  size?: 'normal' | 'large';
  className?: string;
}

export function Select({ label, value, options, onChange, size = 'normal', className }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function show(at = selectedIndex) {
    setActive(at);
    setOpen(true);
  }

  function choose(i: number) {
    const o = options[i];
    if (o && o.value !== value) onChange(o.value);
    setOpen(false);
    button.current?.focus();
  }

  function typeahead(key: string) {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at > 600 ? '' : typed.current.text) + key.toLowerCase(), at: now };
    const start = open ? active : selectedIndex;
    const order = [...options.slice(start + 1), ...options.slice(0, start + 1)];
    const hit = order.find((o) => o.label.toLowerCase().startsWith(typed.current.text));
    if (!hit) return;
    const i = options.indexOf(hit);
    if (open) setActive(i); else onChange(hit.value);
  }

  function onKeyDown(e: KeyboardEvent) {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show(e.key === 'ArrowUp' ? Math.max(0, selectedIndex - 1) : selectedIndex);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        show(e.key === 'Home' ? 0 : last);
      } else if (e.key.length === 1 && /\S/.test(e.key)) typeahead(e.key);
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive((a) => Math.min(last, a + 1)); break;
      case 'ArrowUp': e.preventDefault(); setActive((a) => Math.max(0, a - 1)); break;
      case 'Home': e.preventDefault(); setActive(0); break;
      case 'End': e.preventDefault(); setActive(last); break;
      case 'PageDown': e.preventDefault(); setActive((a) => Math.min(last, a + 10)); break;
      case 'PageUp': e.preventDefault(); setActive((a) => Math.max(0, a - 10)); break;
      case 'Enter': case ' ': e.preventDefault(); choose(active); break;
      case 'Escape': e.preventDefault(); setOpen(false); break;
      case 'Tab': choose(active); break;
      default: if (e.key.length === 1 && /\S/.test(e.key)) typeahead(e.key);
    }
  }

  return (
    <div className={`field${className ? ` ${className}` : ''}`} ref={root}>
      <span className="field-label" id={`${id}-label`}>{label}</span>
      <div className="dselect">
        <button
          ref={button}
          type="button"
          role="combobox"
          className={`dselect-button${size === 'large' ? ' is-large' : ''}`}
          aria-labelledby={`${id}-label`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          onClick={() => (open ? setOpen(false) : show())}
          onKeyDown={onKeyDown}
        >
          <span className="dselect-value">{current?.label}</span>
          <svg className="icon" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={open ? 'M2.5 7.5L6 4l3.5 3.5' : 'M2.5 4.5L6 8l3.5-3.5'} />
          </svg>
        </button>
        {open && (
          <ul ref={list} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="dselect-list" tabIndex={-1}>
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                className={`dselect-option${i === active ? ' is-active' : ''}`}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
              >
                <span>{o.label}</span>
                {o.value === value && (
                  <svg className="icon" aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3.5 8.2l3 3L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
