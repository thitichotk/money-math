const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
const MAX_LOOKBACK_DAYS = 10;

const getBotEndpoint = (): string => {
  const endpoint = import.meta.env.VITE_BOT_ENDPOINT;

  if (!endpoint) {
    throw new Error('VITE_BOT_ENDPOINT is not configured. Set it in your environment before running the app.');
  }

  return endpoint;
};

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BANGKOK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BANGKOK_TIME_ZONE,
  weekday: 'short',
});

const formatDate = (date: Date) => dateFormatter.format(date);
const parseDate = (date: string) => new Date(`${date}T00:00:00+07:00`);

const getBangkokToday = () => formatDate(new Date());

const addDays = (date: Date, days: number) => {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const getWeekdayIndex = (date: Date) => {
  const weekday = weekdayFormatter.format(date);
  switch (weekday) {
    case 'Sun':
      return 0;
    case 'Mon':
      return 1;
    case 'Tue':
      return 2;
    case 'Wed':
      return 3;
    case 'Thu':
      return 4;
    case 'Fri':
      return 5;
    case 'Sat':
      return 6;
    default:
      return 0;
  }
};

const toPreviousBusinessDay = (date: Date) => {
  let cursor = addDays(date, -1);

  while (getWeekdayIndex(cursor) === 0 || getWeekdayIndex(cursor) === 6) {
    cursor = addDays(cursor, -1);
  }

  return cursor;
};

const parseNumber = (value?: string | null) => {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const computeAverage = (min: number | null, max: number | null) => {
  if (min != null && max != null) {
    return (min + max) / 2;
  }

  if (min != null) return min;
  if (max != null) return max;
  return null;
};

export type BotFixedTerm = '3M' | '6M' | '12M' | '24M';

const FIXED_TERM_FIELDS: Record<BotFixedTerm, { min: keyof RawDepositRate; max: keyof RawDepositRate }> = {
  '3M': { min: 'fix_3_mths_min', max: 'fix_3_mths_max' },
  '6M': { min: 'fix_6_mths_min', max: 'fix_6_mths_max' },
  '12M': { min: 'fix_12_mths_min', max: 'fix_12_mths_max' },
  '24M': { min: 'fix_24_mths_min', max: 'fix_24_mths_max' },
};

export type BotRateValue = {
  min: number | null;
  max: number | null;
  average: number | null;
};

export type BotDepositRateRecord = {
  period: string;
  bankType: {
    en: string;
    th: string | null;
  };
  bank: {
    en: string;
    th: string | null;
  };
  savings: BotRateValue;
  fixed: Record<BotFixedTerm, BotRateValue>;
};

export type BotDepositRateDataset = {
  timestamp: string | null;
  period: string;
  records: BotDepositRateRecord[];
};

type RawDepositRate = {
  period: string;
  bank_type_name_th?: string | null;
  bank_type_name_eng?: string | null;
  bank_name_th?: string | null;
  bank_name_eng?: string | null;
  saving_min?: string | null;
  saving_max?: string | null;
  fix_3_mths_min?: string | null;
  fix_3_mths_max?: string | null;
  fix_6_mths_min?: string | null;
  fix_6_mths_max?: string | null;
  fix_12_mths_min?: string | null;
  fix_12_mths_max?: string | null;
  fix_24_mths_min?: string | null;
  fix_24_mths_max?: string | null;
};

type RawApiResponse = {
  result?: {
    timestamp?: string;
    data?: {
      data_detail?: RawDepositRate[];
    };
  };
};

const datasetCache = new Map<string, BotDepositRateDataset>();
let latestRequest: Promise<BotDepositRateDataset> | null = null;

const normalizeRateRecord = (raw: RawDepositRate): BotDepositRateRecord => {
  const savingsMin = parseNumber(raw.saving_min);
  const savingsMax = parseNumber(raw.saving_max);

  const fixedRates = Object.entries(FIXED_TERM_FIELDS).reduce(
    (acc, [term, fields]) => {
      const minValue = parseNumber(raw[fields.min]);
      const maxValue = parseNumber(raw[fields.max]);
      acc[term as BotFixedTerm] = {
        min: minValue,
        max: maxValue,
        average: computeAverage(minValue, maxValue),
      };
      return acc;
    },
    {} as Record<BotFixedTerm, BotRateValue>,
  );

  return {
    period: raw.period,
    bankType: {
      en: raw.bank_type_name_eng ?? 'Unknown',
      th: raw.bank_type_name_th ?? null,
    },
    bank: {
      en: raw.bank_name_eng ?? 'Unknown Bank',
      th: raw.bank_name_th ?? null,
    },
    savings: {
      min: savingsMin,
      max: savingsMax,
      average: computeAverage(savingsMin, savingsMax),
    },
    fixed: fixedRates,
  };
};

const fetchDepositRates = async (start: string, end: string): Promise<BotDepositRateDataset | null> => {
  const cacheKey = `${start}:${end}`;
  const cached = datasetCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // A day with no data comes back as 200 with no records (weekends, holidays). Anything else
  // that goes wrong is thrown, so the caller stops instead of walking back through every day.
  const response = await fetch(`${getBotEndpoint()}?start_period=${start}&end_period=${end}`);
  if (!response.ok) {
    throw new Error(`BOT deposit rates: HTTP ${response.status}`);
  }

  const data = (await response.json()) as RawApiResponse;
  const rawRecords = data.result?.data?.data_detail ?? [];

  if (!rawRecords.length) {
    return null;
  }

  const normalizedRecords = rawRecords.map(normalizeRateRecord);
  const latestPeriod = normalizedRecords.reduce((latest, record) =>
    record.period > latest ? record.period : latest,
  normalizedRecords[0].period);
  const filteredRecords = normalizedRecords.filter((record) => record.period === latestPeriod);

  const dataset: BotDepositRateDataset = {
    timestamp: data.result?.timestamp ?? null,
    period: latestPeriod,
    records: filteredRecords,
  };

  datasetCache.set(cacheKey, dataset);
  return dataset;
};

const findLatestBotDepositRates = async (): Promise<BotDepositRateDataset> => {
  let current = parseDate(getBangkokToday());

  for (let attempts = 0; attempts <= MAX_LOOKBACK_DAYS; attempts += 1) {
    const dateString = formatDate(current);
    const dataset = await fetchDepositRates(dateString, dateString);
    if (dataset && dataset.records.length) {
      return dataset;
    }
    current = toPreviousBusinessDay(current);
  }

  throw new Error('No BOT deposit rate data available for recent business days');
};

/** Every caller shares one request; a failed one is forgotten so the next page can try again. */
export const getLatestBotDepositRates = (): Promise<BotDepositRateDataset> => {
  latestRequest ??= findLatestBotDepositRates().catch((error: unknown) => {
    latestRequest = null;
    throw error;
  });
  return latestRequest;
};

export const getBotDepositRatesForDate = async (date: string): Promise<BotDepositRateDataset | null> =>
  fetchDepositRates(date, date);
