import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { leaveRequestsApi, type ApiLeaveRequest } from '../../services/api';

export const SupervisorLeavePanel: React.FC = () => {
  const { t, token } = useApp();
  const [rows, setRows] = useState<ApiLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await leaveRequestsApi.listSupervisorQueue(token);
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    if (!token) return;
    setActingId(id);
    setErr(null);
    try {
      const note = noteDraft[id]?.trim() || null;
      await leaveRequestsApi.supervisorDecide(token, id, {
        decision,
        decision_note: note,
      });
      setNoteDraft((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('supervisorLeaveQueueTitle')}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('supervisorLeaveQueueHint')}</p>
      {err && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {err}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('supervisorLeaveQueueEmpty')}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{r.userName ?? r.userEmail}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {r.type === 'holiday' ? t('leaveTypeHoliday') : t('leaveTypeSick')} · {r.startDate} → {r.endDate} (
                    {r.daysCount} {t('leaveDays')})
                  </p>
                  {r.reason && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{r.reason}</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    disabled={actingId === r.id}
                    onClick={() => void decide(r.id, 'approved')}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {actingId === r.id ? '…' : t('supervisorLeaveApprove')}
                  </button>
                  <button
                    type="button"
                    disabled={actingId === r.id}
                    onClick={() => void decide(r.id, 'rejected')}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    {t('supervisorLeaveReject')}
                  </button>
                </div>
              </div>
              <label className="mt-2 block text-[11px] text-slate-500 dark:text-slate-400">
                {t('decisionNoteOptional')}
                <input
                  type="text"
                  value={noteDraft[r.id] ?? ''}
                  onChange={(e) => setNoteDraft((m) => ({ ...m, [r.id]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder={t('supervisorLeaveNotePlaceholder')}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
