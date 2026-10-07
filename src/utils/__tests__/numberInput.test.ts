import { describe, expect, it } from 'vitest';

import { formatNumericString, parseNumericString, sanitizeNumericInput } from '../numberInput';

const typed = (text: string, allowNegative = false) => formatNumericString(sanitizeNumericInput(text, allowNegative));

describe('number blanks', () => {
  it('treats commas as thousands separators, never as a decimal point', () => {
    expect(typed('10000')).toBe('10,000');
    expect(typed('10,0000')).toBe('100,000');
    expect(parseNumericString(sanitizeNumericInput('1,000,000'))).toBe(1_000_000);
    expect(typed('1234.56')).toBe('1,234.56');
    expect(typed('1.2.3')).toBe('1.23');
  });

  it('keeps a minus sign only where negatives are allowed', () => {
    expect(typed('-3,500', true)).toBe('-3,500');
    expect(typed('-3,500')).toBe('3,500');
    expect(parseNumericString(sanitizeNumericInput('-', true))).toBeNaN();
  });

  it('reads an empty or unfinished blank as NaN', () => {
    expect(parseNumericString('')).toBeNaN();
    expect(parseNumericString('.')).toBeNaN();
    expect(typed('.5')).toBe('0.5');
  });
});
