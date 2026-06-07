import React, { useEffect, useState } from 'react';
import { useWorkClock } from '../../hooks/useWorkClock';
import { useApp } from '../../contexts/AppContext';
import { formatAmPm, formatWorkDuration } from '../../utils/workTime';

export const WorkClockBadge: React.FC = () => {
  const { t } = useApp();
  const { minutesToday, workdayLimitMinutes, sessionStartedAt, isWorking, dailyLimitReached, loading, startWork } = useWorkClock();
  const [seconds, setSeconds] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setSeconds(0);
  }, [minutesToday, isWorking]);

  useEffect(() => {
    if (!isWorking) return;
    const id = window.setInterval(() => setSeconds((s) => (s + 1) % 60), 1000);
    return () => window.clearInterval(id);
  }, [isWorking]);

  const secondsUntilLimit = Math.max(0, (workdayLimitMinutes - minutesToday) * 60);
  const display = formatWorkDuration(
    Math.min(minutesToday, workdayLimitMinutes),
    isWorking ? Math.min(seconds, secondsUntilLimit) : 0,
  );
  const since = formatAmPm(sessionStartedAt);

  const begin = async () => {
    await startWork();
    setConfirmOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !isWorking && !dailyLimitReached && setConfirmOpen(true)}
        disabled={loading || dailyLimitReached}
        className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-1.5 shadow-sm transition ${
          isWorking
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
            : dailyLimitReached
              ? 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
            : 'border-amber-200 bg-white text-slate-700 hover:bg-amber-50 dark:border-amber-900/60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-950/30'
        }`}
        title={dailyLimitReached ? t('workClock.limitReached') : isWorking ? t('workClock.active') : t('workClock.startPrompt')}
        role="status"
        aria-label={`${t('workClock.today')} ${display}${isWorking ? ` ${since}` : ''}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isWorking
              ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]'
              : dailyLimitReached
                ? 'bg-slate-400'
              : 'bg-amber-400'
          }`}
          aria-hidden
        />
        <svg className="h-3.5 w-3.5 text-current opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
        </svg>
        <span className="flex min-w-[4.5rem] flex-col leading-tight">
          <span className="text-xs font-bold tabular-nums">{display}</span>
          {isWorking && <span className="hidden text-[10px] font-medium text-current/70 sm:inline">{since}</span>}
          {dailyLimitReached && <span className="hidden text-[10px] font-medium text-current/70 sm:inline">{t('workClock.nextDay')}</span>}
        </span>
        {!isWorking && !dailyLimitReached && <span className="hidden text-xs font-semibold sm:inline">{t('workClock.startButton')}</span>}
        {dailyLimitReached && <span className="hidden text-xs font-semibold sm:inline">{t('workClock.doneButton')}</span>}
      </button>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 px-5 py-5 text-white">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>
              <h3 className="text-base font-bold">{t('workClock.startTitle')}</h3>
              <p className="mt-1 text-sm text-white/80">{t('workClock.startPrompt')}</p>
            </div>
            <div className="p-5">
              <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {t('workClock.startHint')}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void begin()}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:from-sky-400 hover:to-blue-500 disabled:opacity-60"
                >
                  {t('workClock.startConfirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
