import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import {
  adminApprovalsApi,
  salaryRequestsApi,
  submissionsApi,
  type ApiAdminSubmission,
  type ApiSalaryRequest,
} from '../../services/api';
import { formatIls } from '../../utils/currency';

type Props = {
  /** Called after approve/reject so sidebar badge can refresh */
  onCountsMayHaveChanged?: () => void;
};

export const AdminApprovalCenter: React.FC<Props> = ({ onCountsMayHaveChanged }) => {
  const { t, token } = useApp();
  const [salaryPending, setSalaryPending] = useState<ApiSalaryRequest[]>([]);
  const [subsPending, setSubsPending] = useState<ApiAdminSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [tab, setTab] = useState<'salary' | 'submissions'>('salary');
  const [decideSalaryId, setDecideSalaryId] = useState<string | null>(null);
  const [decideSalStatus, setDecideSalStatus] = useState<'approved' | 'rejected'>('approved');
  const [decideSalNote, setDecideSalNote] = useState('');
  const [decideSalAmount, setDecideSalAmount] = useState('');
  const [savingSal, setSavingSal] = useState(false);

  const [decideSubId, setDecideSubId] = useState<string | null>(null);
  const [decideSubStatus, setDecideSubStatus] = useState<'approved' | 'rejected'>('approved');
  const [decideSubNote, setDecideSubNote] = useState('');
  const [savingSub, setSavingSub] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [s, u] = await Promise.all([
        salaryRequestsApi.listHr(token, { status: 'pending' }),
        adminApprovalsApi.listSubmissions(token, { status: 'pending' }),
      ]);
      setSalaryPending(s);
      setSubsPending(u);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitSalaryDecision = async () => {
    if (!token || !decideSalaryId) return;
    setSavingSal(true);
    setErr(null);
    try {
      await salaryRequestsApi.decide(token, decideSalaryId, {
        status: decideSalStatus,
        decision_note: decideSalNote.trim() || null,
        approved_monthly_salary:
          decideSalStatus === 'approved' && decideSalAmount.trim() !== ''
            ? Number(decideSalAmount)
            : undefined,
      });
      setDecideSalaryId(null);
      await load();
      onCountsMayHaveChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingSal(false);
    }
  };

  const submitSubmissionDecision = async () => {
    if (!token || !decideSubId) return;
    setSavingSub(true);
    setErr(null);
    try {
      await adminApprovalsApi.decideSubmission(token, decideSubId, {
        status: decideSubStatus,
        decision_note: decideSubNote.trim() || null,
      });
      setDecideSubId(null);
      await load();
      onCountsMayHaveChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingSub(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('adminApprovalsIntro')}</p>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setTab('salary')}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === 'salary' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {t('adminApprovalsTabSalary')} ({salaryPending.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('submissions')}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === 'submissions' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {t('adminApprovalsTabSubmissions')} ({subsPending.length})
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="ms-auto rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600"
        >
          {t('hrRefresh')}
        </button>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">{t('requestSubmitting')}</p>
      ) : tab === 'salary' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-800">
                <th className="px-4 py-3">{t('userCol')}</th>
                <th className="px-4 py-3">{t('requestRequestedSalary')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {salaryPending.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-slate-500">
                    {t('hrNoPending')}
                  </td>
                </tr>
              ) : (
                salaryPending.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.userName}</p>
                      <p className="text-xs text-slate-500">{r.userEmail}</p>
                    </td>
                    <td className="px-4 py-3">{formatIls(Number(r.requestedMonthlySalary))}</td>
                    <td className="px-4 py-3 text-end">
                      <button
                        type="button"
                        onClick={() => {
                          setDecideSalaryId(r.id);
                          setDecideSalStatus('approved');
                          setDecideSalNote('');
                          setDecideSalAmount('');
                        }}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {t('adminApprovalsReview')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-800">
                <th className="px-4 py-3">{t('adminSubmissionType')}</th>
                <th className="px-4 py-3">{t('adminSubmissionTitle')}</th>
                <th className="px-4 py-3">{t('userCol')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {subsPending.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-slate-500">
                    {t('hrNoPending')}
                  </td>
                </tr>
              ) : (
                subsPending.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-4 py-3 font-mono text-xs">{s.type}</td>
                    <td className="px-4 py-3">{s.title}</td>
                    <td className="px-4 py-3">{s.submittedBy?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-end space-x-2">
                      {s.hasAttachment && (
                        <button
                          type="button"
                          onClick={() => {
                            if (token) void submissionsApi.downloadAttachment(token, s.id);
                          }}
                          className="rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600"
                        >
                          {t('adminSubmissionDownload')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setDecideSubId(s.id);
                          setDecideSubStatus('approved');
                          setDecideSubNote('');
                        }}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {t('adminApprovalsReview')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {decideSalaryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !savingSal && setDecideSalaryId(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hrPendingSalary')}</h4>
            <div className="mt-4 flex gap-2">
              {(['approved', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDecideSalStatus(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    decideSalStatus === s
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {s === 'approved' ? t('requestApproved') : t('requestRejected')}
                </button>
              ))}
            </div>
            {decideSalStatus === 'approved' && (
              <label className="mt-3 block text-xs text-slate-600 dark:text-slate-400">
                {t('hrApproveSalaryHint')}
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={decideSalAmount}
                  onChange={(e) => setDecideSalAmount(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
            )}
            <label className="mt-3 block text-xs text-slate-600 dark:text-slate-400">
              {t('requestDecisionNote')}
              <textarea
                value={decideSalNote}
                onChange={(e) => setDecideSalNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecideSalaryId(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={savingSal}
                onClick={() => void submitSalaryDecision()}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
              >
                {t('saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {decideSubId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !savingSub && setDecideSubId(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('adminSubmissionDecideTitle')}</h4>
            <div className="mt-4 flex gap-2">
              {(['approved', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDecideSubStatus(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    decideSubStatus === s
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
                value={decideSubNote}
                onChange={(e) => setDecideSubNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecideSubId(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={savingSub}
                onClick={() => void submitSubmissionDecision()}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
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
