import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { hrCenterApi, type ApiPayrollRun } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, KpiCard, SectionHeader, type Column } from '../../shared/dash';

type ReportKey = 'attendanceMonthly' | 'payrollMonthly' | 'leaves' | 'absenceTardiness' | 'turnover' | 'advances' | 'compensationYtd';

const REPORTS: Array<{ key: ReportKey; tkey: string }> = [
  { key: 'attendanceMonthly', tkey: 'hr.reports.attendanceMonthly' },
  { key: 'payrollMonthly', tkey: 'hr.reports.payrollMonthly' },
  { key: 'leaves', tkey: 'hr.reports.leaves' },
  { key: 'absenceTardiness', tkey: 'hr.reports.absenceTardiness' },
  { key: 'turnover', tkey: 'hr.reports.turnover' },
  { key: 'advances', tkey: 'hr.reports.advances' },
  { key: 'compensationYtd', tkey: 'hr.reports.compensationYtd' },
];

export const HrReportsPanel: React.FC = () => {
  const { token, t } = useApp();
  const [active, setActive] = useState<ReportKey>('payrollMonthly');
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (active === 'payrollMonthly') {
        setData(await hrCenterApi.reportPayroll(token, { year }));
      } else if (active === 'absenceTardiness') {
        setData(await hrCenterApi.reportAbsenceTardiness(token, { year, month }));
      } else {
        setData(null);
      }
    } finally { setLoading(false); }
  }, [token, active, year, month]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <SectionHeader title={t('hrAnalyticsTitle')} subtitle={t('fin.reports.title')} />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {REPORTS.map((r) => (
            <button key={r.key} type="button" onClick={() => setActive(r.key)} className={`block w-full rounded-lg px-3 py-2 text-start text-sm font-medium ${active === r.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-indigo-950/40'}`}>
              {t(r.tkey as any)}
            </button>
          ))}
        </aside>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <label className="flex flex-col text-xs">
              <span className="text-slate-500">Year</span>
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                {Array.from({ length: 5 }, (_, i) => today.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            {active === 'absenceTardiness' && (
              <label className="flex flex-col text-xs">
                <span className="text-slate-500">Month</span>
                <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            )}
            <button onClick={() => void load()} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
              {t('fin.reports.generate')}
            </button>
            <button onClick={() => window.print()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              {t('fin.reports.exportPdf')}
            </button>
          </div>

          {loading && <p className="text-sm text-slate-500">{t('fin.common.loading')}</p>}

          {!loading && active === 'payrollMonthly' && data?.rows && <PayrollReport rows={data.rows} t={t} />}
          {!loading && active === 'absenceTardiness' && data?.rows && <AbsenceTardinessReport rows={data.rows} t={t} />}
          {!loading && (active === 'attendanceMonthly' || active === 'leaves' || active === 'turnover' || active === 'advances' || active === 'compensationYtd') && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
              {t(`hr.reports.${active}` as any)} — available via list pages.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PayrollReport: React.FC<{ rows: ApiPayrollRun[]; t: (k: any) => string }> = ({ rows, t }) => {
  const totalGross = rows.reduce((s, r) => s + Number(r.totalGross), 0);
  const totalNet = rows.reduce((s, r) => s + Number(r.totalNet), 0);
  const cols: Column<ApiPayrollRun>[] = [
    { key: 'period', header: 'Period', render: (r) => `${r.year}-${String(r.month).padStart(2, '0')}` },
    { key: 'gross', header: t('hr.payroll.col.gross'), align: 'end', render: (r) => formatIls(Number(r.totalGross)) },
    { key: 'ded', header: t('hr.payroll.col.deductions'), align: 'end', render: (r) => formatIls(Number(r.totalDeductions)) },
    { key: 'net', header: t('hr.payroll.col.net'), align: 'end', render: (r) => <span className="font-bold">{formatIls(Number(r.totalNet))}</span> },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => r.status },
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCard label={t('hr.payroll.col.gross')} value={formatIls(totalGross)} tone="accent" />
        <KpiCard label={t('hr.payroll.col.net')} value={formatIls(totalNet)} tone="positive" />
      </div>
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} empty={t('fin.common.empty')} />
    </div>
  );
};

const AbsenceTardinessReport: React.FC<{ rows: any[]; t: (k: any) => string }> = ({ rows, t }) => {
  const cols: Column<any>[] = [
    { key: 'name', header: t('hr.employees.col.name'), render: (r) => r.name },
    { key: 'dept', header: t('hr.employees.col.department'), render: (r) => r.department ?? '—' },
    { key: 'absent', header: t('hr.attendance.summary.absent'), align: 'end', render: (r) => r.absenceDays },
    { key: 'lateC', header: t('hr.attendance.summary.late'), align: 'end', render: (r) => r.lateCount },
    { key: 'lateM', header: t('hr.attendance.col.late'), align: 'end', render: (r) => r.lateMinutes },
  ];
  return <DataTable rows={rows} columns={cols} rowKey={(r) => r.userId} empty={t('fin.common.empty')} />;
};
