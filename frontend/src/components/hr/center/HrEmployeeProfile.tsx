import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { hrCenterApi, type ApiEmployee, type ApiPayslip, type ApiAttendanceLogRow, type ApiEmployeeDocument, type ApiSalaryIncrement } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, StatusBadge, type Column } from '../../shared/dash';
import type { ApiLeaveRequest } from '../../../services/api';

type Tab = 'personal' | 'work' | 'attendance' | 'payroll' | 'leaves' | 'advances' | 'documents';

type DetailData = {
  user: ApiEmployee;
  payslips: ApiPayslip[];
  leaveHistory: ApiLeaveRequest[];
  recentAttendance: ApiAttendanceLogRow[];
  documents: ApiEmployeeDocument[];
  increments: ApiSalaryIncrement[];
};

export const HrEmployeeProfile: React.FC<{ userId: string; onBack: () => void }> = ({ userId, onBack }) => {
  const { token, t } = useApp();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('personal');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try { setData(await hrCenterApi.showEmployee(token, userId)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [token, userId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <p className="text-sm text-slate-500">{t('fin.common.loading')}</p>;
  if (err) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>;
  if (!data) return null;

  const u = data.user;
  const initials = u.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'personal', label: t('hr.profile.tab.personal') },
    { key: 'work', label: t('hr.profile.tab.work') },
    { key: 'attendance', label: t('hr.profile.tab.attendance') },
    { key: 'payroll', label: t('hr.profile.tab.payroll') },
    { key: 'leaves', label: t('hr.profile.tab.leaves') },
    { key: 'advances', label: t('hr.profile.tab.advances') },
    { key: 'documents', label: t('hr.profile.tab.documents') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          ← {t('hr.profile.back')}
        </button>
      </div>

      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 text-xl font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{u.name}</h2>
          <p className="text-sm text-slate-500">{u.mainJob ?? '—'} · {u.department ?? u.employeeType ?? '—'}</p>
          <p className="mt-1 text-xs text-slate-400">{u.email} · {u.phone ?? '—'}</p>
        </div>
        <StatusBadge status={u.status} label={t(`hr.employees.status.${u.status}` as any)} />
      </header>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {tabs.map((tt) => (
          <button key={tt.key} type="button" onClick={() => setTab(tt.key)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${tab === tt.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-indigo-950/40'}`}>
            {tt.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {tab === 'personal' && <PersonalTab u={u} t={t} />}
        {tab === 'work' && <WorkTab u={u} t={t} increments={data.increments} />}
        {tab === 'attendance' && <AttendanceTab logs={data.recentAttendance} t={t} />}
        {tab === 'payroll' && <PayrollTab payslips={data.payslips} t={t} />}
        {tab === 'leaves' && <LeavesTab leaves={data.leaveHistory} t={t} />}
        {tab === 'advances' && <AdvancesTab t={t} />}
        {tab === 'documents' && <DocumentsTab docs={data.documents} userId={userId} onChange={load} t={t} />}
      </div>
    </div>
  );
};

const KV: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div>
    <p className="text-xs text-slate-400">{k}</p>
    <p className="font-medium text-slate-900 dark:text-slate-100">{v ?? '—'}</p>
  </div>
);

const PersonalTab: React.FC<{ u: ApiEmployee; t: (k: any) => string }> = ({ u, t }) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <KV k={t('hr.employees.col.name')} v={u.name} />
    <KV k={t('hr.profile.nationalId')} v={u.nationalId} />
    <KV k={t('hr.profile.nationality')} v={u.nationality} />
    <KV k={t('hr.profile.birthDate')} v={u.birthDate} />
    <KV k={t('hr.profile.gender')} v={u.gender} />
    <KV k={t('hr.profile.maritalStatus')} v={u.maritalStatus} />
    <KV k={t('hr.profile.childrenCount')} v={u.childrenCount} />
    <KV k={t('hr.employees.col.phone')} v={u.phone} />
    <KV k="Email" v={u.email} />
    <KV k={t('hr.profile.address')} v={u.address} />
  </div>
);

const WorkTab: React.FC<{ u: ApiEmployee; t: (k: any) => string; increments: ApiSalaryIncrement[] }> = ({ u, t, increments }) => (
  <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KV k={t('hr.employees.col.empNumber')} v={u.employeeNumber} />
      <KV k={t('hr.employees.col.department')} v={u.department ?? u.employeeType} />
      <KV k="Job title" v={u.mainJob} />
      <KV k={t('hr.employees.col.hireDate')} v={u.hireDate} />
      <KV k={t('hr.profile.contractType')} v={u.contractType} />
      <KV k={t('hr.profile.contractDuration')} v={u.contractDuration} />
      <KV k={t('hr.employees.col.baseSalary')} v={u.baseSalary ? formatIls(Number(u.baseSalary)) : '—'} />
      <KV k={t('hr.profile.bankAccount')} v={u.bankAccount} />
    </div>
    {u.allowances && Object.keys(u.allowances).length > 0 && (
      <div>
        <h4 className="mb-2 text-sm font-semibold">{t('hr.profile.allowances.title')}</h4>
        <div className="grid gap-2 sm:grid-cols-4">
          {Object.entries(u.allowances).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
              <p className="text-xs text-slate-400">{k}</p>
              <p className="font-semibold tabular-nums">{formatIls(Number(v))}</p>
            </div>
          ))}
        </div>
      </div>
    )}
    {increments.length > 0 && (
      <div>
        <h4 className="mb-2 text-sm font-semibold">{t('hr.payroll.tab.increments')}</h4>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {increments.map((inc) => (
            <li key={inc.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{inc.effectiveDate} — {t(`hr.payroll.increments.type.${inc.type}` as any)}</span>
              <span className="text-emerald-700 dark:text-emerald-300">+{formatIls(Number(inc.amount))}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const AttendanceTab: React.FC<{ logs: ApiAttendanceLogRow[]; t: (k: any) => string }> = ({ logs, t }) => {
  const cols: Column<ApiAttendanceLogRow>[] = [
    { key: 'date', header: t('fin.invoices.date'), render: (r) => r.clockInAt?.slice(0, 10) ?? '—' },
    { key: 'in', header: t('hr.attendance.col.clockIn'), render: (r) => r.clockInAt ? new Date(r.clockInAt).toLocaleTimeString() : '—' },
    { key: 'out', header: t('hr.attendance.col.clockOut'), render: (r) => r.clockOutAt ? new Date(r.clockOutAt).toLocaleTimeString() : '—' },
    { key: 'h', header: t('hr.attendance.col.duration'), render: (r) => r.hoursWorked ? `${r.hoursWorked} h` : '—' },
    { key: 'late', header: t('hr.attendance.col.late'), render: (r) => r.lateMinutes || '—' },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
  ];
  return <DataTable rows={logs} columns={cols} rowKey={(r) => r.id} empty={t('fin.common.empty')} dense />;
};

const PayrollTab: React.FC<{ payslips: ApiPayslip[]; t: (k: any) => string }> = ({ payslips, t }) => {
  const cols: Column<ApiPayslip>[] = [
    { key: 'run', header: t('hr.payroll.payslip.title'), render: (r) => r.id },
    { key: 'gross', header: t('hr.payroll.col.gross'), align: 'end', render: (r) => formatIls(Number(r.gross)) },
    { key: 'ded', header: t('hr.payroll.col.deductions'), align: 'end', render: (r) => formatIls(Number(r.totalDeductions)) },
    { key: 'net', header: t('hr.payroll.col.net'), align: 'end', render: (r) => <span className="font-bold">{formatIls(Number(r.net))}</span> },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
  ];
  return <DataTable rows={payslips} columns={cols} rowKey={(r) => r.id} empty={t('fin.common.empty')} dense />;
};

const LeavesTab: React.FC<{ leaves: ApiLeaveRequest[]; t: (k: any) => string }> = ({ leaves, t }) => {
  const cols: Column<ApiLeaveRequest>[] = [
    { key: 'type', header: t('hr.leave.col.type'), render: (r) => r.type },
    { key: 'from', header: t('hr.leave.col.from'), render: (r) => r.startDate ?? '—' },
    { key: 'to', header: t('hr.leave.col.to'), render: (r) => r.endDate ?? '—' },
    { key: 'days', header: t('hr.leave.col.days'), align: 'end', render: (r) => r.daysCount ?? '—' },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
  ];
  return <DataTable rows={leaves} columns={cols} rowKey={(r) => r.id} empty={t('fin.common.empty')} dense />;
};

const AdvancesTab: React.FC<{ t: (k: any) => string }> = ({ t }) => (
  <p className="text-sm text-slate-500">{t('fin.advances.title')} — see Finance Center → Advances.</p>
);

const DocumentsTab: React.FC<{ docs: ApiEmployeeDocument[]; userId: string; onChange: () => void; t: (k: any) => string }> = ({ docs, userId, onChange, t }) => {
  const { token } = useApp();
  const [type, setType] = useState('contract');
  const [label, setLabel] = useState('');
  const [filePath, setFilePath] = useState('');
  const [saving, setSaving] = useState(false);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !label || !filePath) return;
    setSaving(true);
    try {
      await hrCenterApi.uploadDocument(token, userId, { type, label, file_path: filePath });
      setLabel(''); setFilePath('');
      onChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    if (!confirm('Delete document?')) return;
    try { await hrCenterApi.deleteDocument(token, id); onChange(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={upload} className="grid gap-2 sm:grid-cols-4 sm:items-end">
        <label className="flex flex-col text-xs"><span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="contract">Contract</option>
            <option value="id">ID</option>
            <option value="passport">Passport</option>
            <option value="certificate">Certificate</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex flex-col text-xs"><span>Label</span><input value={label} onChange={(e) => setLabel(e.target.value)} required className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800" /></label>
        <label className="flex flex-col text-xs"><span>File path / URL</span><input value={filePath} onChange={(e) => setFilePath(e.target.value)} required className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800" /></label>
        <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">+ Upload</button>
      </form>
      <ul className="space-y-1">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <span><span className="font-mono text-xs text-slate-400">{d.type}</span> {d.label}</span>
            <div className="flex items-center gap-2">
              <a href={d.filePath} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">{t('fin.common.view')}</a>
              <button onClick={() => void remove(d.id)} className="text-xs text-rose-600 hover:underline">{t('fin.common.delete')}</button>
            </div>
          </li>
        ))}
        {docs.length === 0 && <li className="text-xs text-slate-400">{t('fin.common.empty')}</li>}
      </ul>
    </div>
  );
};
