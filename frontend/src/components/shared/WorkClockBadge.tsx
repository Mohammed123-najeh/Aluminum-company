import React, { useEffect, useState } from 'react';
import { useWorkClock } from '../../hooks/useWorkClock';
import { useApp } from '../../contexts/AppContext';

/**
 * Top-bar working-time badge. Shows today's accumulated work time as HH:MM:SS
 * with a small status dot — green when the user is actively counting, amber
 * when idle. The seconds tick locally between server refreshes so the display
 * always feels live.
 */
export const WorkClockBadge: React.FC = () => {
  const { t } = useApp();
  const { minutesToday, isActive } = useWorkClock();
  // Local seconds counter that resets whenever the server-reported minute count
  // changes — this keeps the visible HH:MM:SS smooth without re-fetching every second.
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setSeconds(0);
  }, [minutesToday]);

  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => setSeconds((s) => Math.min(59, s + 1)), 1000);
    return () => window.clearInterval(id);
  }, [isActive]);

  const totalSeconds = minutesToday * 60 + seconds;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const display = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const statusTitle = isActive ? t('workClock.active') : t('workClock.idle');

  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      title={`${t('workClock.today')} · ${statusTitle}`}
      role="status"
      aria-label={`${t('workClock.today')} ${display}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isActive
            ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]'
            : 'bg-amber-400'
        }`}
        aria-hidden
      />
      <svg
        className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      </svg>
      <span className="font-mono text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {display}
      </span>
    </div>
  );
};
