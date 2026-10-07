import { Trans, useTranslation } from 'react-i18next';

import { useBotDepositRates } from '../features/deposits/hooks/useBotDepositRates';
import type { BotDepositRateRecord, BotFixedTerm } from '../services/bot/depositRates';
import { date, fmt } from '../utils/format';
import { resolveLocalizedText } from '../utils/i18n';
import { SelectBlank } from './blanks';

export type RateType = 'max' | 'average' | 'min';
export type RateProduct = 'savings' | BotFixedTerm;

export const bankKey = (record: BotDepositRateRecord) => `${record.bankType.en}|${record.bank.en}`;
export const rateOf = (record: BotDepositRateRecord, product: RateProduct, type: RateType) =>
  (product === 'savings' ? record.savings : record.fixed[product])[type];

type Props = {
  product: RateProduct | null;
  bank: string;
  rateType: RateType;
  onPick: (pick: { bank: string; rateType: RateType; rate: number | null }) => void;
};

/** "Use the highest rate of [bank]": fills the rate blank from the Bank of Thailand's daily rates. */
export function BankRate({ product, bank, rateType, onPick }: Props) {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useBotDepositRates();

  if (!product) return null;
  if (isLoading) return <p className="loading">{t('bank.loading')}</p>;
  if (!data) return <p className="help">{t('bank.unavailable')}</p>;

  const records = data.records
    .filter((record) => rateOf(record, product, 'max') != null)
    .sort((a, b) => resolveLocalizedText(i18n.language, a.bank).localeCompare(resolveLocalizedText(i18n.language, b.bank), 'th'));
  const pick = (key: string, type: RateType) => {
    const record = records.find((r) => bankKey(r) === key);
    onPick({ bank: key, rateType: type, rate: record ? rateOf(record, product, type) : null });
  };

  return (
    <p className="sentence small">
      <Trans
        i18nKey="bank.sentence"
        components={{
          type: (
            <SelectBlank
              value={rateType}
              label={t('bank.typeLabel')}
              onChange={(type) => pick(bank, type)}
              options={(['max', 'average', 'min'] as const).map((value) => ({ value, label: t(`bank.type.${value}`) }))}
            />
          ),
          bank: (
            <SelectBlank
              value={bank}
              label={t('bank.bankLabel')}
              onChange={(key) => pick(key, rateType)}
              options={[
                { value: '', label: t('bank.none') },
                ...records.map((record) => ({
                  value: bankKey(record),
                  label: `${resolveLocalizedText(i18n.language, record.bank)} ${fmt(rateOf(record, product, rateType) ?? 0)}%`,
                })),
              ]}
            />
          ),
        }}
      />{' '}
      <span className="help">{t('bank.source', { date: date(data.period) })}</span>
    </p>
  );
}
