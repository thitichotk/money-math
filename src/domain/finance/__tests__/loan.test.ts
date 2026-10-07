import { describe, expect, it } from 'vitest';

import type { LoanInput } from '../loan';
import { calculateLoanSummary } from '../loan';

const sum = (values: { toNumber: () => number }[]) => values.reduce((total, v) => total + v.toNumber(), 0);

describe('loan calculations', () => {
  const home: LoanInput = { principal: 250_000, annualRatePercent: 4.5, termMonths: 360, paymentsPerYear: 12 };

  it('calculates the payment per period, rounded to satang', () => {
    expect(calculateLoanSummary(home).paymentPerPeriod.toNumber()).toBe(1266.71);
  });

  it('makes the rows add up to the totals and the principal', () => {
    const result = calculateLoanSummary(home);
    expect(result.schedule).toHaveLength(360);
    expect(sum(result.schedule.map((row) => row.principal))).toBeCloseTo(250_000, 6);
    expect(sum(result.schedule.map((row) => row.payment))).toBeCloseTo(result.totalCost.toNumber(), 6);
    expect(sum(result.schedule.map((row) => row.interest))).toBeCloseTo(result.totalInterest.toNumber(), 6);
    expect(result.schedule.at(-1)?.balance.toNumber()).toBe(0);
  });

  it('handles zero-interest loans', () => {
    const result = calculateLoanSummary({ ...home, annualRatePercent: 0, termMonths: 60 });
    expect(result.paymentPerPeriod.toNumber()).toBe(4166.67);
    expect(result.totalInterest.toNumber()).toBe(0);
    expect(result.totalCost.toNumber()).toBeCloseTo(250_000, 6);
  });

  it('accepts a term in months', () => {
    expect(calculateLoanSummary({ ...home, termMonths: 18 }).schedule).toHaveLength(18);
    expect(() => calculateLoanSummary({ ...home, termMonths: 13, paymentsPerYear: 4 })).toThrow(/whole number of payment periods/);
  });

  it('prices a flat-rate car loan and shows its real rate', () => {
    const car = calculateLoanSummary({ principal: 500_000, annualRatePercent: 3, termMonths: 60, paymentsPerYear: 12, method: 'flat' });
    expect(car.totalInterest.toNumber()).toBeCloseTo(75_000, 6);
    expect(car.paymentPerPeriod.toNumber()).toBe(9583.33);
    expect(car.schedule[0].interest.toNumber()).toBe(1250);
    expect(sum(car.schedule.map((row) => row.principal))).toBeCloseTo(500_000, 6);
    expect(car.effectiveAnnualRatePercent).toBeCloseTo(5.64, 2);
  });

  it('rejects bad input instead of computing NaN', () => {
    expect(() => calculateLoanSummary({ ...home, principal: 0 })).toThrow(/greater than zero/);
    expect(() => calculateLoanSummary({ ...home, principal: Number.NaN })).toThrow(/greater than zero/);
    expect(() => calculateLoanSummary({ ...home, paymentsPerYear: 0 })).toThrow(/Payments per year/);
  });
});
