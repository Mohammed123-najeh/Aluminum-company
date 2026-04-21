import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import { hrAnalyticsApi, type ApiHrAnalytics, type ApiHrDirectoryRow } from '../../services/api';
import { formatIls } from '../../utils/currency';
import { HrEmployeeDetailModal } from './HrEmployeeDetailModal';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

export const HrAnalyticsPanel: React.FC = () => {
  const { t, token } = useApp();
  const [data, setData] = useState<ApiHrAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const d = await hrAnalyticsApi.get(token);
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const directory: ApiHrDirectoryRow[] = data?.directory ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('hrAnalyticsIntro')}</p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {t('hrRefresh')}
        </button>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      {loading && !data ? (
        <p className="text-sm text-slate-500">{t('requestSubmitting')}</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label={t('hrAnalyticsPendingLeave')} value={data.pendingLeaveRequests} />
            <StatCard label={t('hrAnalyticsPendingSalary')} value={data.pendingSalaryRequests} />
            <StatCard label={t('hrAnalyticsHolidayDaysMonth')} value={data.holidayDaysApprovedThisMonth} />
            <StatCard label={t('hrAnalyticsSickDaysMonth')} value={data.sickDaysApprovedThisMonth} />
            <StatCard label={t('hrAnalyticsActiveEmployees')} value={data.activeEmployeesCount} />
            <StatCard
              label={t('hrAnalyticsAvgSalary')}
              value={data.averageBaseSalary != null ? formatIls(data.averageBaseSalary) : '—'}
            />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hrDirectorySection')}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('hrDirectoryHint')}</p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
                  <tr>
                    <th className="px-3 py-2">{t('userCol')}</th>
                    <th className="px-3 py-2">{t('roleTypeCol')}</th>
                    <th className="px-3 py-2">{t('statusCol')}</th>
                    <th className="px-3 py-2">{t('hrDirColSupervisor')}</th>
                    <th className="px-3 py-2">{t('hrColSalary')}</th>
                    <th className="px-3 py-2">{t('hrColLeaveBal')}</th>
                    <th className="px-3 py-2">{t('hrDirColHolYtd')}</th>
                    <th className="px-3 py-2">{t('hrDirColSickYtd')}</th>
                    <th className="px-3 py-2">{t('hrDirColPendingLeave')}</th>
                    <th className="px-3 py-2">{t('hrDirColPendingSal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {directory.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                        —
                      </td>
                    </tr>
                  ) : (
                    directory.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-b border-slate-100 transition hover:bg-indigo-50/80 dark:border-slate-800 dark:hover:bg-slate-800/80"
                        onClick={() => setDetailUserId(row.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setDetailUserId(row.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{row.name}</p>
                          <p className="text-xs text-slate-500">{row.email}</p>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                          <span className="capitalize">{row.role}</span>
                          {row.employeeType ? (
                            <span className="text-slate-500"> · {row.employeeType}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.status === 'active' ? t('statusActive') : t('statusSuspended')}
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-2.5 text-slate-600 dark:text-slate-400">
                          {row.supervisorName ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {row.baseSalary != null ? formatIls(Number(row.baseSalary)) : '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{row.annualLeaveBalance ?? '—'}</td>
                        <td className="px-3 py-2.5 tabular-nums">{row.approvedHolidayDaysYtd}</td>
                        <td className="px-3 py-2.5 tabular-nums">{row.approvedSickDaysYtd}</td>
                        <td className="px-3 py-2.5 tabular-nums">{row.pendingLeaveCount}</td>
                        <td className="px-3 py-2.5 tabular-nums">{row.pendingSalaryCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hrAnalyticsLeaveYtd')}</h3>
            <div className="mt-4 flex flex-wrap gap-4">
              {Object.entries(data.leaveByTypeYear).map(([type, v]) => (
                <div
                  key={type}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80"
                >
                  <p className="text-xs font-medium capitalize text-slate-500">
                    {type === 'holiday' ? t('leaveTypeHoliday') : t('leaveTypeSick')}
                  </p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {v.days} {t('requestDays')} · {v.count}
                  </p>
                </div>
              ))}
              {Object.keys(data.leaveByTypeYear).length === 0 && (
                <p className="text-sm text-slate-500">—</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hrAnalyticsRecentLeave')}</h3>
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentLeaveActivity.length === 0 ? (
                <li className="py-2 text-sm text-slate-500">—</li>
              ) : (
                data.recentLeaveActivity.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{r.employeeName}</span>
                    <span className="text-slate-500">
                      {r.type === 'holiday' ? t('leaveTypeHoliday') : t('leaveTypeSick')} · {r.daysCount} {t('requestDays')} ·{' '}
                      {r.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      ) : null}

      <HrEmployeeDetailModal userId={detailUserId} onClose={() => setDetailUserId(null)} />
    </div>
  );
};
