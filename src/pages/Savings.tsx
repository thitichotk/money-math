import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { addMonths, formatDate, parseDate, todayBangkok } from '../domain/finance/dates';
import { TAX_FREE_INTEREST, computeSavingsDailyActual365, type SavingsTimelineEvent } from '../domain/finance/savingsActual365';
import { BankRate, type RateType } from '../ui/BankRate';
import { DateBlank, NumberBlank, SelectBlank } from '../ui/blanks';
import { useLastGood, useQueryState, useTitle } from '../ui/hooks';
import { Answer, Calculator, Formula, Passbook, tone } from '../ui/results';
import { baht, count, date, year } from '../utils/format';
import { parseNumericString } from '../utils/numberInput';

const MATH =
  '<math display="block"><mtext>daily interest</mtext><mo>=</mo><mfrac><mrow><mtext>balance</mtext><mo>×</mo><mtext>rate</mtext></mrow><mn>365</mn></mfrac></math>';

// Deposits and withdrawals travel in the URL as "2026-12-01~d~5000|2027-03-01~w~2000".
type EventDraft = { date: string; type: 'deposit' | 'withdraw'; amount: string };
const decodeEvents = (value: string): EventDraft[] =>
  value
    ? value.split('|').map((part) => {
        const [d = '', type = 'd', amount = ''] = part.split('~');
        return { date: d, type: type === 'w' ? 'withdraw' : 'deposit', amount };
      })
    : [];
const encodeEvents = (events: EventDraft[]) =>
  events.map((e) => `${e.date}~${e.type === 'withdraw' ? 'w' : 'd'}~${e.amount}`).join('|');

const isDate = (value: string) => {
  try {
    parseDate(value);
    return true;
  } catch {
    return false;
  }
};

export default function SavingsPage() {
  const { t } = useTranslation();
  useTitle(t('savings.title'));
  const defaults = useMemo(() => {
    const today = todayBangkok();
    return { p: '100000', r: '0.5', s: today, e: formatDate(addMonths(parseDate(today), 12)), ev: '', bank: '', rt: 'max' };
  }, []);
  const [q, set] = useQueryState(defaults);

  const principal = parseNumericString(q.p);
  const rate = parseNumericString(q.r);
  const events = decodeEvents(q.ev);
  const setEvents = (next: EventDraft[]) => set({ ev: encodeEvents(next) });

  const problems: [string, string][] = [];
  if (!(principal >= 0)) problems.push(['p', t('errors.amount')]);
  if (!(rate >= 0 && rate <= 100)) problems.push(['r', t('errors.rate')]);
  if (!isDate(q.s)) problems.push(['s', t('errors.date')]);
  if (!isDate(q.e) || (isDate(q.s) && q.e < q.s)) problems.push(['e', t('errors.endDate')]);
  events.forEach((e, i) => {
    if (!isDate(e.date) || e.date < q.s || e.date > q.e) problems.push([`ev${i}d`, t('savings.errors.eventDate')]);
    if (!(parseNumericString(e.amount) > 0)) problems.push([`ev${i}a`, t('errors.amount')]);
  });
  const bad = (field: string) => problems.some(([f]) => f === field);

  const computed = useMemo(() => {
    if (problems.length) return { error: null, value: null };
    try {
      const value = computeSavingsDailyActual365({
        principalStart: principal,
        annualRatePct: rate,
        startDate: q.s,
        endDate: q.e,
        events: events.map<SavingsTimelineEvent>((e) => ({ date: e.date, type: e.type, amount: parseNumericString(e.amount) })),
      });
      return { error: null, value };
    } catch (error) {
      return { error: /below zero/.test(String(error)) ? t('savings.errors.overdrawn') : t('errors.generic'), value: null };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when the inputs (all in q) change
  }, [problems.length, q, t]);
  const result = useLastGood(computed.value);

  return (
    <>
      <Calculator
        title={t('savings.title')}
        error={problems[0]?.[1] ?? computed.error ?? undefined}
        stale={!computed.value}
        sentence={
          <>
            <p className="sentence">
              <Trans
                i18nKey="savings.sentence"
                components={{
                  principal: <NumberBlank value={q.p} onChange={(p) => set({ p })} label={t('savings.labels.principal')} prefix="฿" invalid={bad('p')} />,
                  rate: <NumberBlank value={q.r} onChange={(r) => set({ r, bank: '' })} label={t('savings.labels.rate')} suffix="%" invalid={bad('r')} />,
                  start: <DateBlank value={q.s} onChange={(s) => set({ s })} label={t('savings.labels.start')} invalid={bad('s')} />,
                  end: <DateBlank value={q.e} onChange={(e) => set({ e })} label={t('savings.labels.end')} invalid={bad('e')} />,
                }}
              />
            </p>
            {events.map((event, i) => (
              <p className="sentence small" key={i}>
                <Trans
                  i18nKey="savings.event"
                  components={{
                    date: (
                      <DateBlank
                        value={event.date}
                        label={t('savings.labels.eventDate', { n: i + 1 })}
                        invalid={bad(`ev${i}d`)}
                        onChange={(d) => setEvents(events.map((e, j) => (j === i ? { ...e, date: d } : e)))}
                      />
                    ),
                    type: (
                      <SelectBlank
                        value={event.type}
                        label={t('savings.labels.eventType', { n: i + 1 })}
                        onChange={(type) => setEvents(events.map((e, j) => (j === i ? { ...e, type } : e)))}
                        options={[
                          { value: 'deposit', label: t('savings.deposit') },
                          { value: 'withdraw', label: t('savings.withdraw') },
                        ]}
                      />
                    ),
                    amount: (
                      <NumberBlank
                        value={event.amount}
                        prefix="฿"
                        label={t('savings.labels.eventAmount', { n: i + 1 })}
                        invalid={bad(`ev${i}a`)}
                        onChange={(amount) => setEvents(events.map((e, j) => (j === i ? { ...e, amount } : e)))}
                      />
                    ),
                  }}
                />
                <button type="button" className="remove" onClick={() => setEvents(events.filter((_, j) => j !== i))} aria-label={t('common.removeN', { n: i + 1 })}>
                  {t('common.remove')}
                </button>
              </p>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm add"
              onClick={() => setEvents([...events, { date: q.s, type: 'deposit', amount: '10000' }])}
            >
              {t('savings.addEvent')}
            </button>
            <BankRate
              product="savings"
              bank={q.bank}
              rateType={q.rt as RateType}
              onPick={({ bank, rateType, rate: picked }) => set({ bank, rt: rateType, ...(picked != null ? { r: String(picked) } : {}) })}
            />
          </>
        }
        result={
          result && (
            <>
              <Answer label={t('savings.answer')} value={baht(result.netInterestTotal)} />
              <div>
                <p className="because">
                  <Trans
                    i18nKey="savings.because"
                    values={{
                      days: count(result.days),
                      gross: baht(result.grossInterestTotal),
                      tax: baht(result.withholdingTaxTotal),
                      balance: baht(result.endingBalance),
                    }}
                    components={tone}
                  />
                </p>
                {result.yearSummaries.map((summary) => (
                  <p className="because" key={summary.year}>
                    <Trans
                      i18nKey={summary.overThreshold ? 'savings.taxOver' : 'savings.taxUnder'}
                      values={{
                        year: year(summary.year),
                        gross: baht(summary.grossInterest),
                        limit: baht(TAX_FREE_INTEREST, 0),
                        diff: baht(Math.abs(summary.grossInterest - TAX_FREE_INTEREST)),
                        tax: baht(summary.tax),
                      }}
                      components={tone}
                    />
                  </p>
                ))}
              </div>
            </>
          )
        }
      />

      {result && result.payouts.length > 0 && (
        <section className="block" aria-label={t('savings.bookTitle')}>
          <Passbook
            title={t('savings.bookTitle')}
            meta={t('savings.bookMeta', { count: result.payouts.length, n: count(result.payouts.length) })}
            csvName="money-math-savings"
            columns={[
              { label: t('book.date'), kind: 'text' },
              { label: t('common.interest'), className: 'i' },
              { label: t('book.tax') },
              { label: t('book.net') },
              { label: t('book.balance') },
            ]}
            rows={result.payouts.map((p) => [
              p.kind === 'closing' ? `${date(p.date)} · ${t('savings.closing')}` : date(p.date),
              p.grossInterest,
              p.tax,
              p.netInterest,
              p.balanceAfterPayout,
            ])}
          />
          <Formula math={MATH}>{t('savings.formula')}</Formula>
        </section>
      )}
    </>
  );
}
