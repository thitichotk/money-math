import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { formatNumericString, parseNumericString, sanitizeNumericInput } from '../utils/numberInput';

const width = (text: string, min = 1.6) => ({ '--w': `${Math.max(min, text.length + 0.3)}ch` }) as CSSProperties;

type NumberBlankProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  prefix?: string;
  suffix?: string;
  allowNegative?: boolean;
  integer?: boolean;
  invalid?: boolean;
};

/** A number typed into the sentence. Commas appear as you type; the caret stays after the digit you typed. */
export function NumberBlank({ value, onChange, label, prefix, suffix, allowNegative, integer, invalid }: NumberBlankProps) {
  const [text, setText] = useState(() => formatNumericString(value));
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // Follow changes made elsewhere (a bank's rate, a shared link) without fighting the typist.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (parseNumericString(sanitizeNumericInput(text, allowNegative)) !== parseNumericString(value)) {
      setText(formatNumericString(value));
    }
  }

  useLayoutEffect(() => {
    if (caret.current == null || !input.current) return;
    // Put the caret after the same number of significant characters as before the reformat.
    let seenChars = 0;
    let position = 0;
    while (position < text.length && seenChars < caret.current) {
      if (text[position] !== ',') seenChars += 1;
      position += 1;
    }
    input.current.setSelectionRange(position, position);
    caret.current = null;
  }, [text]);

  return (
    <label className={`blank${invalid ? ' is-error' : ''}`}>
      {prefix && <span className="u">{prefix}</span>}
      <input
        ref={input}
        inputMode={integer ? 'numeric' : allowNegative ? 'text' : 'decimal'}
        value={text}
        aria-label={label}
        aria-invalid={invalid || undefined}
        style={width(text)}
        onChange={(event) => {
          const raw = event.target.value;
          const before = raw.slice(0, event.target.selectionStart ?? raw.length).replace(/,/g, '').length;
          const clean = sanitizeNumericInput(raw, allowNegative);
          caret.current = before;
          setText(formatNumericString(clean));
          setSeen(clean);
          onChange(clean);
        }}
      />
      {suffix && <span className="u">{suffix}</span>}
    </label>
  );
}

type SelectBlankProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  label: string;
  options: { value: T; label: string }[];
};

export function SelectBlank<T extends string>({ value, onChange, label, options }: SelectBlankProps<T>) {
  return (
    <label className="blank">
      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value as T)}
        style={width(options.find((option) => option.value === value)?.label ?? '')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DateBlank({ value, onChange, label, invalid }: { value: string; onChange: (value: string) => void; label: string; invalid?: boolean }) {
  return (
    <label className={`blank${invalid ? ' is-error' : ''}`}>
      <input type="date" value={value} aria-label={label} aria-invalid={invalid || undefined} onChange={(event) => onChange(event.target.value)} style={{ width: 'auto' }} />
    </label>
  );
}
