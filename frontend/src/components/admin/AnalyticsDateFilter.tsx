import React, { useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';

export type AnalyticsRange = { from: string; to: string } | null;

type Preset = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom';

const isoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

function rangeForPreset(preset: Preset): AnalyticsRange {
  if (preset === 'all' || preset === 'custom') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === 'today') {
    return { from: isoDate(today), to: isoDate(today) };
  }
  if (preset === 'yesterday') {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    return { from: isoDate(y), to: isoDate(y) };
  }
  if (preset === 'this_week') {
    // Week starts Sunday to match the rest of the app.
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return { from: isoDate(start), to: isoDate(today) };
  }
  if (preset === 'this_month') {
    const start = new Date(today);
    start.setDate(1);
    return { from: isoDate(start), to: isoDate(today) };
  }
  if (preset === 'this_year') {
    const start = new Date(today.getFullYear(), 0, 1);
    return { from: isoDate(start), to: isoDate(today) };
  }
  return null;
}

type Props = {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
};

/**
 * Date range filter: preset chips + From/To inputs. Editing the dates flips
 * the active preset to "custom" automatically. Selecting "All" clears the range.
 */
export const AnalyticsDateFilter: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useApp();
  const [preset, setPreset] = useState<Preset>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  // Sync displayed dates with the resolved range whenever a preset is picked.
  useEffect(() => {
    if (value) {
      setFrom(value.from);
      setTo(value.to);
    } else {
      setFrom('');
      setTo('');
    }
  }, [value]);

  const pick = (p: Preset) => {
    setPreset(p);
    if (p === 'all') {
      onChange(null);
      return;
    }
    if (p === 'custom') {
      // Default to last 7 days if no range is set yet.
      if (!from || !to) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        const range = { from: isoDate(start), to: isoDate(today) };
        onChange(range);
        return;
      }
      onChange({ from, to });
      return;
    }
    onChange(rangeForPreset(p));
  };

  const editDate = (which: 'from' | 'to', v: string) => {
    if (which === 'from') setFrom(v);
    else setTo(v);
    setPreset('custom');
    const nextFrom = which === 'from' ? v : from;
    const nextTo = which === 'to' ? v : to;
    if (nextFrom && nextTo) onChange({ from: nextFrom, to: nextTo });
  };

  const chips: { key: Preset; label: string }[] = [
    { key: 'all', label: t('analyticsFilter.all') },
    { key: 'today', label: t('salariesPresetToday') },
    { key: 'yesterday', label: t('salariesPresetYesterday') },
    { key: 'this_week', label: t('salariesPresetThisWeek') },
    { key: 'this_month', label: t('salariesPresetThisMonth') },
    { key: 'this_year', label: t('analyticsFilter.thisYear') },
    { key: 'custom', label: t('salariesPresetCustom') },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => {
            const active = preset === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => pick(c.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{t('analyticsFilter.from')}</span>
            <input
              type="date"
              value={from}
              onChange={(e) => editDate('from', e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{t('analyticsFilter.to')}</span>
            <input
              type="date"
              value={to}
              onChange={(e) => editDate('to', e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
