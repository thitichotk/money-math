import Decimal from 'decimal.js';

import { findRate } from './timeValue';

/** reducing: interest on the remaining balance (home loans). flat: interest on the original
 *  amount for the whole term, split evenly (Thai car hire-purchase). */
export type LoanMethod = 'reducing' | 'flat';

export type LoanInput = {
  principal: Decimal.Value;
  annualRatePercent: Decimal.Value;
  termMonths: number;
  paymentsPerYear: number;
  method?: LoanMethod;
};

export type LoanAmortizationEntry = {
  period: number;
  payment: Decimal;
  interest: Decimal;
  principal: Decimal;
  balance: Decimal;
};

export type LoanSummary = {
  paymentPerPeriod: Decimal;
  numberOfPayments: number;
  totalInterest: Decimal;
  totalCost: Decimal;
  /** The reducing-balance rate that gives the same payments: what a flat rate really costs. */
  effectiveAnnualRatePercent: number;
  schedule: LoanAmortizationEntry[];
};

const money = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const numberOfPayments = (termMonths: number, paymentsPerYear: number) => (termMonths * paymentsPerYear) / 12;

const validate = (input: LoanInput) => {
  const principal = new Decimal(input.principal);
  const rate = new Decimal(input.annualRatePercent);
  if (!principal.isFinite() || principal.lte(0)) throw new Error('Principal must be greater than zero');
  if (!rate.isFinite() || rate.isNegative()) throw new Error('Rate cannot be negative');
  if (!Number.isInteger(input.termMonths) || input.termMonths <= 0) throw new Error('Term must be a whole number of months');
  if (!Number.isInteger(input.paymentsPerYear) || input.paymentsPerYear <= 0 || 12 % input.paymentsPerYear !== 0) {
    throw new Error('Payments per year must be 1, 2, 3, 4, 6 or 12');
  }
  if (!Number.isInteger(numberOfPayments(input.termMonths, input.paymentsPerYear))) {
    throw new Error('The term must be a whole number of payment periods');
  }
};

export const calculatePaymentPerPeriod = (input: LoanInput): Decimal => calculateLoanSummary(input).paymentPerPeriod;

export const calculateLoanSummary = (input: LoanInput): LoanSummary => {
  validate(input);
  const principal = new Decimal(input.principal);
  const annualRate = new Decimal(input.annualRatePercent).div(100);
  const n = numberOfPayments(input.termMonths, input.paymentsPerYear);
  const flat = input.method === 'flat';

  let payment: Decimal;
  let flatInterest = new Decimal(0);
  if (flat) {
    flatInterest = money(principal.times(annualRate).times(input.termMonths).div(12));
    payment = money(principal.plus(flatInterest).div(n));
  } else {
    const r = annualRate.div(input.paymentsPerYear);
    payment = money(
      r.isZero() ? principal.div(n) : principal.times(r).div(new Decimal(1).minus(r.plus(1).pow(-n))),
    );
  }

  const schedule: LoanAmortizationEntry[] = [];
  const flatInterestPerPeriod = money(flatInterest.div(n));
  let balance = principal;
  for (let period = 1; period <= n; period += 1) {
    const last = period === n;
    let interest = flat
      ? last ? flatInterest.minus(flatInterestPerPeriod.times(n - 1)) : flatInterestPerPeriod
      : money(balance.times(annualRate).div(input.paymentsPerYear));
    let principalPart = payment.minus(interest);
    // The last payment settles whatever rounding left over, so the rows add up to the totals.
    if (last || principalPart.gt(balance)) principalPart = balance;
    if (interest.isNegative()) interest = new Decimal(0);
    balance = balance.minus(principalPart);
    schedule.push({ period, payment: principalPart.plus(interest), interest, principal: principalPart, balance });
  }

  const totalInterest = schedule.reduce((sum, row) => sum.plus(row.interest), new Decimal(0));
  const totalCost = schedule.reduce((sum, row) => sum.plus(row.payment), new Decimal(0));

  const effectiveAnnualRatePercent = flat
    ? (findRate((r) => {
        const annuity = r === 0 ? n : (1 - (1 + r) ** -n) / r;
        return payment.toNumber() * annuity - principal.toNumber();
      }, 0, 1) ?? 0) * input.paymentsPerYear * 100
    : annualRate.times(100).toNumber();

  return { paymentPerPeriod: payment, numberOfPayments: n, totalInterest, totalCost, effectiveAnnualRatePercent, schedule };
};

export const buildAmortizationSchedule = (input: LoanInput) => calculateLoanSummary(input).schedule;
