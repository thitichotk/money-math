import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { addMonths, formatDate, parseDate, todayBangkok } from '../domain/finance/dates';
import { calculateTieredDeposit } from '../domain/finance/deposit';
import { DateBlank, NumberBlank, SelectBlank } from '../ui/blanks';
import { useLastGood, useQueryState, useTitle } from '../ui/hooks';
import { Answer, Calculator, Formula, Passbook, tone } from '../ui/results';
import { baht, count, fmt } from '../utils/format';
import { parseNumericString } from '../utils/numberInput';

// Tiers travel as "50000:0.5,100000:1,:1.5": each tier's upper limit and rate; the last has no
// limit. Each tier starts where the one before it ends, so there can be no gaps.
type TierDraft = { upper: string; rate: string };
const decodeTiers = (value: string): TierDraft[] =>
  value.split(',').map((part) => {
    const [upper = '', rate = ''] = part.split(':');
    return { upper, rate };
  });
const encodeTiers = (tiers: TierDraft[]) => tiers.map((tier, i) => `${i === tiers.length - 1 ? '' : tier.upper}:${tier.rate}`).join(',');

const MATH =
  '<math display="block"><mtext>interest</mtext><mo>=</mo><munder><mo>∑</mo><mtext>tiers</mtext></munder><mfrac><mrow><mtext>balance in tier</mtext><mo>×</mo><mtext>rate</mtext><mo>×</mo><mtext>days</mtext></mrow><mn>365</mn></mfrac></math>';

const isDate = (value: string) => {
  try {
    parseDate(value);
    return true;
  } catch {
    return false;
  }
};

export default function TieredPage() {
  const { t } = useTranslation();
  useTitle(t('tiered.title'));
  const defaults = useMemo(() => {
    const today = todayBangkok();
    return { p: '300000', s: today, e: formatDate(addMonths(parseDate(today), 12)), tiers: '50000:0.5,100000:1,:1.5', w: '1' };
  }, []);
  const [q, set] = useQueryState(defaults);
  const tiers = decodeTiers(q.tiers);
  const setTiers = (next: TierDraft[]) => set({ tiers: encodeTiers(next) });
  const lower = (i: number) => (i === 0 ? 0 : parseNumericString(tiers[i - 1].upper));

  const principal = parseNumericString(q.p);
  const withholding = q.w !== '0';
  const problems: [string, string][] = [];
  if (!(principal > 0)) problems.push(['p', t('errors.amount')]);
  if (!isDate(q.s)) problems.push(['s', t('errors.date')]);
  if (!isDate(q.e) || (isDate(q.s) && q.e < q.s)) problems.push(['e', t('errors.endDate')]);
  tiers.forEach((tier, i) => {
    if (i < tiers.length - 1 && !(parseNumericString(tier.upper) > lower(i))) problems.push([`u${i}`, t('tiered.errors.upper')]);
    const rate = parseNumericString(tier.rate);
    if (!(rate >= 0 && rate <= 100)) problems.push([`r${i}`, t('errors.rate')]);
  });
  const bad = (field: string) => problems.some(([f]) => f === field);

  const computed = useMemo(() => {
    if (problems.length) return null;
    return calculateTieredDeposit({
      principal,
      startDate: q.s,
      endDate: q.e,
      withholdingTax: withholding,
      tiers: tiers.map((tier, i) => ({
        minBalance: lower(i),
        maxBalance: i === tiers.length - 1 ? null : parseNumericString(tier.upper),
        rate: parseNumericString(tier.rate),
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- every input is in q
  }, [problems.length, q]);
  const result = useLastGood(computed);

  const addTier = () => {
    const last = tiers.length - 1;
    const start = lower(last) || 0;
    setTiers([...tiers.slice(0, last), { upper: String(start + 100_000), rate: tiers[last].rate }, tiers[last]]);
  };

  return (
    <>
      <Calculator
        title={t('tiered.title')}
        error={problems[0]?.[1]}
        stale={!computed}
        sentence={
          <>
            <p className="sentence">
              <Trans
                i18nKey="tiered.sentence"
                components={{
                  principal: <NumberBlank value={q.p} onChange={(p) => set({ p })} label={t('tiered.labels.principal')} prefix="฿" invalid={bad('p')} />,
                  start: <DateBlank value={q.s} onChange={(s) => set({ s })} label={t('tiered.labels.start')} invalid={bad('s')} />,
                  end: <DateBlank value={q.e} onChange={(e) => set({ e })} label={t('tiered.labels.end')} invalid={bad('e')} />,
                }}
              />
            </p>
            {tiers.map((tier, i) => {
              const last = i === tiers.length - 1;
              const rateBlank = (
                <NumberBlank
                  value={tier.rate}
                  suffix="%"
                  label={t('tiered.labels.rate', { n: i + 1 })}
                  invalid={bad(`r${i}`)}
                  onChange={(rate) => setTiers(tiers.map((x, j) => (j === i ? { ...x, rate } : x)))}
                />
              );
              return (
                <p className="sentence small" key={i}>
                  <Trans
                    i18nKey={tiers.length === 1 ? 'tiered.only' : last ? 'tiered.top' : 'tiered.tier'}
                    values={{ min: baht(lower(i) || 0, 0) }}
                    components={{
                      rate: rateBlank,
                      upper: (
                        <NumberBlank
                          value={tier.upper}
                          prefix="฿"
                          label={t('tiered.labels.upper', { n: i + 1 })}
                          invalid={bad(`u${i}`)}
                          onChange={(upper) => setTiers(tiers.map((x, j) => (j === i ? { ...x, upper } : x)))}
                        />
                      ),
                    }}
                  />
                  {tiers.length > 1 && (
                    <button type="button" className="remove" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} aria-label={t('common.removeN', { n: i + 1 })}>
                      {t('common.remove')}
                    </button>
                  )}
                </p>
              );
            })}
            <button type="button" className="btn btn-ghost btn-sm add" onClick={addTier}>
              {t('tiered.addTier')}
            </button>
            <p className="sentence small">
              <Trans
                i18nKey="tiered.taxSentence"
                components={{
                  tax: (
                    <SelectBlank
                      value={withholding ? '1' : '0'}
                      label={t('fixed.labels.tax')}
                      onChange={(w) => set({ w })}
                      options={[
                        { value: '1', label: t('fixed.taxed') },
                        { value: '0', label: t('fixed.taxFree') },
                      ]}
                    />
                  ),
                }}
              />
            </p>
          </>
        }
        result={
          result && (
            <>
              <Answer label={t('tiered.answer')} value={baht(result.netInterest)} />
              <p className="because">
                <Trans
                  i18nKey="tiered.because"
                  values={{ days: count(result.days), gross: baht(result.grossInterest), tax: baht(result.taxAmount), balance: baht(result.endingBalance) }}
                  components={tone}
                />
              </p>
            </>
          )
        }
      />

      {result && (
        <section className="block" aria-label={t('tiered.bookTitle')}>
          <Passbook
            title={t('tiered.bookTitle')}
            meta={t('tiered.bookMeta', { count: result.tierBreakdown.length, n: count(result.tierBreakdown.length) })}
            csvName="money-math-tiered-deposit"
            columns={[
              { label: t('book.tier'), kind: 'text' },
              { label: t('book.range'), kind: 'text', className: 'c-p' },
              { label: t('book.rate'), kind: 'text' },
              { label: t('book.inTier') },
              { label: t('common.interest'), className: 'i' },
            ]}
            rows={result.tierBreakdown.map((tier) => [
              tier.tierIndex + 1,
              tier.maxBalance == null ? `${fmt(tier.minBalance, 0)}+` : `${fmt(tier.minBalance, 0)} – ${fmt(tier.maxBalance, 0)}`,
              `${fmt(tier.rate)}%`,
              tier.balanceInTier,
              tier.grossInterest,
            ])}
          />
          <Formula math={MATH}>{t('tiered.formula')}</Formula>
        </section>
      )}
    </>
  );
}
