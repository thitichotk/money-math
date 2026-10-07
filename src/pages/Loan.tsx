import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { calculateLoanSummary, numberOfPayments, type LoanMethod } from '../domain/finance/loan';
import { NumberBlank, SelectBlank } from '../ui/blanks';
import { useLastGood, useQueryState, useTitle } from '../ui/hooks';
import { Answer, Calculator, ChartKey, Formula, Passbook, YearChart, tone } from '../ui/results';
import { baht, count, fmt } from '../utils/format';
import { parseNumericString } from '../utils/numberInput';

const DEFAULTS = { p: '1500000', r: '6.5', t: '20', u: 'y', f: '12', m: 'reducing' };

const MATH_REDUCING =
  '<math display="block"><mi>PMT</mi><mo>=</mo><mfrac><mrow><mi>P</mi><mo>×</mo><mi>r</mi></mrow><mrow><mn>1</mn><mo>−</mo><msup><mrow><mo>(</mo><mn>1</mn><mo>+</mo><mi>r</mi><mo>)</mo></mrow><mrow><mo>−</mo><mi>n</mi></mrow></msup></mrow></mfrac></math>';
const MATH_FLAT =
  '<math display="block"><mi>PMT</mi><mo>=</mo><mfrac><mrow><mi>P</mi><mo>+</mo><mi>P</mi><mo>×</mo><mi>R</mi><mo>×</mo><mi>Y</mi></mrow><mi>n</mi></mfrac></math>';

export default function LoanPage() {
  const { t } = useTranslation();
  useTitle(t('loan.title'));
  const [q, set] = useQueryState(DEFAULTS);

  const principal = parseNumericString(q.p);
  const rate = parseNumericString(q.r);
  const term = parseNumericString(q.t);
  const perYear = Number(q.f) || 12;
  const months = q.u === 'm' ? term : term * 12;
  const method: LoanMethod = q.m === 'flat' ? 'flat' : 'reducing';

  const problems: [string, string][] = [];
  if (!(principal > 0)) problems.push(['p', t('loan.errors.principal')]);
  if (!(rate >= 0 && rate <= 100)) problems.push(['r', t('errors.rate')]);
  if (!(Number.isInteger(term) && term > 0 && months <= 720)) problems.push(['t', t('loan.errors.term')]);
  else if (!Number.isInteger(numberOfPayments(months, perYear))) problems.push(['t', t('loan.errors.periods')]);
  const bad = (field: string) => problems.some(([f]) => f === field);

  const computed = useMemo(() => {
    if (problems.length) return null;
    return calculateLoanSummary({ principal, annualRatePercent: rate, termMonths: months, paymentsPerYear: perYear, method });
  }, [problems.length, principal, rate, months, perYear, method]);
  const result = useLastGood(computed);

  const years = useMemo(() => {
    if (!result) return [];
    const out: { label: string; principal: number; interest: number }[] = [];
    result.schedule.forEach((row, index) => {
      const y = Math.floor(index / perYear);
      out[y] ??= { label: t('common.yearN', { n: y + 1 }), principal: 0, interest: 0 };
      out[y].principal += row.principal.toNumber();
      out[y].interest += row.interest.toNumber();
    });
    return out;
  }, [result, perYear, t]);

  const labels: [string, string] = [t('common.principal'), t('common.interest')];
  const share = result ? Math.round((result.totalInterest.toNumber() / result.totalCost.toNumber()) * 100) : 0;

  return (
    <>
      <Calculator
        title={t('loan.title')}
        error={problems[0]?.[1]}
        stale={!computed}
        sentence={
          <p className="sentence">
            <Trans
              i18nKey="loan.sentence"
              components={{
                principal: <NumberBlank value={q.p} onChange={(p) => set({ p })} label={t('loan.labels.principal')} prefix="฿" invalid={bad('p')} />,
                rate: <NumberBlank value={q.r} onChange={(r) => set({ r })} label={t('loan.labels.rate')} suffix="%" invalid={bad('r')} />,
                method: (
                  <SelectBlank
                    value={method}
                    label={t('loan.labels.method')}
                    onChange={(m) => set({ m })}
                    options={[
                      { value: 'reducing', label: t('loan.method.reducing') },
                      { value: 'flat', label: t('loan.method.flat') },
                    ]}
                  />
                ),
                term: <NumberBlank value={q.t} onChange={(v) => set({ t: v })} label={t('loan.labels.term')} integer invalid={bad('t')} />,
                unit: (
                  <SelectBlank
                    value={q.u === 'm' ? 'm' : 'y'}
                    label={t('loan.labels.unit')}
                    onChange={(u) => set({ u })}
                    options={[
                      { value: 'y', label: t('common.years') },
                      { value: 'm', label: t('common.months') },
                    ]}
                  />
                ),
                freq: (
                  <SelectBlank
                    value={String(perYear)}
                    label={t('loan.labels.frequency')}
                    onChange={(f) => set({ f })}
                    options={['12', '4', '1'].map((value) => ({ value, label: t(`loan.frequency.${value}`) }))}
                  />
                ),
              }}
            />
          </p>
        }
        result={
          result && (
            <>
              <Answer label={t(`loan.per.${perYear}`)} value={baht(result.paymentPerPeriod.toNumber())} />
              <div>
                <p className="because">
                  <Trans
                    i18nKey="loan.because"
                    values={{
                      n: count(result.numberOfPayments),
                      principal: baht(principal, 0),
                      interest: baht(result.totalInterest.toNumber(), 0),
                      share,
                    }}
                    components={tone}
                  />
                </p>
                {method === 'flat' && (
                  <p className="because">
                    <Trans i18nKey="loan.flatTruth" values={{ rate: fmt(rate), effective: fmt(result.effectiveAnnualRatePercent) }} components={tone} />
                  </p>
                )}
              </div>
            </>
          )
        }
      />

      {result && (
        <>
          <section className="block" aria-labelledby="chart-title">
            <div className="chart-head">
              <h2 id="chart-title">{t('loan.chartTitle')}</h2>
              <ChartKey labels={labels} />
            </div>
            <YearChart years={years} labels={labels} title={t('loan.chartAlt')} />
          </section>
          <section className="block" aria-label={t('loan.bookTitle')}>
            <Passbook
              title={t('loan.bookTitle')}
              meta={t('loan.bookMeta', { count: result.numberOfPayments, n: count(result.numberOfPayments) })}
              csvName="money-math-loan"
              columns={[
                { label: t('book.period'), kind: 'text' },
                { label: t('book.payment') },
                { label: t('common.principal'), className: 'c-p' },
                { label: t('common.interest'), className: 'i' },
                { label: t('book.balance') },
              ]}
              rows={result.schedule.map((row) => [
                row.period,
                row.payment.toNumber(),
                row.principal.toNumber(),
                row.interest.toNumber(),
                row.balance.toNumber(),
              ])}
            />
            <Formula math={method === 'flat' ? MATH_FLAT : MATH_REDUCING}>
              {t(method === 'flat' ? 'loan.formulaFlat' : 'loan.formula')}
            </Formula>
          </section>
        </>
      )}
    </>
  );
}
