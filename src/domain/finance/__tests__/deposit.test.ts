import { describe, expect, it } from 'vitest';

import { calculateFixedDeposit, calculateTieredDeposit } from '../deposit';

describe('calculateFixedDeposit', () => {
  const base = { principal: 100_000, annualRatePercent: 1.8, termMonths: 12, startDate: '2024-01-01', termCount: 1 };

  it('pays interest for every night until maturity, Actual/365', () => {
    // 2024-01-01 to 2025-01-01 is 366 nights in a leap year.
    const result = calculateFixedDeposit({ ...base, withholdingTax: false });
    expect(result.schedule[0].days).toBe(366);
    expect(result.grossInterest.toNumber()).toBe(1804.93);
    expect(result.endingBalance.toNumber()).toBe(101_804.93);
    expect(result.maturityDate).toBe('2025-01-01');
  });

  it('withholds 15% by default', () => {
    const result = calculateFixedDeposit(base);
    expect(result.taxAmount.toNumber()).toBe(270.74);
    expect(result.netInterest.toNumber()).toBe(1534.19);
  });

  it('keeps month-end maturities from drifting', () => {
    const result = calculateFixedDeposit({ ...base, startDate: '2025-01-31', termMonths: 1, termCount: 3 });
    expect(result.schedule.map((term) => term.endDate)).toEqual(['2025-02-28', '2025-03-31', '2025-04-30']);
    expect(result.schedule.map((term) => term.days)).toEqual([28, 31, 30]);
  });

  it('compounds net interest on rollover', () => {
    const rolled = calculateFixedDeposit({ ...base, termMonths: 6, termCount: 2, withholdingTax: false });
    const single = calculateFixedDeposit({ ...base, withholdingTax: false });
    expect(rolled.netInterest.toNumber()).toBeGreaterThan(single.netInterest.toNumber());
    expect(rolled.schedule[1].principal.toNumber()).toBe(100_000 + rolled.schedule[0].netInterest.toNumber());
  });
});

describe('calculateTieredDeposit', () => {
  it('calculates interest correctly for a single tier', () => {
    const result = calculateTieredDeposit({
      principal: 100_000,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      tiers: [
        { minBalance: 0, maxBalance: 500_000, rate: 2.0 },
      ],
      withholdingTax: false,
    });

    expect(result.totalContributions).toBe(100_000);
    expect(result.grossInterest).toBeCloseTo(2_000, 0); // 100k * 2% * 1 year
    expect(result.netInterest).toBeCloseTo(2_000, 0);
    expect(result.endingBalance).toBe(102_000);
    expect(result.tierBreakdown).toHaveLength(1);
    expect(result.tierBreakdown[0].balanceInTier).toBe(100_000);
    expect(result.tierBreakdown[0].grossInterest).toBeCloseTo(2_000, 0);
  });

  it('calculates interest correctly for multiple tiers', () => {
    const result = calculateTieredDeposit({
      principal: 300_000,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      tiers: [
        { minBalance: 0, maxBalance: 100_000, rate: 1.0 },
        { minBalance: 100_000, maxBalance: 200_000, rate: 2.0 },
        { minBalance: 200_000, maxBalance: 500_000, rate: 3.0 },
      ],
      withholdingTax: false,
    });

    expect(result.totalContributions).toBe(300_000);
    // Tier 1: 100k * 1% = 1k
    // Tier 2: 100k * 2% = 2k
    // Tier 3: 100k * 3% = 3k
    // Total: 6k
    expect(result.grossInterest).toBeCloseTo(6_000, 0);
    expect(result.netInterest).toBeCloseTo(6_000, 0);
    expect(result.endingBalance).toBe(306_000);
    expect(result.tierBreakdown).toHaveLength(3);
    expect(result.tierBreakdown[0].balanceInTier).toBe(100_000);
    expect(result.tierBreakdown[0].grossInterest).toBeCloseTo(1_000, 0);
    expect(result.tierBreakdown[1].balanceInTier).toBe(100_000);
    expect(result.tierBreakdown[1].grossInterest).toBeCloseTo(2_000, 0);
    expect(result.tierBreakdown[2].balanceInTier).toBe(100_000);
    expect(result.tierBreakdown[2].grossInterest).toBeCloseTo(3_000, 0);
  });

  it('handles partial tier allocation correctly', () => {
    const result = calculateTieredDeposit({
      principal: 150_000,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      tiers: [
        { minBalance: 0, maxBalance: 100_000, rate: 1.0 },
        { minBalance: 100_000, maxBalance: 200_000, rate: 2.0 },
      ],
      withholdingTax: false,
    });

    expect(result.totalContributions).toBe(150_000);
    // Tier 1: 100k * 1% = 1k
    // Tier 2: 50k * 2% = 1k
    // Total: 2k
    expect(result.grossInterest).toBeCloseTo(2_000, 0);
    expect(result.netInterest).toBeCloseTo(2_000, 0);
    expect(result.endingBalance).toBe(152_000);
    expect(result.tierBreakdown).toHaveLength(2);
    expect(result.tierBreakdown[0].balanceInTier).toBe(100_000);
    expect(result.tierBreakdown[0].grossInterest).toBeCloseTo(1_000, 0);
    expect(result.tierBreakdown[1].balanceInTier).toBe(50_000);
    expect(result.tierBreakdown[1].grossInterest).toBeCloseTo(1_000, 0);
  });

  it('applies withholding tax correctly', () => {
    const result = calculateTieredDeposit({
      principal: 100_000,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      tiers: [
        { minBalance: 0, maxBalance: 500_000, rate: 2.0 },
      ],
      withholdingTax: true,
    });

    expect(result.totalContributions).toBe(100_000);
    expect(result.grossInterest).toBeCloseTo(2_000, 0);
    expect(result.taxAmount).toBeCloseTo(300, 0); // 2000 * 0.15
    expect(result.netInterest).toBeCloseTo(1_700, 0); // 2000 - 300
    expect(result.endingBalance).toBe(101_700);
  });

  it('throws error for empty tiers', () => {
    expect(() => {
      calculateTieredDeposit({
        principal: 100_000,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        tiers: [],
        withholdingTax: false,
      });
    }).toThrow('At least one tier must be defined');
  });

  it('throws error for invalid tier ranges', () => {
    expect(() => {
      calculateTieredDeposit({
        principal: 100_000,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        tiers: [
          { minBalance: 100_000, maxBalance: 50_000, rate: 1.0 },
        ],
        withholdingTax: false,
      });
    }).toThrow('Minimum balance must be less than maximum balance');
  });

  it('pays the top rate on money above the top tier', () => {
    const result = calculateTieredDeposit({
      principal: 1_000_000,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      tiers: [
        { minBalance: 0, maxBalance: 50_000, rate: 0.5 },
        { minBalance: 50_000, maxBalance: 100_000, rate: 1 },
        { minBalance: 100_000, maxBalance: 500_000, rate: 1.5 },
      ],
      withholdingTax: false,
    });
    expect(result.tierBreakdown[2].balanceInTier).toBe(900_000);
    expect(result.grossInterest).toBe(250 + 500 + 13_500);
  });

  it('rejects gaps between tiers', () => {
    expect(() =>
      calculateTieredDeposit({
        principal: 100_000,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        tiers: [
          { minBalance: 0, maxBalance: 50_000, rate: 0.5 },
          { minBalance: 60_000, maxBalance: null, rate: 1 },
        ],
      }),
    ).toThrow(/must start where tier 1 ends/);
  });
});
