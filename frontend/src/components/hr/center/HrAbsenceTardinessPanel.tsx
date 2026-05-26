import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { hrCenterApi } from '../../../services/api';
import { DataTable, type Column } from '../../shared/dash';

type Row = {
  userId: string; name: string; department: string | null;
  absenceDays: number; lateCount: number; lateMinutes: number; unjustifiedAbsences: number;
};

type Tab = 'absences' | 'tardiness' | 'monthlyReport';

export const HrAbsenceTardinessPanel: React.FC = () => {
  const { token, t } = useApp();
  const [tab, setTab] = useState<Tab>('absences');
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await hrCenterApi.reportAbsenceTardiness(token, { year, month });
      setRows(r.rows);
    } finally { setLoading(false); }
  }, [token, year, month]);

  useEffect(() => { void load(); }, [load]);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'absences', label: t('hr.absence.tab.absences') },
    { key: 'tardiness', label: t('hr.absence.tab.tardiness') },
    { key: 'monthlyReport', label: t('hr.absence.tab.monthlyReport') },
  ];

  const absenceCols: Column<Row>[] = [
    { key: 'name', header: t('hr.employees.col.name'), render: (r) => r.name },
    { key: 'dept', header: t('hr.employees.col.department'), render: (r) => r.department ?? '—', hideOnMobile: true },
    { key: 'days', header: t('hr.attendance.summary.absent'), align: 'end', render: (r) => r.absenceDays },
    { key: 'unjust', header: 'Unjustified', align: 'end', render: (r) => <span className="font-semibold text-rose-700">{r.unjustifiedAbsences}</span> },
  ];

  const tardinessCols: Column<Row>[] = [
    { key: 'name', header: t('hr.employees.col.name'), render: (r) => r.name },
    { key: 'dept', header: t('hr.employees.col.department'), render: (r) => r.department ?? '—', hideOnMobile: true },
    { key: 'count', header: t('hr.attendance.summary.late'), align: 'end', render: (r) => r.lateCount },
    { key: 'min', header: t('hr.attendance.col.late'), align: 'end', render: (r) => <span className="font-semibold text-amber-700">{r.lateMinutes}</span> },
  ];

  const monthlyCols: Column<Row>[] = [
    ...absenceCols,
    { key: 'lateCount', header: t('hr.attendance.summary.late'), align: 'end', render: (r) => r.lateCount },
    { key: 'lateMin', header: t('hr.attendance.col.late'), align: 'end', render: (r) => r.lateMinutes },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {tabs.map((tt) => (
          <button key={tt.key} type="button" onClick={() => setTab(tt.key)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${tab === tt.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-indigo-950/40'}`}>
            {tt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
          {Array.from({ length: 5 }, (_, i) => today.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={() => window.print()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          {t('fin.reports.exportPdf')}
        </button>
      </div>

      {tab === 'absences' && <DataTable rows={rows} columns={absenceCols} rowKey={(r) => r.userId} loading={loading} empty={t('fin.common.empty')} />}
      {tab === 'tardiness' && <DataTable rows={rows} columns={tardinessCols} rowKey={(r) => r.userId} loading={loading} empty={t('fin.common.empty')} />}
      {tab === 'monthlyReport' && <DataTable rows={rows} columns={monthlyCols} rowKey={(r) => r.userId} loading={loading} empty={t('fin.common.empty')} />}
    </div>
  );
};
