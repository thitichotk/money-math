import Decimal from 'decimal.js';

import { addDays, daysBetween, formatDate, isSavingsPayoutDate, parseDate } from './dates';

// A Thai savings account, day by day:
// - interest accrues every night on that day's balance, Actual/365;
// - it is credited on 30 June and 31 December, and on the end date (closing the account);
// - the first ฿20,000 of interest in a calendar year is tax-free. Once the year's interest passes
//   ฿20,000, 15% is withheld on the whole year's interest, so the payout that crosses the line
//   also catches up the tax on everything credited earlier that year.

type TimelineEventType = 'deposit' | 'withdraw';

export type SavingsTimelineEvent = {
  date: string;
  type: TimelineEventType;
  amount: number;
};

export type WithholdingTaxConfig = {
  /** Withhold on every credit regardless of the ฿20,000 rule (accounts that don't qualify). */
  enabled: boolean;
  rate: number;
};

export type SavingsCalculatorInput = {
  principalStart: number;
  annualRatePct: number;
  startDate: string;
  /** The day the money comes out. It earns no interest itself. */
  endDate: string;
  events?: SavingsTimelineEvent[];
  apply20kRule?: boolean;
  withholdingTax?: WithholdingTaxConfig;
};

export type SavingsPayout = {
  date: string;
  kind: 'payout' | 'closing';
  grossInterest: number;
  tax: number;
  netInterest: number;
  balanceAfterPayout: number;
  cumulativeYtdGross: number;
  remainingToThreshold: number;
  exceededBy: number;
  thresholdCrossed: boolean;
};

export type SavingsYearSummary = {
  year: number;
  grossInterest: number;
  tax: number;
  netInterest: number;
  closingBalance: number;
  overThreshold: boolean;
};

export type SavingsCalculatorResult = {
  days: number;
  endingBalance: number;
  totalContributions: number;
  grossInterestTotal: number;
  withholdingTaxTotal: number;
  netInterestTotal: number;
  payouts: SavingsPayout[];
  yearSummaries: SavingsYearSummary[];
};

export const TAX_FREE_INTEREST = 20_000;
const THRESHOLD = new Decimal(TAX_FREE_INTEREST);
const DAYS_IN_YEAR = new Decimal(365);
const money = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const computeSavingsDailyActual365 = (input: SavingsCalculatorInput): SavingsCalculatorResult => {
  const principal = new Decimal(input.principalStart);
  const rate = new Decimal(input.annualRatePct);
  if (!principal.isFinite() || principal.isNegative()) throw new Error('Starting principal cannot be negative');
  if (!rate.isFinite() || rate.isNegative()) throw new Error('Annual rate cannot be negative');

  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (start.getTime() > end.getTime()) throw new Error('End date must be on or after start date');

  const taxRate = new Decimal(input.withholdingTax?.rate ?? 0.15);
  if (!taxRate.isFinite() || taxRate.isNegative()) throw new Error('Withholding tax rate cannot be negative');
  const alwaysWithhold = Boolean(input.withholdingTax?.enabled);
  const apply20kRule = input.apply20kRule !== false;

  const events = (input.events ?? [])
    .map((event) => {
      if (!Number.isFinite(event.amount) || event.amount <= 0) throw new Error('Event amount must be positive');
      const date = parseDate(event.date);
      if (date < start || date > end) throw new Error('Event date must be within the calculation range');
      return { ...event, time: date.getTime(), amount: new Decimal(event.amount) };
    })
    // Same day: deposits first, so a deposit can fund a withdrawal.
    .sort((a, b) => a.time - b.time || (a.type === b.type ? 0 : a.type === 'deposit' ? -1 : 1));

  const dailyRate = rate.div(100).div(DAYS_IN_YEAR);
  let balance = principal;
  let contributions = principal;
  let accrued = new Decimal(0);
  let eventIndex = 0;
  const payouts: SavingsPayout[] = [];
  const years = new Map<number, { gross: Decimal; tax: Decimal; closing: Decimal }>();

  const credit = (date: Date, kind: SavingsPayout['kind']) => {
    const gross = money(accrued);
    accrued = new Decimal(0);
    const year = years.get(date.getUTCFullYear()) ?? { gross: new Decimal(0), tax: new Decimal(0), closing: balance };
    const before = year.gross;
    year.gross = year.gross.plus(gross);

    let tax = new Decimal(0);
    if (alwaysWithhold) tax = money(gross.times(taxRate));
    else if (apply20kRule && year.gross.gt(THRESHOLD)) tax = money(year.gross.times(taxRate)).minus(year.tax);

    year.tax = year.tax.plus(tax);
    const net = gross.minus(tax);
    balance = balance.plus(net);
    year.closing = balance;
    years.set(date.getUTCFullYear(), year);

    payouts.push({
      date: formatDate(date),
      kind,
      grossInterest: gross.toNumber(),
      tax: tax.toNumber(),
      netInterest: net.toNumber(),
      balanceAfterPayout: money(balance).toNumber(),
      cumulativeYtdGross: year.gross.toNumber(),
      remainingToThreshold: Decimal.max(0, THRESHOLD.minus(year.gross)).toNumber(),
      exceededBy: Decimal.max(0, year.gross.minus(THRESHOLD)).toNumber(),
      thresholdCrossed: before.lte(THRESHOLD) && year.gross.gt(THRESHOLD),
    });
  };

  for (let day = start; day.getTime() <= end.getTime(); day = addDays(day, 1)) {
    for (; eventIndex < events.length && events[eventIndex].time === day.getTime(); eventIndex += 1) {
      const event = events[eventIndex];
      const sign = event.type === 'deposit' ? 1 : -1;
      balance = balance.plus(event.amount.times(sign));
      contributions = contributions.plus(event.amount.times(sign));
      if (balance.isNegative()) throw new Error('Withdrawal events cannot reduce balance below zero');
    }
    if (day.getTime() === end.getTime()) {
      if (!accrued.isZero()) credit(day, 'closing'); // whatever accrued since the last payout
      break;
    }
    accrued = accrued.plus(balance.times(dailyRate));
    if (isSavingsPayoutDate(day)) credit(day, 'payout');
  }

  const yearSummaries = [...years.entries()].map(([year, totals]) => ({
    year,
    grossInterest: totals.gross.toNumber(),
    tax: totals.tax.toNumber(),
    netInterest: totals.gross.minus(totals.tax).toNumber(),
    closingBalance: money(totals.closing).toNumber(),
    overThreshold: totals.gross.gt(THRESHOLD),
  }));
  const gross = payouts.reduce((sum, p) => sum.plus(p.grossInterest), new Decimal(0));
  const tax = payouts.reduce((sum, p) => sum.plus(p.tax), new Decimal(0));

  return {
    days: daysBetween(start, end),
    endingBalance: money(balance).toNumber(),
    totalContributions: money(contributions).toNumber(),
    grossInterestTotal: gross.toNumber(),
    withholdingTaxTotal: tax.toNumber(),
    netInterestTotal: gross.minus(tax).toNumber(),
    payouts,
    yearSummaries,
  };
};
