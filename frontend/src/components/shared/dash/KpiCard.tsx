import React from 'react';

export type KpiTone = 'neutral' | 'positive' | 'warning' | 'accent' | 'danger';

const toneClasses: Record<KpiTone, { bg: string; iconBg: string; iconText: string; valueText: string }> = {
  neutral: {
    bg: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconText: 'text-slate-600 dark:text-slate-300',
    valueText: 'text-slate-900 dark:text-slate-100',
  },
  positive: {
    bg: 'border-emerald-100 bg-white dark:border-emerald-900/40 dark:bg-slate-900',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconText: 'text-emerald-600 dark:text-emerald-300',
    valueText: 'text-slate-900 dark:text-slate-100',
  },
  warning: {
    bg: 'border-amber-100 bg-white dark:border-amber-900/40 dark:bg-slate-900',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    iconText: 'text-amber-600 dark:text-amber-300',
    valueText: 'text-slate-900 dark:text-slate-100',
  },
  accent: {
    bg: 'border-indigo-100 bg-white dark:border-indigo-900/40 dark:bg-slate-900',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    iconText: 'text-indigo-600 dark:text-indigo-300',
    valueText: 'text-slate-900 dark:text-slate-100',
  },
  danger: {
    bg: 'border-rose-100 bg-white dark:border-rose-900/40 dark:bg-slate-900',
    iconBg: 'bg-rose-50 dark:bg-rose-950/40',
    iconText: 'text-rose-600 dark:text-rose-300',
    valueText: 'text-slate-900 dark:text-slate-100',
  },
};

type Props = {
  label: string;
  value: string | number;
  tone?: KpiTone;
  hint?: string;
  delta?: { value: number; previous?: number } | null;
  icon?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
};

export const KpiCard: React.FC<Props> = ({ label, value, tone = 'neutral', hint, delta, icon, onClick, selected }) => {
  let deltaPct: number | null = null;
  if (delta && delta.previous && delta.previous !== 0) {
    deltaPct = ((delta.value - delta.previous) / Math.abs(delta.previous)) * 100;
  }
  const up = deltaPct !== null && deltaPct > 0;
  const flat = deltaPct === null || Math.abs(deltaPct) < 0.5;
  const palette = toneClasses[tone];

  const interactiveCls = onClick
    ? 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md'
    : 'transition hover:shadow-md';
  const selectedRing = selected ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : '';

  const Tag: React.ElementType = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative w-full rounded-2xl border p-5 text-start shadow-sm ${palette.bg} ${interactiveCls} ${selectedRing}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${palette.iconBg} ${palette.iconText}`}>
          {icon ?? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <circle cx="12" cy="12" r="9" />
            </svg>
          )}
        </div>
        {deltaPct !== null && !flat && (
          <span
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              up
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            {up ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}%
          </span>
        )}
        {deltaPct === null && hint && (
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{hint}</span>
        )}
      </div>
      <p className={`mt-3 text-2xl font-extrabold tabular-nums leading-tight ${palette.valueText}`}>{value}</p>
      <p className="mt-1 text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      {deltaPct !== null && hint && (
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
      )}
    </Tag>
  );
};
