// Calendar dates as YYYY-MM-DD strings in Bangkok time. Internally a UTC midnight Date, so
// day arithmetic never meets a daylight-saving shift (Thailand has none, the browser might).

const BANGKOK_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_MS = 24 * 60 * 60 * 1000;

export const todayBangkok = (now = new Date()) => BANGKOK_FORMAT.format(now);

export const parseDate = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Date must be in YYYY-MM-DD format');
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`Invalid date: ${value}`);
  return date;
};

export const formatDate = (date: Date) => date.toISOString().slice(0, 10);

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

/** Same day-of-month `months` later, clamped to the month's last day (Jan 31 + 1 month = Feb 28/29). */
export const addMonths = (date: Date, months: number) => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
};

/** Nights between two dates: the number of days money is held. */
export const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** Thai savings accounts pay interest at the end of June and December. */
export const isSavingsPayoutDate = (date: Date) => {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return (month === 6 && day === 30) || (month === 12 && day === 31);
};
