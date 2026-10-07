import Decimal from 'decimal.js';

import { addMonths, daysBetween, formatDate, parseDate } from './dates';

// Actual/365 everywhere: interest for each night the money is held, over a 365-day year,
// as Thai banks quote it. Withholding tax on deposit interest is 15%.
const DAYS_IN_YEAR = new Decimal(365);
const TAX_RATE = new Decimal(0.15);
const money = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export type FixedDepositInput = {
  principal: Decimal.Value;
  annualRatePercent: Decimal.Value;
  termMonths: number;
  startDate: string;
  termCount: number;
  compoundOnRollover?: boolean;
  withholdingTax?: boolean;
};

export type FixedDepositScheduleEntry = {
  termIndex: number;
  startDate: string;
  /** Maturity: the day the term's interest is paid. */
  endDate: string;
  days: number;
  principal: Decimal;
  grossInterest: Decimal;
  netInterest: Decimal;
  taxAmount: Decimal;
  endingBalance: Decimal;
};

export type FixedDepositResult = {
  totalContributions: Decimal;
  grossInterest: Decimal;
  taxAmount: Decimal;
  netInterest: Decimal;
  endingBalance: Decimal;
  maturityDate: string;
  schedule: FixedDepositScheduleEntry[];
};

const validateFixedDepositInput = (input: FixedDepositInput) => {
  const principal = new Decimal(input.principal);
  const rate = new Decimal(input.annualRatePercent);
  if (!principal.isFinite() || principal.isNegative()) throw new Error('Principal cannot be negative');
  if (!rate.isFinite() || rate.isNegative()) throw new Error('Annual rate cannot be negative');
  if (input.termMonths <= 0 || !Number.isInteger(input.termMonths)) {
    throw new Error('Term length must be a positive integer number of months');
  }
  if (input.termCount <= 0 || !Number.isInteger(input.termCount)) throw new Error('Term count must be a positive integer');
  parseDate(input.startDate);
};

export const calculateFixedDeposit = (input: FixedDepositInput): FixedDepositResult => {
  validateFixedDepositInput(input);

  const principal = new Decimal(input.principal);
  const rate = new Decimal(input.annualRatePercent).div(100);
  const compoundOnRollover = input.compoundOnRollover !== false;
  const withholdingTax = input.withholdingTax !== false;
  const start = parseDate(input.startDate);

  const schedule: FixedDepositScheduleEntry[] = [];
  let currentPrincipal = principal;
  let totalGross = new Decimal(0);
  let totalTax = new Decimal(0);
  let totalNet = new Decimal(0);
  let termStart = start;

  for (let termIndex = 1; termIndex <= input.termCount; termIndex += 1) {
    // Every maturity is counted from the original start date, so a deposit opened on the 31st
    // keeps maturing at month end instead of drifting to the 28th.
    const maturity = addMonths(start, input.termMonths * termIndex);
    const days = daysBetween(termStart, maturity);
    const gross = money(currentPrincipal.times(rate).times(days).div(DAYS_IN_YEAR));
    const tax = withholdingTax ? money(gross.times(TAX_RATE)) : new Decimal(0);
    const net = gross.minus(tax);

    totalGross = totalGross.plus(gross);
    totalTax = totalTax.plus(tax);
    totalNet = totalNet.plus(net);

    const endingBalance = compoundOnRollover ? currentPrincipal.plus(net) : principal.plus(totalNet);
    schedule.push({
      termIndex,
      startDate: formatDate(termStart),
      endDate: formatDate(maturity),
      days,
      principal: currentPrincipal,
      grossInterest: gross,
      netInterest: net,
      taxAmount: tax,
      endingBalance,
    });

    if (compoundOnRollover) currentPrincipal = currentPrincipal.plus(net);
    termStart = maturity;
  }

  return {
    totalContributions: principal,
    grossInterest: totalGross,
    taxAmount: totalTax,
    netInterest: totalNet,
    endingBalance: principal.plus(totalNet),
    maturityDate: formatDate(termStart),
    schedule,
  };
};

export type Tier = {
  minBalance: Decimal.Value;
  /** null for the top tier: everything above its minimum earns its rate. */
  maxBalance: Decimal.Value | null;
  rate: Decimal.Value;
};

export type TieredDepositInput = {
  principal: Decimal.Value;
  startDate: string;
  endDate: string;
  tiers: Tier[];
  withholdingTax?: boolean;
};

export type TieredDepositResult = {
  totalContributions: number;
  days: number;
  grossInterest: number;
  taxAmount: number;
  netInterest: number;
  endingBalance: number;
  tierBreakdown: {
    tierIndex: number;
    minBalance: number;
    maxBalance: number | null;
    rate: number;
    balanceInTier: number;
    grossInterest: number;
  }[];
};

const sortTiers = (tiers: Tier[]) =>
  [...tiers].sort((a, b) => new Decimal(a.minBalance).comparedTo(new Decimal(b.minBalance)));

const validateTieredDepositInput = (input: TieredDepositInput) => {
  const principal = new Decimal(input.principal);
  if (!principal.isFinite() || principal.isNegative()) throw new Error('Principal cannot be negative');
  if (parseDate(input.startDate).getTime() > parseDate(input.endDate).getTime()) {
    throw new Error('End date must be on or after start date');
  }
  if (input.tiers.length === 0) throw new Error('At least one tier must be defined');

  const tiers = sortTiers(input.tiers);
  tiers.forEach((tier, index) => {
    const min = new Decimal(tier.minBalance);
    const rate = new Decimal(tier.rate);
    const isTop = index === tiers.length - 1;
    if (min.isNegative() || rate.isNegative()) throw new Error(`Tier ${index + 1}: values cannot be negative`);
    if (tier.maxBalance != null && min.gte(tier.maxBalance)) {
      throw new Error(`Tier ${index + 1}: Minimum balance must be less than maximum balance`);
    }
    if (!isTop && tier.maxBalance == null) throw new Error(`Tier ${index + 1}: only the top tier can be open-ended`);
    // A gap between tiers would leave part of the balance earning nothing.
    if (!isTop && !new Decimal(tiers[index + 1].minBalance).eq(tier.maxBalance as Decimal.Value)) {
      throw new Error(`Tier ${index + 2} must start where tier ${index + 1} ends`);
    }
  });
  if (!new Decimal(tiers[0].minBalance).isZero()) throw new Error('The first tier must start at 0');
};

export const calculateTieredDeposit = (input: TieredDepositInput): TieredDepositResult => {
  validateTieredDepositInput(input);

  const principal = new Decimal(input.principal);
  const days = daysBetween(parseDate(input.startDate), parseDate(input.endDate));
  const tiers = sortTiers(input.tiers);

  let totalGross = new Decimal(0);
  const tierBreakdown = tiers.map((tier, index) => {
    const min = new Decimal(tier.minBalance);
    // Money above the top tier's limit still earns the top rate.
    const max = index === tiers.length - 1 || tier.maxBalance == null ? null : new Decimal(tier.maxBalance);
    const balanceInTier = Decimal.max(0, Decimal.min(principal, max ?? principal).minus(min));
    const gross = money(balanceInTier.times(new Decimal(tier.rate).div(100)).times(days).div(DAYS_IN_YEAR));
    totalGross = totalGross.plus(gross);
    return {
      tierIndex: index,
      minBalance: min.toNumber(),
      maxBalance: tier.maxBalance == null ? null : new Decimal(tier.maxBalance).toNumber(),
      rate: new Decimal(tier.rate).toNumber(),
      balanceInTier: balanceInTier.toNumber(),
      grossInterest: gross.toNumber(),
    };
  });

  const taxAmount = input.withholdingTax !== false ? money(totalGross.times(TAX_RATE)) : new Decimal(0);
  const netInterest = totalGross.minus(taxAmount);

  return {
    totalContributions: principal.toNumber(),
    days,
    grossInterest: totalGross.toNumber(),
    taxAmount: taxAmount.toNumber(),
    netInterest: netInterest.toNumber(),
    endingBalance: principal.plus(netInterest).toNumber(),
    tierBreakdown,
  };
};
