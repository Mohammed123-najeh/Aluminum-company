import React, { useEffect, useState } from 'react';
import { useWorkClock } from '../../hooks/useWorkClock';
import { useApp } from '../../contexts/AppContext';
import { formatAmPm, formatWorkDuration } from '../../utils/workTime';

/**
 * Top-bar work clock. Two distinct, decoupled controls:
 *  - a read-only timer chip showing today's worked time (and "since" when active);
 *  - a Start work / End work toggle button beside it.
 *
 * Logging in/out no longer starts or stops this clock — only these buttons do —
 * so a user can sign in after hours to check something without it counting.
 */
export const WorkClockBadge: React.FC = () => {
  const { t } = useApp();
  const { minutesToday, workdayLimitMinutes, sessionStartedAt, isWorking, dailyLimitReached, loading, startWork, endWork } =
    useWorkClock();
  const [seconds, setSeconds] = useState(0);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

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
    setStartOpen(false);
  };

  const finish = async () => {
    await endWork();
    setEndOpen(false);
  };

  return (
    <>
      <div className="inline-flex items-center gap-2">
        {/* Read-only timer chip — purely a status display, no longer a button. */}
        <span
          className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-1.5 shadow-sm ${
            isWorking
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
              : dailyLimitReached
                ? 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                : 'border-amber-200 bg-white text-slate-700 dark:border-amber-900/60 dark:bg-slate-800 dark:text-slate-200'
          }`}
          role="status"
          title={dailyLimitReached ? t('workClock.limitReached') : isWorking ? t('workClock.active') : t('workClock.idle')}
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
        </span>

        {/* Start / End work toggle — the only control that moves the clock. */}
        {isWorking ? (
          <button
            type="button"
            onClick={() => setEndOpen(true)}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60"
            title={t('workClock.endButton')}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <rect x="6" y="6" width="12" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">{t('workClock.endButton')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => !dailyLimitReached && setStartOpen(true)}
            disabled={loading || dailyLimitReached}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition disabled:opacity-60 ${
              dailyLimitReached
                ? 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60'
            }`}
            title={dailyLimitReached ? t('workClock.limitReached') : t('workClock.startButton')}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 5v14l11-7z" />
            </svg>
            <span className="hidden sm:inline">{dailyLimitReached ? t('workClock.doneButton') : t('workClock.startButton')}</span>
          </button>
        )}
      </div>

      {startOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setStartOpen(false)} />
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
                  onClick={() => setStartOpen(false)}
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

      {endOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setEndOpen(false)} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="bg-gradient-to-br from-rose-500 via-red-500 to-orange-500 px-5 py-5 text-white">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <rect x="6" y="6" width="12" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-base font-bold">{t('workClock.endTitle')}</h3>
              <p className="mt-1 text-sm text-white/80">{t('workClock.endPrompt')}</p>
            </div>
            <div className="p-5">
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('workClock.today')}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-slate-100">
                  {formatWorkDuration(Math.min(minutesToday, workdayLimitMinutes))}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEndOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void finish()}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 py-2 text-sm font-bold text-white shadow-lg shadow-red-500/25 hover:from-rose-400 hover:to-red-500 disabled:opacity-60"
                >
                  {t('workClock.endConfirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
