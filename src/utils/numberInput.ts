// What people type into a blank: commas are thousands separators (never decimals), one '.', and
// a leading '-' only where the blank allows negative amounts.

export const sanitizeNumericInput = (value: string, allowNegative = false) => {
  let out = '';
  let hasDot = false;
  for (const char of value.trim()) {
    if (char >= '0' && char <= '9') out += char;
    else if (char === '.' && !hasDot) {
      hasDot = true;
      out += '.';
    } else if ((char === '-' || char === '−') && allowNegative && out === '') out = '-';
  }
  return out.replace(/^(-?)\./, '$10.');
};

/** Groups the integer part with commas: "1500000.5" -> "1,500,000.5". */
export const formatNumericString = (value: string) => {
  if (!value) return '';
  const negative = value.startsWith('-');
  const [integer, decimal] = value.replace('-', '').split('.');
  const grouped = (integer || (decimal != null ? '0' : '')).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${decimal != null ? `.${decimal}` : ''}`;
};

/** NaN for an empty or unfinished entry. */
export const parseNumericString = (value: string) => (/\d/.test(value) ? Number(value) : Number.NaN);
