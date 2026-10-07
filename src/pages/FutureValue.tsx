import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { calculateFutureValue, type CompoundingFrequency, type ContributionTiming } from '../domain/finance/timeValue';
import { NumberBlank, SelectBlank } from '../ui/blanks';
import { useLastGood, useQueryState, useTitle } from '../ui/hooks';
import { Answer, Calculator, ChartKey, Formula, Passbook, YearChart, tone } from '../ui/results';
import { baht, count } from '../utils/format';
import { parseNumericString } from '../utils/numberInput';

const DEFAULTS = { pv: '10000', c: '1000', f: 'monthly', tm: 'end', r: '6', y: '10' };
const PER_YEAR: Record<CompoundingFrequency, number> = { monthly: 12, quarterly: 4, annually: 1 };
const MATH =
  '<math display="block"><mi>FV</mi><mo>=</mo><mi>PV</mi><msup><mrow><mo>(</mo><mn>1</mn><mo>+</mo><mi>r</mi><mo>)</mo></mrow><mi>n</mi></msup><mo>+</mo><mi>C</mi><mo>×</mo><mfrac><mrow><msup><mrow><mo>(</mo><mn>1</mn><mo>+</mo><mi>r</mi><mo>)</mo></mrow><mi>n</mi></msup><mo>−</mo><mn>1</mn></mrow><mi>r</mi></mfrac></math>';

export default function FutureValuePage() {
  const { t } = useTranslation();
  useTitle(t('fv.title'));
  const [q, set] = useQueryState(DEFAULTS);

  const presentValue = parseNumericString(q.pv);
  const contribution = parseNumericString(q.c);
  const rate = parseNumericString(q.r);
  const years = parseNumericString(q.y);
  const frequency = (q.f in PER_YEAR ? q.f : 'monthly') as CompoundingFrequency;
  const timing: ContributionTiming = q.tm === 'begin' ? 'begin' : 'end';
  const perYear = PER_YEAR[frequency];

  const problems: [string, string][] = [];
  if (!(presentValue >= 0)) problems.push(['pv', t('errors.amount')]);
  if (!(contribution >= 0)) problems.push(['c', t('errors.amount')]);
  if (!(rate > -100 && rate <= 100)) problems.push(['r', t('fv.errors.rate')]);
  if (!(Number.isInteger(years) && years >= 1 && years <= 100)) problems.push(['y', t('fv.errors.years')]);
  const bad = (field: string) => problems.some(([f]) => f === field);

  const computed = useMemo(
    () =>
      problems.length
        ? null
        : calculateFutureValue({
            presentValue,
            annualRatePercent: rate,
            totalPeriods: years * perYear,
            compoundingFrequency: frequency,
            recurringContribution: contribution,
            contributionTiming: timing,
          }),
    [problems.length, presentValue, rate, years, perYear, frequency, contribution, timing],
  );
  const result = useLastGood(computed);
  const labels: [string, string] = [t('fv.invested'), t('fv.growth')];

  // One row per year: the value at the end of that year, split into money put in and growth.
  const yearly = useMemo(
    () =>
      result
        ? result.schedule
            .filter((row) => row.period > 0 && row.period % perYear === 0)
            .map((row) => ({
              n: row.period / perYear,
              invested: row.totalContributions.toNumber(),
              growth: row.interestEarned.toNumber(),
              value: row.totalValue.toNumber(),
            }))
        : [],
    [result, perYear],
  );

  const value = result?.futureValue.toNumber() ?? 0;
  const invested = result?.totalInvested.toNumber() ?? 0;

  return (
    <>
      <Calculator
        title={t('fv.title')}
        error={problems[0]?.[1]}
        stale={!computed}
        sentence={
          <p className="sentence">
            <Trans
              i18nKey="fv.sentence"
              components={{
                pv: <NumberBlank value={q.pv} onChange={(pv) => set({ pv })} label={t('fv.labels.pv')} prefix="฿" invalid={bad('pv')} />,
                c: <NumberBlank value={q.c} onChange={(c) => set({ c })} label={t('fv.labels.contribution')} prefix="฿" invalid={bad('c')} />,
                freq: (
                  <SelectBlank
                    value={frequency}
                    label={t('fv.labels.frequency')}
                    onChange={(f) => set({ f })}
                    options={(['monthly', 'quarterly', 'annually'] as const).map((value) => ({ value, label: t(`fv.frequency.${value}`) }))}
                  />
                ),
                timing: (
                  <SelectBlank
                    value={timing}
                    label={t('fv.labels.timing')}
                    onChange={(tm) => set({ tm })}
                    options={[
                      { value: 'end', label: t('fv.timing.end') },
                      { value: 'begin', label: t('fv.timing.begin') },
                    ]}
                  />
                ),
                rate: <NumberBlank value={q.r} onChange={(r) => set({ r })} label={t('fv.labels.rate')} suffix="%" allowNegative invalid={bad('r')} />,
                years: <NumberBlank value={q.y} onChange={(y) => set({ y })} label={t('fv.labels.years')} integer invalid={bad('y')} />,
              }}
            />
          </p>
        }
        result={
          result && (
            <>
              <Answer label={t('fv.answer', { n: count(yearly.length) })} value={baht(value)} />
              <p className="because">
                <Trans
                  i18nKey="fv.because"
                  values={{
                    invested: baht(invested, 0),
                    growth: baht(value - invested, 0),
                    share: value > 0 ? Math.round(((value - invested) / value) * 100) : 0,
                  }}
                  components={tone}
                />
              </p>
            </>
          )
        }
      />

      {result && (
        <>
          <section className="block" aria-labelledby="chart-title">
            <div className="chart-head">
              <h2 id="chart-title">{t('fv.chartTitle')}</h2>
              <ChartKey labels={labels} />
            </div>
            <YearChart
              title={t('fv.chartAlt')}
              labels={labels}
              years={yearly.map((row) => ({ label: t('common.yearN', { n: row.n }), principal: row.invested, interest: Math.max(0, row.growth) }))}
            />
          </section>
          <section className="block" aria-label={t('fv.bookTitle')}>
            <Passbook
              title={t('fv.bookTitle')}
              meta={t('fv.bookMeta', { count: yearly.length, n: count(yearly.length) })}
              csvName="money-math-future-value"
              columns={[
                { label: t('book.year'), kind: 'text' },
                { label: t('fv.invested'), className: 'c-p' },
                { label: t('fv.growth'), className: 'i' },
                { label: t('fv.value') },
              ]}
              rows={yearly.map((row) => [row.n, row.invested, row.growth, row.value])}
            />
            <Formula math={MATH}>{t('fv.formula')}</Formula>
          </section>
        </>
      )}
    </>
  );
}
