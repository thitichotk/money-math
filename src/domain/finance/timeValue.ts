import Decimal from 'decimal.js';

export type ContributionTiming = 'end' | 'begin';
export type CompoundingFrequency = 'monthly' | 'quarterly' | 'annually';

const COMPOUNDING_FREQUENCIES: Record<CompoundingFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  annually: 1,
};

export type FutureValueInput = {
  presentValue: Decimal.Value;
  annualRatePercent: Decimal.Value;
  totalPeriods: number;
  compoundingFrequency: CompoundingFrequency;
  recurringContribution?: Decimal.Value;
  contributionTiming?: ContributionTiming;
};

export type FutureValueScheduleEntry = {
  period: number;
  totalValue: Decimal;
  totalContributions: Decimal;
  interestEarned: Decimal;
};

export type FutureValueResult = {
  futureValue: Decimal;
  totalInvested: Decimal;
  totalGrowth: Decimal;
  totalPeriods: Decimal;
  periodicContribution: Decimal;
  ratePerPeriod: Decimal;
  schedule: FutureValueScheduleEntry[];
};

/** Root of f between lo and hi by bisection, or null when f doesn't change sign there. */
export const findRate = (f: (rate: number) => number, lo: number, hi: number): number | null => {
  let fLo = f(lo);
  if (!Number.isFinite(fLo) || !Number.isFinite(f(hi)) || Math.sign(fLo) === Math.sign(f(hi))) return null;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < 1e-9 || hi - lo < 1e-12) return mid;
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
};

const requireFinite = (value: Decimal.Value | undefined, label: string) => {
  const decimal = new Decimal(value ?? 0);
  if (!decimal.isFinite()) throw new Error(`${label} must be a number`);
  return decimal;
};

const validateFutureValueInput = (input: FutureValueInput) => {
  if (input.totalPeriods <= 0) {
    throw new Error('Total periods must be greater than zero');
  }

  if (!Number.isInteger(input.totalPeriods)) {
    throw new Error('Total periods must be an integer');
  }

  if (!(input.compoundingFrequency in COMPOUNDING_FREQUENCIES)) {
    throw new Error('Unsupported compounding frequency');
  }
};

const buildFutureValueSchedule = (
  params: Required<Pick<FutureValueInput, 'totalPeriods' | 'contributionTiming'>> & {
    presentValue: Decimal;
    ratePerPeriod: Decimal;
    periodicContribution: Decimal;
  }
): FutureValueScheduleEntry[] => {
  const schedule: FutureValueScheduleEntry[] = [];
  const { totalPeriods, contributionTiming, ratePerPeriod, periodicContribution } = params;
  let balance = params.presentValue;
  let invested = params.presentValue;

  schedule.push({
    period: 0,
    totalValue: balance,
    totalContributions: invested,
    interestEarned: new Decimal(0),
  });

  for (let period = 1; period <= totalPeriods; period += 1) {
    if (contributionTiming === 'begin' && !periodicContribution.isZero()) {
      balance = balance.plus(periodicContribution);
      invested = invested.plus(periodicContribution);
    }

    const interest = ratePerPeriod.isZero() ? new Decimal(0) : balance.times(ratePerPeriod);
    balance = balance.plus(interest);

    if (contributionTiming === 'end' && !periodicContribution.isZero()) {
      balance = balance.plus(periodicContribution);
      invested = invested.plus(periodicContribution);
    }

    schedule.push({
      period,
      totalValue: balance,
      totalContributions: invested,
      interestEarned: balance.minus(invested),
    });
  }

  return schedule;
};

export const calculateFutureValue = (input: FutureValueInput): FutureValueResult => {
  validateFutureValueInput(input);

  const presentValue = requireFinite(input.presentValue, 'Present value');
  const periodsPerYear = COMPOUNDING_FREQUENCIES[input.compoundingFrequency];
  const ratePerPeriod = requireFinite(input.annualRatePercent, 'Rate').div(100).div(periodsPerYear);
  if (ratePerPeriod.lte(-1)) throw new Error('Rate per period must be above -100%');
  const totalPeriodsDecimal = new Decimal(input.totalPeriods);
  const periodicContribution = requireFinite(input.recurringContribution, 'Contribution');
  const contributionTiming: ContributionTiming = input.contributionTiming ?? 'end';

  const growthFactor = ratePerPeriod.plus(1).pow(totalPeriodsDecimal);
  let futureValue = presentValue.times(growthFactor);

  if (!periodicContribution.isZero()) {
    if (ratePerPeriod.isZero()) {
      const annuityValue = periodicContribution.times(totalPeriodsDecimal);
      futureValue = futureValue.plus(annuityValue);
    } else {
      const annuityFactor = growthFactor.minus(1).div(ratePerPeriod);
      let annuityValue = periodicContribution.times(annuityFactor);

      if (contributionTiming === 'begin') {
        annuityValue = annuityValue.times(ratePerPeriod.plus(1));
      }

      futureValue = futureValue.plus(annuityValue);
    }
  }

  const schedule = buildFutureValueSchedule({
    presentValue,
    ratePerPeriod,
    periodicContribution,
    totalPeriods: input.totalPeriods,
    contributionTiming,
  });

  const totalInvested = schedule[schedule.length - 1]?.totalContributions ?? presentValue;
  const totalGrowth = futureValue.minus(totalInvested);

  return {
    futureValue,
    totalInvested,
    totalGrowth,
    totalPeriods: totalPeriodsDecimal,
    periodicContribution,
    ratePerPeriod,
    schedule,
  };
};

export type NetPresentValueInput = {
  initialInvestment: Decimal.Value;
  discountRatePercent: Decimal.Value;
  periodsPerYear: number;
  cashFlows: Decimal.Value[];
};

export type DiscountedCashFlow = {
  period: number;
  cashFlow: Decimal;
  presentValue: Decimal;
};

export type NetPresentValueResult = {
  npv: Decimal;
  /** Annual internal rate of return in percent, or null when the cash flows never break even. */
  irrPercent: number | null;
  ratePerPeriod: Decimal;
  discountedCashFlows: DiscountedCashFlow[];
  totalCashFlow: Decimal;
};

const validateNetPresentValueInput = (input: NetPresentValueInput) => {
  if (input.periodsPerYear <= 0) {
    throw new Error('Periods per year must be greater than zero');
  }

  if (!Number.isInteger(input.periodsPerYear)) {
    throw new Error('Periods per year must be an integer');
  }

  if (!input.cashFlows.length) {
    throw new Error('At least one cash flow is required');
  }
};

export const calculateNetPresentValue = (input: NetPresentValueInput): NetPresentValueResult => {
  validateNetPresentValueInput(input);

  const initialInvestment = requireFinite(input.initialInvestment, 'Initial investment');
  const ratePerPeriod = requireFinite(input.discountRatePercent, 'Discount rate')
    .div(100)
    .div(input.periodsPerYear);
  if (ratePerPeriod.lte(-1)) throw new Error('Rate per period must be above -100%');
  input.cashFlows.forEach((cashFlow, index) => requireFinite(cashFlow, `Cash flow ${index + 1}`));
  const onePlusRate = ratePerPeriod.plus(1);

  const discountedCashFlows: DiscountedCashFlow[] = [
    {
      period: 0,
      cashFlow: initialInvestment.neg(),
      presentValue: initialInvestment.neg(),
    },
  ];

  input.cashFlows.forEach((cashFlow, index) => {
    const cf = new Decimal(cashFlow);
    const period = index + 1;

    if (ratePerPeriod.isZero()) {
      discountedCashFlows.push({
        period,
        cashFlow: cf,
        presentValue: cf,
      });
      return;
    }

    const discountFactor = onePlusRate.pow(period);
    const presentValue = cf.div(discountFactor);

    discountedCashFlows.push({
      period,
      cashFlow: cf,
      presentValue,
    });
  });

  const npv = discountedCashFlows.reduce((acc, entry) => acc.plus(entry.presentValue), new Decimal(0));
  const totalCashFlow = discountedCashFlows.reduce((acc, entry) => acc.plus(entry.cashFlow), new Decimal(0));

  const flows = input.cashFlows.map((cashFlow) => new Decimal(cashFlow).toNumber());
  const irrPerPeriod = findRate(
    (r) => flows.reduce((sum, cf, i) => sum + cf / (1 + r) ** (i + 1), -initialInvestment.toNumber()),
    -0.99,
    10,
  );

  return {
    npv,
    irrPercent: irrPerPeriod == null ? null : irrPerPeriod * input.periodsPerYear * 100,
    ratePerPeriod,
    discountedCashFlows,
    totalCashFlow,
  };
};
