import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useUsers } from '../../hooks/useUsers';
import { leaveRequestsApi, salaryRequestsApi, usersApi, type ApiLeaveRequest, type ApiSalaryRequest } from '../../services/api';
import { formatIls } from '../../utils/currency';

type DecideKind = 'leave' | null;

export const HrCenterPanel: React.FC = () => {
  const { t, token } = useApp();
  const { users, loading: usersLoading, refetch: refetchUsers } = useUsers();
  const [leaveRows, setLeaveRows] = useState<ApiLeaveRequest[]>([]);
  const [salaryRows, setSalaryRows] = useState<ApiSalaryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [savingCompId, setSavingCompId] = useState<string | null>(null);

  const [draftSal, setDraftSal] = useState<Record<string, string>>({});
  const [draftLeave, setDraftLeave] = useState<Record<string, string>>({});

  const [decideKind, setDecideKind] = useState<DecideKind>(null);
  const [decideId, setDecideId] = useState<string | null>(null);
  const [decideStatus, setDecideStatus] = useState<'approved' | 'rejected'>('approved');
  const [decideNote, setDecideNote] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!successMsg) return;
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => {
      setSuccessMsg(null);
      successTimerRef.current = null;
    }, 4500);
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, [successMsg]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [l, s] = await Promise.all([leaveRequestsApi.listHr(token), salaryRequestsApi.listHr(token)]);
      setLeaveRows(l);
      setSalaryRows(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const m: Record<string, string> = {};
    for (const u of users) {
      if (u.role === 'admin') continue;
      m[u.id] = u.baseSalary != null ? String(u.baseSalary) : '';
    }
    setDraftSal(m);
    const lv: Record<string, string> = {};
    for (const u of users) {
      if (u.role === 'admin') continue;
      lv[u.id] = u.annualLeaveBalance != null ? String(u.annualLeaveBalance) : '';
    }
    setDraftLeave(lv);
  }, [users]);

  const saveComp = async (userId: string) => {
    if (!token) return;
    setErr(null);
    setSuccessMsg(null);
    const bs = draftSal[userId]?.trim() ?? '';
    const al = draftLeave[userId]?.trim() ?? '';
    setSavingCompId(userId);
    try {
      await usersApi.update(
        userId,
        {
          base_salary: bs === '' ? null : Number(bs),
          annual_leave_balance: al === '' ? null : Number(al),
        },
        token,
      );
      await refetchUsers();
      setSuccessMsg(t('hrSaveSuccess'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingCompId(null);
    }
  };

  const pendingLeave = leaveRows.filter((r) => r.status === 'pending');
  const pendingSalary = salaryRows.filter((r) => r.status === 'pending');

  const openDecide = (kind: 'leave', id: string) => {
    setDecideKind(kind);
    setDecideId(id);
    setDecideStatus('approved');
    setDecideNote('');
  };

  const submitDecision = async () => {
    if (!token || !decideKind || !decideId) return;
    setSavingDecision(true);
    setErr(null);
    setSuccessMsg(null);
    try {
      await leaveRequestsApi.decide(token, decideId, {
        status: decideStatus,
        decision_note: decideNote.trim() || null,
      });
      setDecideKind(null);
      setDecideId(null);
      await load();
      await refetchUsers();
      setSuccessMsg(t('hrDecisionSuccess'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Decision failed');
    } finally {
      setSavingDecision(false);
    }
  };

  const roster = users.filter((u) => u.role !== 'admin');

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('hrCenterIntro')}</p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setSuccessMsg(null);
            void load();
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {t('hrRefresh')}
        </button>
      </div>

      {successMsg && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          {successMsg}
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hrPendingLeave')}</h3>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">{t('requestSubmitting')}</p>
        ) : pendingLeave.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t('hrNoPending')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {pendingLeave.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.userName}</p>
                  <p className="text-xs text-slate-500">
                    {r.type === 'holiday' ? t('leaveTypeHoliday') : t('leaveTypeSick')} · {r.daysCount} {t('requestDays')} ·{' '}
                    {r.startDate} → {r.endDate}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openDecide('leave', r.id)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {t('requestApprove')} / {t('requestReject')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hrPendingSalary')}</h3>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('hrSalaryApprovalsAdminOnly')}</p>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">{t('requestSubmitting')}</p>
        ) : pendingSalary.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t('hrNoPending')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {pendingSalary.map((r) => (
              <li key={r.id} className="py-3">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.userName}</p>
                <p className="text-xs text-slate-500">
                  {t('requestRequestedSalary')}: {formatIls(Number(r.requestedMonthlySalary))}
                  {r.currentSalarySnapshot ? ` · ${t('requestCurrentSalary')}: ${formatIls(Number(r.currentSalarySnapshot))}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hrEmployeeRoster')}</h3>
        {usersLoading ? (
          <p className="mt-2 text-sm text-slate-500">{t('requestSubmitting')}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-400 dark:border-slate-700">
                  <th className="pb-2 pe-4">{t('userCol')}</th>
                  <th className="pb-2 pe-4">{t('hrColSalary')}</th>
                  <th className="pb-2 pe-4">{t('hrColLeaveBal')}</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {roster.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 pe-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-3 pe-4">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draftSal[u.id] ?? ''}
                        onChange={(e) => setDraftSal((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        className="w-28 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-3 pe-4">
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={draftLeave[u.id] ?? ''}
                        onChange={(e) => setDraftLeave((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        className="w-20 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={savingCompId === u.id}
                        onClick={() => void saveComp(u.id)}
                        className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:enabled:hover:bg-indigo-500"
                      >
                        {savingCompId === u.id ? t('requestSubmitting') : t('hrSaveComp')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {decideKind && decideId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !savingDecision && setDecideKind(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hrPendingLeave')}</h4>
            <div className="mt-4 flex gap-2">
              {(['approved', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDecideStatus(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    decideStatus === s
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {s === 'approved' ? t('requestApproved') : t('requestRejected')}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs text-slate-600 dark:text-slate-400">
              {t('requestDecisionNote')}
              <textarea
                value={decideNote}
                onChange={(e) => setDecideNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecideKind(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={savingDecision}
                onClick={() => void submitDecision()}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t('saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
