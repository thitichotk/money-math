import i18n from '../i18n/config';

const isThai = () => (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('th');
const locale = () => (isThai() ? 'th-TH' : 'en-GB');

export const fmt = (value: number, digits = 2) =>
  value.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const baht = (value: number, digits = 2) => `${value < 0 ? '−' : ''}฿${fmt(Math.abs(value), digits)}`;

export const count = (value: number) => value.toLocaleString(locale());

/** Thai readers get the Buddhist-era year, as on Thai bank documents. */
export const year = (ce: number) => String(isThai() ? ce + 543 : ce);

export const date = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale(), { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
