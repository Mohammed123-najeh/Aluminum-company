import React, { useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { hrAnalyticsApi, type ApiHrEmployeeDetail } from '../../services/api';
import { formatIls } from '../../utils/currency';

type Props = {
  userId: string | null;
  onClose: () => void;
};

export const HrEmployeeDetailModal: React.FC<Props> = ({ userId, onClose }) => {
  const { t, token } = useApp();
  const [data, setData] = useState<ApiHrEmployeeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !token) {
      setData(null);
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    hrAnalyticsApi
      .employeeDetail(userId, token)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, token]);

  if (!userId) return null;

  const leaveStatus = (s: string) => {
    if (s === 'pending') return t('requestPending');
    if (s === 'approved') return t('requestApproved');
    if (s === 'rejected') return t('requestRejected');
    return t('requestCancelled');
  };

  const u = data?.user;

  const roleText = (role: string) => {
    if (role === 'supervisor') return t('supervisor');
    if (role === 'employee') return t('employee');
    return role;
  };
  const empTypeText = (et: string | null | undefined) => {
    if (!et) return '';
    if (et === 'accountant') return t('accountant');
    if (et === 'sales') return t('sales');
    if (et === 'hr') return t('hr');
    return et;
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          className="relative flex w-full max-w-4xl max-h-[min(92vh,calc(100dvh-1rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('hrDetailModalTitle')}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">{u?.name ?? '…'}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {loading && (
              <div className="flex justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 dark:border-slate-600" />
              </div>
            )}
            {err && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {err}
              </div>
            )}
            {!loading && data && u && (
              <div className="space-y-8">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('hrDetailProfile')}</h3>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] text-slate-500">{t('emailAddress')}</dt>
                      <dd className="text-sm text-slate-900 dark:text-slate-100">{u.email}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">{t('roleTypeCol')}</dt>
                      <dd className="text-sm text-slate-900 dark:text-slate-100">
                        {roleText(u.role)}
                        {u.employeeType ? ` · ${empTypeText(u.employeeType)}` : ''}
                      </dd>
                    </div>
                    {u.mainJob && (
                      <div>
                        <dt className="text-[11px] text-slate-500">{t('mainJob')}</dt>
                        <dd className="text-sm text-slate-900 dark:text-slate-100">{u.mainJob}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-[11px] text-slate-500">{t('statusCol')}</dt>
                      <dd className="text-sm text-slate-900 dark:text-slate-100">
                        {u.status === 'active' ? t('statusActive') : t('statusSuspended')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">{t('reportsToCol')}</dt>
                      <dd className="text-sm text-slate-900 dark:text-slate-100">{u.supervisorName ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">{t('hrColSalary')}</dt>
                      <dd className="text-sm text-slate-900 dark:text-slate-100">
                        {u.baseSalary != null ? formatIls(Number(u.baseSalary)) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">{t('hrColLeaveBal')}</dt>
                      <dd className="text-sm text-slate-900 dark:text-slate-100">{u.annualLeaveBalance ?? '—'}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60">
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">{t('hrDetailYtdTotals')}</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">
                        {t('leaveTypeHoliday')}: {data.approvedLeaveDaysYtd.holiday} {t('requestDays')} · {t('leaveTypeSick')}:{' '}
                        {data.approvedLeaveDaysYtd.sick} {t('requestDays')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">{t('hrDetailAllTimeTotals')}</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">
                        {t('leaveTypeHoliday')}: {data.approvedLeaveDaysAllTime.holiday} {t('requestDays')} ·{' '}
                        {t('leaveTypeSick')}: {data.approvedLeaveDaysAllTime.sick} {t('requestDays')}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('hrDetailLeaveHistory')}</h3>
                  {data.leaveRequests.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">{t('hrDetailNoLeaveRows')}</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
                          <tr>
                            <th className="px-3 py-2">{t('requestStatus')}</th>
                            <th className="px-3 py-2">{t('leaveTypeHoliday')} / {t('leaveTypeSick')}</th>
                            <th className="px-3 py-2">{t('requestDays')}</th>
                            <th className="px-3 py-2">{t('requestStartDate')}</th>
                            <th className="px-3 py-2">{t('requestEndDate')}</th>
                            <th className="px-3 py-2">{t('dateCol')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.leaveRequests.map((r) => (
                            <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                              <td className="px-3 py-2">{leaveStatus(r.status)}</td>
                              <td className="px-3 py-2">{r.type === 'holiday' ? t('leaveTypeHoliday') : t('leaveTypeSick')}</td>
                              <td className="px-3 py-2 tabular-nums">{r.daysCount}</td>
                              <td className="px-3 py-2">{r.startDate}</td>
                              <td className="px-3 py-2">{r.endDate}</td>
                              <td className="px-3 py-2 text-xs text-slate-500">
                                {new Date(r.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('hrDetailSalaryHistory')}</h3>
                  {data.salaryRequests.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">{t('hrDetailNoSalaryRows')}</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
                          <tr>
                            <th className="px-3 py-2">{t('requestStatus')}</th>
                            <th className="px-3 py-2">{t('requestRequestedSalary')}</th>
                            <th className="px-3 py-2">{t('requestCurrentSalary')}</th>
                            <th className="px-3 py-2">{t('dateCol')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.salaryRequests.map((r) => (
                            <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                              <td className="px-3 py-2">{leaveStatus(r.status)}</td>
                              <td className="px-3 py-2 tabular-nums">{formatIls(Number(r.requestedMonthlySalary))}</td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                {r.currentSalarySnapshot != null ? formatIls(Number(r.currentSalarySnapshot)) : '—'}
                                {r.approvedMonthlySalary ? ` → ${formatIls(Number(r.approvedMonthlySalary))}` : ''}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-500">
                                {new Date(r.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-100 px-5 py-3 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
