import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { calculateNetPresentValue } from '../domain/finance/timeValue';
import { NumberBlank, SelectBlank } from '../ui/blanks';
import { useLastGood, useQueryState, useTitle } from '../ui/hooks';
import { Answer, Calculator, Formula, Passbook, tone } from '../ui/results';
import { baht, count, fmt } from '../utils/format';
import { parseNumericString } from '../utils/numberInput';

const DEFAULTS = { i: '10000', r: '8', f: '1', cf: '3500,4000,4500,4500' };
const MATH =
  '<math display="block"><mi>NPV</mi><mo>=</mo><mo>−</mo><msub><mi>C</mi><mn>0</mn></msub><mo>+</mo><munderover><mo>∑</mo><mrow><mi>t</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover><mfrac><msub><mi>C</mi><mi>t</mi></msub><msup><mrow><mo>(</mo><mn>1</mn><mo>+</mo><mi>r</mi><mo>)</mo></mrow><mi>t</mi></msup></mfrac></math>';

export default function NpvPage() {
  const { t } = useTranslation();
  useTitle(t('npv.title'));
  const [q, set] = useQueryState(DEFAULTS);

  const initial = parseNumericString(q.i);
  const rate = parseNumericString(q.r);
  const perYear = ['1', '4', '12'].includes(q.f) ? Number(q.f) : 1;
  const flows = q.cf === '' ? [] : q.cf.split(',');
  const setFlows = (next: string[]) => set({ cf: next.join(',') });

  const problems: [string, string][] = [];
  if (!(initial >= 0)) problems.push(['i', t('errors.amount')]);
  if (!(rate > -100 && rate <= 100)) problems.push(['r', t('fv.errors.rate')]);
  if (flows.length === 0) problems.push(['cf', t('npv.errors.none')]);
  flows.forEach((flow, n) => {
    if (Number.isNaN(parseNumericString(flow))) problems.push([`cf${n}`, t('npv.errors.flow')]);
  });
  const bad = (field: string) => problems.some(([f]) => f === field);

  const computed = useMemo(
    () =>
      problems.length
        ? null
        : calculateNetPresentValue({
            initialInvestment: initial,
            discountRatePercent: rate,
            periodsPerYear: perYear,
            cashFlows: flows.map(parseNumericString),
          }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flows comes from q.cf
    [problems.length, initial, rate, perYear, q.cf],
  );
  const result = useLastGood(computed);
  const npv = result?.npv.toNumber() ?? 0;
  const presentOfReturns = npv + initial;

  return (
    <>
      <Calculator
        title={t('npv.title')}
        error={problems[0]?.[1]}
        stale={!computed}
        sentence={
          <>
            <p className="sentence">
              <Trans
                i18nKey="npv.sentence"
                components={{
                  initial: <NumberBlank value={q.i} onChange={(i) => set({ i })} label={t('npv.labels.initial')} prefix="฿" invalid={bad('i')} />,
                  rate: <NumberBlank value={q.r} onChange={(r) => set({ r })} label={t('npv.labels.rate')} suffix="%" allowNegative invalid={bad('r')} />,
                  freq: (
                    <SelectBlank
                      value={String(perYear)}
                      label={t('npv.labels.frequency')}
                      onChange={(f) => set({ f })}
                      options={['1', '4', '12'].map((value) => ({ value, label: t(`npv.frequency.${value}`) }))}
                    />
                  ),
                }}
              />
            </p>
            {flows.map((flow, n) => (
              <p className="sentence small" key={n}>
                <Trans
                  i18nKey="npv.flow"
                  values={{ n: count(n + 1) }}
                  components={{
                    amount: (
                      <NumberBlank
                        value={flow}
                        prefix="฿"
                        allowNegative
                        label={t('npv.labels.flow', { n: n + 1 })}
                        invalid={bad(`cf${n}`)}
                        onChange={(amount) => setFlows(flows.map((x, j) => (j === n ? amount : x)))}
                      />
                    ),
                  }}
                />
                {flows.length > 1 && (
                  <button type="button" className="remove" onClick={() => setFlows(flows.filter((_, j) => j !== n))} aria-label={t('common.removeN', { n: n + 1 })}>
                    {t('common.remove')}
                  </button>
                )}
              </p>
            ))}
            <button type="button" className="btn btn-ghost btn-sm add" onClick={() => setFlows([...flows, flows.at(-1) ?? '1000'])}>
              {t('npv.addFlow')}
            </button>
          </>
        }
        result={
          result && (
            <>
              <Answer label={t('npv.answer')} value={baht(npv)} />
              <div>
                <p className="because">
                  <Trans
                    i18nKey={npv >= 0 ? 'npv.worth' : 'npv.notWorth'}
                    values={{ returns: baht(presentOfReturns, 0), initial: baht(initial, 0), rate: fmt(rate) }}
                    components={tone}
                  />
                </p>
                <p className="because">
                  {result.irrPercent == null ? t('npv.noIrr') : <Trans i18nKey="npv.irr" values={{ irr: fmt(result.irrPercent) }} components={tone} />}
                </p>
              </div>
            </>
          )
        }
      />

      {result && (
        <section className="block" aria-label={t('npv.bookTitle')}>
          <Passbook
            title={t('npv.bookTitle')}
            meta={t('npv.bookMeta', { count: flows.length, n: count(flows.length) })}
            csvName="money-math-npv"
            columns={[
              { label: t('book.period'), kind: 'text' },
              { label: t('npv.cash') },
              { label: t('npv.present'), className: 'p' },
            ]}
            rows={result.discountedCashFlows.map((row) => [row.period, row.cashFlow.toNumber(), row.presentValue.toNumber()])}
          />
          <Formula math={MATH}>{t('npv.formula')}</Formula>
        </section>
      )}
    </>
  );
}
