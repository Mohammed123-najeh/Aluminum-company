import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { hrCenterApi, type ApiHrDashboard } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { KpiCard, MiniChart, DataTable, SectionHeader, StatusBadge, COLORS, type Column } from '../../shared/dash';

export const HrDashboard: React.FC = () => {
  const { token, t } = useApp();
  const [data, setData] = useState<ApiHrDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try { setData(await hrCenterApi.dashboard(token)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <p className="text-sm text-slate-500">{t('fin.common.loading')}</p>;
  if (err) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>;
  if (!data) return null;

  const liveCols: Column<ApiHrDashboard['liveAttendance'][number]>[] = [
    { key: 'name', header: t('hr.employees.col.name'), render: (r) => r.userName ?? '—' },
    { key: 'dept', header: t('hr.employees.col.department'), render: (r) => r.department ?? '—', hideOnMobile: true },
    { key: 'in', header: t('hr.attendance.col.clockIn'), render: (r) => r.clockInAt ? new Date(r.clockInAt).toLocaleTimeString() : '—' },
    { key: 'out', header: t('hr.attendance.col.clockOut'), render: (r) => r.clockOutAt ? new Date(r.clockOutAt).toLocaleTimeString() : '—', hideOnMobile: true },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title={t('hr.dashboard.title')} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label={t('hr.dashboard.kpi.total')} value={data.kpi.totalEmployees} tone="accent" />
        <KpiCard label={t('hr.dashboard.kpi.present')} value={data.kpi.presentToday} tone="positive" hint={`${Math.round((data.kpi.presentToday / Math.max(1, data.kpi.totalEmployees)) * 100)}%`} />
        <KpiCard label={t('hr.dashboard.kpi.absent')} value={data.kpi.absentToday} tone="danger" />
        <KpiCard label={t('hr.dashboard.kpi.pendingLeave')} value={data.kpi.pendingLeave} tone="warning" />
        <KpiCard label={t('hr.dashboard.kpi.monthlyPayroll')} value={formatIls(data.kpi.monthlyPayroll)} tone="neutral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hr.dashboard.weekly.title')}</h3>
          <MiniChart
            kind="line"
            labels={data.weekly.map((w) => w.date.slice(5))}
            series={[
              { label: t('hr.attendance.summary.present'), values: data.weekly.map((w) => w.present), color: COLORS.emerald },
              { label: t('hr.attendance.summary.late'), values: data.weekly.map((w) => w.late), color: COLORS.amber },
              { label: t('hr.attendance.summary.absent'), values: data.weekly.map((w) => w.absent), color: COLORS.rose },
            ]}
          />
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hr.dashboard.byDept.title')}</h3>
          {data.byDepartment.length > 0 ? (
            <MiniChart kind="hbar" labels={data.byDepartment.map((d) => d.label)} values={data.byDepartment.map((d) => d.count)} color={COLORS.indigo} />
          ) : (
            <p className="py-6 text-center text-xs text-slate-400">{t('fin.common.empty')}</p>
          )}
        </section>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hr.dashboard.live.title')}</h3>
        <DataTable rows={data.liveAttendance} columns={liveCols} rowKey={(r) => r.id} empty={t('fin.common.empty')} dense />
      </div>
    </div>
  );
};
