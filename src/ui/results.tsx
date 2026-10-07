import { useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { downloadCsv } from '../utils/csv';
import { count, fmt } from '../utils/format';

export function Result({ stale, children }: { stale: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className={`result${stale ? ' stale' : ''}`} aria-live="polite">
      {children}
      <p className="note">{t('common.estimate')}</p>
    </div>
  );
}

export function Answer({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="answer">
      <span className="label">{label}</span>
      <span className="fig">{value}</span>
    </div>
  );
}

// ---------- Chart: stacked bars by year, principal under interest ----------

export type ChartYear = { label: string; principal: number; interest: number };

const W = 960, H = 300, LEFT = 64, RIGHT = 96, TOP = 14, BOTTOM = 30;
const STEPS = [1, 2, 5].flatMap((s) => [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8].map((p) => s * p)).sort((a, b) => a - b);

export function YearChart({ years, labels, title }: { years: ChartYear[]; labels: [string, string]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!years.length) return null;

  const max = Math.max(...years.map((y) => y.principal + y.interest), 1);
  const step = STEPS.find((s) => max / s <= 4) ?? 1e9;
  const top = Math.ceil(max / step) * step;
  const innerW = W - LEFT - RIGHT, innerH = H - TOP - BOTTOM;
  const y = (v: number) => TOP + innerH - (v / top) * innerH;
  const band = innerW / years.length;
  const gap = Math.min(8, band * 0.28);
  const every = years.length > 20 ? 10 : years.length > 8 ? 5 : 1;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const last = years[years.length - 1];
  const principalLabelY = (y(0) + y(last.principal)) / 2;
  const interestLabelY = Math.min((y(last.principal) + y(last.principal + last.interest)) / 2, principalLabelY - 18);
  const shown = hover == null ? null : years[hover];

  return (
    <div className="chart" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
            <text className="axis" x={LEFT - 10} y={y(v) + 4} textAnchor="end">
              {v >= 1e6 ? `${fmt(v / 1e6, 0)}M` : v >= 1e3 ? `${fmt(v / 1e3, 0)}k` : fmt(v, 0)}
            </text>
          </g>
        ))}
        {years.map((year, i) => {
          const x = LEFT + i * band + gap / 2;
          const w = band - gap;
          const yp = y(year.principal);
          const yi = y(year.principal + year.interest);
          const r = Math.min(4, w / 2, Math.max(0, yp - 1 - yi));
          const h = yp - 1 - yi;
          return (
            <g key={year.label}>
              {hover === i && <rect x={LEFT + i * band} y={TOP} width={band} height={innerH} fill="var(--surface-active)" />}
              <rect x={x} y={yp + 1} width={w} height={Math.max(0, y(0) - yp - 1)} fill="var(--chart-principal)" />
              {h > 0.5 && (
                <path
                  d={`M${x},${yp - 1}V${yi + r}q0,-${r} ${r},-${r}H${x + w - r}q${r},0 ${r},${r}V${yp - 1}Z`}
                  fill="var(--chart-interest)"
                />
              )}
              {(i === 0 || (i + 1) % every === 0) && (
                <text className="axis" x={x + w / 2} y={H - 8} textAnchor="middle">
                  {year.label}
                </text>
              )}
              <rect
                x={LEFT + i * band}
                y={TOP}
                width={band}
                height={innerH}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
              />
            </g>
          );
        })}
        <text className="label" x={W - RIGHT + 12} y={principalLabelY + 4}>{labels[0]}</text>
        <text className="label" x={W - RIGHT + 12} y={interestLabelY + 4}>{labels[1]}</text>
      </svg>
      {shown && hover != null && (
        <div
          className="tip"
          role="status"
          style={{ opacity: 1, top: -6, left: `clamp(0px, calc(${((LEFT + (hover + 0.5) * band) / W) * 100}% - 90px), calc(100% - 190px))` }}
        >
          <b>{shown.label}</b>
          <div className="r"><span style={{ '--c': 'var(--chart-principal)' } as CSSProperties}>{labels[0]}</span>฿{fmt(shown.principal, 0)}</div>
          <div className="r"><span style={{ '--c': 'var(--chart-interest)' } as CSSProperties}>{labels[1]}</span>฿{fmt(shown.interest, 0)}</div>
        </div>
      )}
    </div>
  );
}

export function ChartKey({ labels }: { labels: [string, string] }) {
  return (
    <div className="key">
      <span style={{ '--c': 'var(--chart-principal)' } as CSSProperties}>{labels[0]}</span>
      <span style={{ '--c': 'var(--chart-interest)' } as CSSProperties}>{labels[1]}</span>
    </div>
  );
}

// ---------- Passbook: mono rows on dashed lines, 12 at a time ----------

export type PassbookColumn = {
  label: string;
  /** "money" prints 2 decimals; "text" prints as is. */
  kind?: 'money' | 'text';
  className?: string;
};

const PAGE = 12;

export function Passbook({
  title,
  meta,
  columns,
  rows,
  csvName,
  footer,
}: {
  title: string;
  meta?: string;
  columns: PassbookColumn[];
  rows: (string | number)[][];
  csvName: string;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const visible = all ? rows : rows.slice(0, PAGE);
  const cellText = (value: string | number, column: PassbookColumn) =>
    typeof value === 'number' && column.kind !== 'text' ? fmt(value) : String(value);

  return (
    <>
      <div className="passbook">
        <header>
          <b>{title}</b>
          {meta && <span>{meta}</span>}
        </header>
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.label} className={column.className} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, r) => (
              <tr key={r}>
                {row.map((value, c) => (
                  <td key={c} className={columns[c].className}>
                    {cellText(value, columns[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot>
              <tr>
                <td colSpan={columns.length}>{footer}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="book-tools">
        {rows.length > PAGE ? (
          <button type="button" className="btn btn-ghost" onClick={() => setAll(!all)}>
            {all ? t('common.collapse') : t('common.showMore', { count: rows.length - PAGE, n: count(rows.length - PAGE) })}
          </button>
        ) : (
          <span />
        )}
        <div className="right">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              flushSync(() => setAll(true)); // print every row, not just the first page
              window.print();
            }}
          >
            {t('common.print')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadCsv(csvName, [columns.map((column) => column.label), ...rows])}
          >
            {t('common.csv')}
          </button>
        </div>
      </div>
    </>
  );
}

/** The formula as a footnote. `math` is static MathML written in this codebase, never user input. */
export function Formula({ math, children }: { math: string; children: ReactNode }) {
  return (
    <div className="formula">
      <div dangerouslySetInnerHTML={{ __html: math }} />
      <p>{children}</p>
    </div>
  );
}

/** Title, the sentence with its one-line error, then the answer said back (dimmed while invalid). */
export function Calculator({
  title,
  sentence,
  error,
  result,
  stale,
}: {
  title: string;
  sentence: ReactNode;
  error?: string;
  result: ReactNode;
  stale: boolean;
}) {
  return (
    <section className="calc" aria-labelledby="calc-title">
      <h1 id="calc-title">{title}</h1>
      <div>
        {sentence}
        <p className="sentence-error" role="alert">
          {error}
        </p>
      </div>
      {result && <Result stale={stale}>{result}</Result>}
    </section>
  );
}

/** The sentence's numbers say "interest" in red and "principal" in ink, as the design asks. */
export const tone = { i: <span className="i" />, p: <span className="p" /> };
