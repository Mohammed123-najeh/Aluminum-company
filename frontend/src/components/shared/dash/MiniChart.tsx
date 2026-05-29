import React from 'react';

export type BarSeries = { label: string; values: number[]; color: string };
export type LineSeries = { label: string; values: number[]; color: string };
export type DonutSlice = { label: string; value: number; color: string };

type Props =
  | { kind: 'bar'; labels: string[]; series: BarSeries[]; height?: number; ariaLabel?: string }
  | { kind: 'hbar'; labels: string[]; values: number[]; color?: string; height?: number; ariaLabel?: string }
  | { kind: 'line'; labels: string[]; series: LineSeries[]; height?: number; ariaLabel?: string }
  | { kind: 'donut'; slices: DonutSlice[]; height?: number; ariaLabel?: string };

const TONE = {
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#ef4444',
  slate: '#64748b',
  violet: '#8b5cf6',
};

export const COLORS = TONE;

export const MiniChart: React.FC<Props> = (props) => {
  const height = props.height ?? 220;

  if (props.kind === 'bar') {
    const { labels, series } = props;
    const allVals = series.flatMap((s) => s.values);
    const max = Math.max(1, ...allVals);
    const groupCount = labels.length;
    const w = 100; // viewBox width
    const groupW = w / groupCount;
    const barCount = series.length;
    const barW = (groupW * 0.7) / barCount;
    const gap = groupW * 0.3 / 2;

    return (
      <div className="w-full" aria-label={props.ariaLabel}>
        <svg viewBox={`0 0 ${w} 60`} preserveAspectRatio="none" className="w-full" style={{ height }}>
          {labels.map((_, gi) => (
            <g key={gi} transform={`translate(${gi * groupW + gap}, 0)`}>
              {series.map((s, si) => {
                const v = s.values[gi] ?? 0;
                const h = (v / max) * 55;
                return (
                  <rect
                    key={si}
                    x={si * barW}
                    y={60 - h - 2}
                    width={barW - 0.4}
                    height={h}
                    fill={s.color}
                    rx={0.4}
                  >
                    <title>{`${s.label}: ${v}`}</title>
                  </rect>
                );
              })}
            </g>
          ))}
        </svg>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          {labels.map((l, i) => (
            <span key={i} className="truncate">{l}</span>
          ))}
        </div>
      </div>
    );
  }

  if (props.kind === 'hbar') {
    const { labels, values, color = TONE.indigo } = props;
    const max = Math.max(1, ...values);
    return (
      <div className="w-full space-y-2" aria-label={props.ariaLabel} style={{ minHeight: height }}>
        {labels.map((l, i) => {
          const pct = (values[i] / max) * 100;
          return (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="w-28 shrink-0 truncate text-slate-600 dark:text-slate-300">{l}</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <span className="w-12 shrink-0 text-end font-semibold tabular-nums text-slate-700 dark:text-slate-200">{values[i]}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (props.kind === 'line') {
    const { labels, series } = props;
    const max = Math.max(1, ...series.flatMap((s) => s.values));
    const w = 100;
    const h = 60;
    return (
      <div className="w-full" aria-label={props.ariaLabel}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
          {series.map((s) => {
            const points = s.values
              .map((v, i) => {
                const x = (i / Math.max(1, s.values.length - 1)) * w;
                const y = h - 5 - (v / max) * (h - 10);
                return `${x},${y}`;
              })
              .join(' ');
            return (
              <g key={s.label}>
                <polyline points={points} fill="none" stroke={s.color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
                {s.values.map((v, i) => {
                  const x = (i / Math.max(1, s.values.length - 1)) * w;
                  const y = h - 5 - (v / max) * (h - 10);
                  return <circle key={i} cx={x} cy={y} r={0.8} fill={s.color}><title>{`${s.label}: ${v}`}</title></circle>;
                })}
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      </div>
    );
  }

  // donut
  const { slices } = props;
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  let acc = 0;
  const r = 32;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-3" aria-label={props.ariaLabel}>
      <svg viewBox="0 0 80 80" style={{ width: height, height }}>
        <circle cx={40} cy={40} r={r} fill="none" stroke="#e2e8f0" strokeWidth={12} />
        {slices.map((sl) => {
          const frac = sl.value / total;
          const dash = frac * c;
          const offset = -acc * c;
          acc += frac;
          return (
            <circle
              key={sl.label}
              cx={40}
              cy={40}
              r={r}
              fill="none"
              stroke={sl.color}
              strokeWidth={12}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={offset}
              transform="rotate(-90 40 40)"
            >
              <title>{`${sl.label}: ${sl.value}`}</title>
            </circle>
          );
        })}
        <text x={40} y={42} textAnchor="middle" className="fill-slate-700 dark:fill-slate-200" style={{ fontSize: 8, fontWeight: 700 }}>
          {total}
        </text>
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
        {slices.map((sl) => (
          <span key={sl.label} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: sl.color }} />
            {sl.label}: <span className="font-semibold tabular-nums">{sl.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
};
