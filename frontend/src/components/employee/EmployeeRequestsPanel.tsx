import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import { leaveRequestsApi, salaryRequestsApi, type ApiLeaveRequest, type ApiSalaryRequest } from '../../services/api';
import { formatIls } from '../../utils/currency';

type Tab = 'leave' | 'salary';

function parseNum(s: string | null | undefined): number | null {
  if (s == null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const EmployeeRequestsPanel: React.FC = () => {
  const { t, token, currentUser } = useApp();
  const [tab, setTab] = useState<Tab>('leave');
  const [leaveMine, setLeaveMine] = useState<ApiLeaveRequest[]>([]);
  const [salaryMine, setSalaryMine] = useState<ApiSalaryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [leaveType, setLeaveType] = useState<'holiday' | 'sick'>('holiday');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  const [reqSalary, setReqSalary] = useState('');
  const [salaryReason, setSalaryReason] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [l, s] = await Promise.all([leaveRequestsApi.mine(token), salaryRequestsApi.mine(token)]);
      setLeaveMine(l);
      setSalaryMine(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentSal = parseNum(currentUser?.baseSalary);
  const leaveBal = parseNum(currentUser?.annualLeaveBalance);

  const submitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !startDate || !endDate) return;
    setSubmitting(true);
    setErr(null);
    try {
      await leaveRequestsApi.create(token, {
        type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: leaveReason.trim() || null,
      });
      setStartDate('');
      setEndDate('');
      setLeaveReason('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const submitSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || reqSalary.trim() === '') return;
    setSubmitting(true);
    setErr(null);
    try {
      await salaryRequestsApi.create(token, {
        requested_monthly_salary: Number(reqSalary),
        reason: salaryReason.trim() || null,
      });
      setReqSalary('');
      setSalaryReason('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelLeave = async (id: string) => {
    if (!token) return;
    try {
      await leaveRequestsApi.cancel(token, id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  };

  const cancelSalary = async (id: string) => {
    if (!token) return;
    try {
      await salaryRequestsApi.cancel(token, id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  };

  const statusLabel = (s: string) => {
    if (s === 'pending') return t('requestPending');
    if (s === 'approved') return t('requestApproved');
    if (s === 'rejected') return t('requestRejected');
    return t('requestCancelled');
  };

  const leaveStatusLabel = (r: (typeof leaveMine)[number]) => {
    if (r.status === 'pending') {
      if (r.workflowStep === 'supervisor') return t('leaveStatusAwaitingSupervisor');
      if (r.workflowStep === 'hr') return t('leaveStatusAwaitingHr');
    }
    return statusLabel(r.status);
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        tab === id
          ? 'bg-indigo-600 text-white shadow'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('myRequestsIntro')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tabBtn('leave', `${t('leaveTypeHoliday')} / ${t('leaveTypeSick')}`)}
          {tabBtn('salary', t('requestSubmitSalary'))}
        </div>
      </div>

      {(currentSal != null || leaveBal != null) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {currentSal != null && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('requestCurrentSalary')}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{formatIls(currentSal)}</p>
            </div>
          )}
          {leaveBal != null && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('requestAnnualBalance')}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{leaveBal}</p>
            </div>
          )}
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      {tab === 'leave' && (
        <form
          onSubmit={submitLeave}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('requestSubmitLeave')}</h3>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['holiday', t('leaveTypeHoliday')],
                ['sick', t('leaveTypeSick')],
              ] as const
            ).map(([v, lab]) => (
              <button
                key={v}
                type="button"
                onClick={() => setLeaveType(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  leaveType === v
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {lab}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('requestStartDate')}
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('requestEndDate')}
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('requestReason')}
            <textarea
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
          >
            {submitting ? t('requestSubmitting') : t('requestSubmitLeave')}
          </button>
        </form>
      )}

      {tab === 'salary' && (
        <form
          onSubmit={submitSalary}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('requestSubmitSalary')}</h3>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('requestRequestedSalary')}
            <input
              type="number"
              min={0}
              step="0.01"
              required
              value={reqSalary}
              onChange={(e) => setReqSalary(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('requestReason')}
            <textarea
              value={salaryReason}
              onChange={(e) => setSalaryReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
          >
            {submitting ? t('requestSubmitting') : t('requestSubmitSalary')}
          </button>
        </form>
      )}

      {tab === 'leave' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('requestMyLeaveList')}</h3>
          {loading ? (
            <p className="text-sm text-slate-500">{t('requestSubmitting')}</p>
          ) : leaveMine.length === 0 ? (
            <p className="text-sm text-slate-500">—</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {leaveMine.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {r.type === 'holiday' ? t('leaveTypeHoliday') : t('leaveTypeSick')} · {r.daysCount} {t('requestDays')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.startDate} → {r.endDate} · {leaveStatusLabel(r)}
                    </p>
                  </div>
                  {r.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => void cancelLeave(r.id)}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      {t('requestCancel')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'salary' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('requestMySalaryList')}</h3>
          {loading ? (
            <p className="text-sm text-slate-500">{t('requestSubmitting')}</p>
          ) : salaryMine.length === 0 ? (
            <p className="text-sm text-slate-500">—</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {salaryMine.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatIls(Number(r.requestedMonthlySalary))} → {statusLabel(r.status)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.status === 'approved' && r.approvedMonthlySalary
                        ? `${t('requestApproved')}: ${formatIls(Number(r.approvedMonthlySalary))}`
                        : ''}
                    </p>
                  </div>
                  {r.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => void cancelSalary(r.id)}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      {t('requestCancel')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
