import React from 'react';

export type KpiTone = 'neutral' | 'positive' | 'warning' | 'accent' | 'danger';

const toneClasses: Record<KpiTone, string> = {
  neutral: 'from-slate-50 to-white text-slate-900 dark:from-slate-800 dark:to-slate-900',
  positive: 'from-emerald-50 to-white text-emerald-900 dark:from-emerald-950/40 dark:to-slate-900 dark:text-emerald-200',
  warning: 'from-amber-50 to-white text-amber-900 dark:from-amber-950/40 dark:to-slate-900 dark:text-amber-200',
  accent: 'from-indigo-50 to-white text-indigo-900 dark:from-indigo-950/40 dark:to-slate-900 dark:text-indigo-200',
  danger: 'from-rose-50 to-white text-rose-900 dark:from-rose-950/40 dark:to-slate-900 dark:text-rose-200',
};

type Props = {
  label: string;
  value: string | number;
  tone?: KpiTone;
  hint?: string;
  delta?: { value: number; previous?: number } | null;
  icon?: React.ReactNode;
};

export const KpiCard: React.FC<Props> = ({ label, value, tone = 'neutral', hint, delta, icon }) => {
  let deltaPct: number | null = null;
  if (delta && delta.previous && delta.previous !== 0) {
    deltaPct = ((delta.value - delta.previous) / Math.abs(delta.previous)) * 100;
  }
  const up = deltaPct !== null && deltaPct > 0;
  const flat = deltaPct === null || Math.abs(deltaPct) < 0.5;

  return (
    <div className={`relative rounded-2xl border border-slate-200 bg-linear-to-br ${toneClasses[tone]} p-4 shadow-sm dark:border-slate-700`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{label}</p>
        {icon && <span className="opacity-70">{icon}</span>}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        {hint && <p className="text-[11px] opacity-70">{hint}</p>}
        {deltaPct !== null && !flat && (
          <span className={`flex items-center gap-1 text-[11px] font-semibold ${up ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
            {up ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};
