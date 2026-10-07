import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { parseDate, todayBangkok } from '../domain/finance/dates';
import { calculateFixedDeposit } from '../domain/finance/deposit';
import { useBotDepositRates } from '../features/deposits/hooks/useBotDepositRates';
import type { BotFixedTerm } from '../services/bot/depositRates';
import { BankRate, rateOf, type RateType } from '../ui/BankRate';
import { DateBlank, NumberBlank, SelectBlank } from '../ui/blanks';
import { useLastGood, useQueryState, useTitle } from '../ui/hooks';
import { Answer, Calculator, Formula, Passbook, tone } from '../ui/results';
import { baht, count, date, fmt } from '../utils/format';
import { resolveLocalizedText } from '../utils/i18n';
import { parseNumericString } from '../utils/numberInput';

const TERMS = ['3', '6', '12', '24', '36'];
const BOT_TERM: Record<string, BotFixedTerm | undefined> = { 3: '3M', 6: '6M', 12: '12M', 24: '24M' };
const MATH =
  '<math display="block"><mtext>interest</mtext><mo>=</mo><mfrac><mrow><mtext>principal</mtext><mo>×</mo><mtext>rate</mtext><mo>×</mo><mtext>days</mtext></mrow><mn>365</mn></mfrac></math>';

const isDate = (value: string) => {
  try {
    parseDate(value);
    return true;
  } catch {
    return false;
  }
};

export default function FixedPage() {
  const { t, i18n } = useTranslation();
  useTitle(t('fixed.title'));
  const defaults = useMemo(() => ({ p: '100000', r: '1.5', t: '12', k: '1', s: todayBangkok(), c: '1', w: '1', bank: '', rt: 'max' }), []);
  const [q, set] = useQueryState(defaults);
  const bot = useBotDepositRates();

  const principal = parseNumericString(q.p);
  const rate = parseNumericString(q.r);
  const termMonths = Number(q.t);
  const rounds = parseNumericString(q.k);
  const compound = q.c !== '0';
  const withholding = q.w !== '0';

  const problems: [string, string][] = [];
  if (!(principal > 0)) problems.push(['p', t('errors.amount')]);
  if (!(rate >= 0 && rate <= 100)) problems.push(['r', t('errors.rate')]);
  if (!(Number.isInteger(rounds) && rounds >= 1 && rounds <= 100)) problems.push(['k', t('fixed.errors.rounds')]);
  if (!isDate(q.s)) problems.push(['s', t('errors.date')]);
  const bad = (field: string) => problems.some(([f]) => f === field);

  const computed = useMemo(
    () =>
      problems.length
        ? null
        : calculateFixedDeposit({
            principal,
            annualRatePercent: rate,
            termMonths,
            termCount: rounds,
            startDate: q.s,
            compoundOnRollover: compound,
            withholdingTax: withholding,
          }),
    [problems.length, principal, rate, termMonths, rounds, q.s, compound, withholding],
  );
  const result = useLastGood(computed);

  // What the same deposit earns at each bank's rate for this term, best first.
  const botTerm = BOT_TERM[q.t];
  const comparison = useMemo(() => {
    if (!bot.data || !botTerm || problems.length) return [];
    return bot.data.records
      .map((record) => ({ record, rate: rateOf(record, botTerm, 'max') }))
      .filter((row): row is { record: typeof row.record; rate: number } => row.rate != null)
      .map(({ record, rate: bankRate }) => ({
        record,
        rate: bankRate,
        net: calculateFixedDeposit({ principal, annualRatePercent: bankRate, termMonths, termCount: rounds, startDate: q.s, compoundOnRollover: compound, withholdingTax: withholding }).netInterest.toNumber(),
      }))
      .sort((a, b) => b.net - a.net);
  }, [bot.data, botTerm, problems.length, principal, termMonths, rounds, q.s, compound, withholding]);

  return (
    <>
      <Calculator
        title={t('fixed.title')}
        error={problems[0]?.[1]}
        stale={!computed}
        sentence={
          <>
            <p className="sentence">
              <Trans
                i18nKey="fixed.sentence"
                components={{
                  principal: <NumberBlank value={q.p} onChange={(p) => set({ p })} label={t('fixed.labels.principal')} prefix="฿" invalid={bad('p')} />,
                  rate: <NumberBlank value={q.r} onChange={(r) => set({ r, bank: '' })} label={t('fixed.labels.rate')} suffix="%" invalid={bad('r')} />,
                  term: (
                    <SelectBlank
                      value={TERMS.includes(q.t) ? q.t : '12'}
                      label={t('fixed.labels.term')}
                      onChange={(term) => set({ t: term, bank: '' })}
                      options={TERMS.map((value) => ({ value, label: t('fixed.termMonths', { n: value }) }))}
                    />
                  ),
                  rounds: <NumberBlank value={q.k} onChange={(k) => set({ k })} label={t('fixed.labels.rounds')} integer invalid={bad('k')} />,
                  start: <DateBlank value={q.s} onChange={(s) => set({ s })} label={t('fixed.labels.start')} invalid={bad('s')} />,
                }}
              />
            </p>
            <p className="sentence small">
              <Trans
                i18nKey="fixed.options"
                components={{
                  compound: (
                    <SelectBlank
                      value={compound ? '1' : '0'}
                      label={t('fixed.labels.compound')}
                      onChange={(c) => set({ c })}
                      options={[
                        { value: '1', label: t('fixed.compound') },
                        { value: '0', label: t('fixed.payOut') },
                      ]}
                    />
                  ),
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
            <BankRate
              product={botTerm ?? null}
              bank={q.bank}
              rateType={q.rt as RateType}
              onPick={({ bank, rateType, rate: picked }) => set({ bank, rt: rateType, ...(picked != null ? { r: String(picked) } : {}) })}
            />
          </>
        }
        result={
          result && (
            <>
              <Answer label={t('fixed.answer')} value={baht(result.netInterest.toNumber())} />
              <p className="because">
                <Trans
                  i18nKey="fixed.because"
                  values={{
                    date: date(result.maturityDate),
                    balance: baht(result.endingBalance.toNumber()),
                    gross: baht(result.grossInterest.toNumber()),
                    tax: baht(result.taxAmount.toNumber()),
                  }}
                  components={tone}
                />
              </p>
            </>
          )
        }
      />

      {result && (
        <section className="block" aria-label={t('fixed.bookTitle')}>
          <Passbook
            title={t('fixed.bookTitle')}
            meta={t('fixed.bookMeta', { count: result.schedule.length, n: count(result.schedule.length) })}
            csvName="money-math-fixed-deposit"
            columns={[
              { label: t('book.round'), kind: 'text' },
              { label: t('book.maturity'), kind: 'text' },
              { label: t('book.days'), kind: 'text', className: 'c-p' },
              { label: t('common.principal') },
              { label: t('common.interest'), className: 'i' },
              { label: t('book.tax') },
              { label: t('book.balance') },
            ]}
            rows={result.schedule.map((term) => [
              term.termIndex,
              date(term.endDate),
              term.days,
              term.principal.toNumber(),
              term.grossInterest.toNumber(),
              term.taxAmount.toNumber(),
              term.endingBalance.toNumber(),
            ])}
          />
          <Formula math={MATH}>{t('fixed.formula')}</Formula>
        </section>
      )}

      {comparison.length > 0 && bot.data && (
        <section className="block" aria-label={t('fixed.compareTitle')}>
          <Passbook
            title={t('fixed.compareTitle', { term: t('fixed.termMonths', { n: q.t }) })}
            meta={t('bank.source', { date: date(bot.data.period) })}
            csvName="money-math-bank-rates"
            columns={[
              { label: t('book.bank'), kind: 'text' },
              { label: t('book.rate'), kind: 'text' },
              { label: t('fixed.netInterest'), className: 'i' },
            ]}
            rows={comparison.map((row) => [resolveLocalizedText(i18n.language, row.record.bank), `${fmt(row.rate)}%`, row.net])}
            footer={t('fixed.compareNote', { bank: resolveLocalizedText(i18n.language, comparison[0].record.bank) })}
          />
        </section>
      )}
    </>
  );
}
