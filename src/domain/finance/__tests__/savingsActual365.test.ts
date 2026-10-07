import { describe, expect, it } from 'vitest';

import { computeSavingsDailyActual365 } from '../savingsActual365';

const base = { principalStart: 100_000, annualRatePct: 1, startDate: '2025-01-01', endDate: '2026-01-01' };

describe('computeSavingsDailyActual365', () => {
  it('credits on 30 June and 31 December, compounding in between', () => {
    const result = computeSavingsDailyActual365(base);
    expect(result.payouts.map((p) => [p.date, p.grossInterest])).toEqual([
      ['2025-06-30', 495.89], // 181 nights
      ['2025-12-31', 506.61], // 184 nights on the new balance, 31 December included
    ]);
    expect(result.days).toBe(365);
    expect(result.endingBalance).toBe(101_002.5);
    expect(result.withholdingTaxTotal).toBe(0);
  });

  it('pays what accrued after the last payout when the account is closed', () => {
    const result = computeSavingsDailyActual365({ ...base, endDate: '2025-04-01' });
    expect(result.payouts).toHaveLength(1);
    expect(result.payouts[0]).toMatchObject({ date: '2025-04-01', kind: 'closing', grossInterest: 246.58 });
    expect(result.endingBalance).toBe(100_246.58);
  });

  it('withholds 15% of the whole year once the year passes ฿20,000', () => {
    const result = computeSavingsDailyActual365({ ...base, principalStart: 2_000_000, annualRatePct: 2 });
    const [june, december] = result.payouts;
    expect(june).toMatchObject({ grossInterest: 19_835.62, tax: 0, remainingToThreshold: 164.38 });
    expect(december.grossInterest).toBe(20_364.37);
    expect(december.thresholdCrossed).toBe(true);
    expect(december.tax).toBe(6_030); // 15% of 40,199.99, catching up on June's interest too
    expect(december.exceededBy).toBe(20_199.99);
    expect(result.yearSummaries[0]).toMatchObject({ year: 2025, overThreshold: true, tax: 6_030 });
  });

  it('uses the configured rate when withholding on every credit', () => {
    const result = computeSavingsDailyActual365({ ...base, withholdingTax: { enabled: true, rate: 0.1 } });
    expect(result.payouts[0].tax).toBe(49.59);
    expect(result.netInterestTotal).toBeCloseTo(result.grossInterestTotal - result.withholdingTaxTotal, 6);
  });

  it('applies deposits and withdrawals on their day', () => {
    const result = computeSavingsDailyActual365({
      ...base,
      events: [
        { date: '2025-03-01', type: 'deposit', amount: 50_000 },
        { date: '2025-09-01', type: 'withdraw', amount: 20_000 },
      ],
    });
    expect(result.totalContributions).toBe(130_000);
    expect(result.endingBalance).toBeCloseTo(130_000 + result.netInterestTotal, 2);
    expect(() =>
      computeSavingsDailyActual365({ ...base, events: [{ date: '2025-02-01', type: 'withdraw', amount: 200_000 }] }),
    ).toThrow(/below zero/);
  });
});
