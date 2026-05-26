import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { hrCenterApi, type ApiPayrollRun, type ApiPayslip, type ApiSalaryIncrement, type ApiEmployee } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, FormModal, Field, inputClass, KpiCard, StatusBadge, type Column } from '../../shared/dash';

type Tab = 'run' | 'history' | 'increments' | 'settings';

export const HrPayrollPanel: React.FC = () => {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>('run');

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'run', label: t('hr.payroll.tab.run') },
    { key: 'history', label: t('hr.payroll.tab.history') },
    { key: 'increments', label: t('hr.payroll.tab.increments') },
    { key: 'settings', label: t('hr.payroll.tab.settings') },
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

      {tab === 'run' && <RunTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'increments' && <IncrementsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
};

const RunTab: React.FC = () => {
  const { token, t } = useApp();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [run, setRun] = useState<ApiPayrollRun | null>(null);
  const [payslips, setPayslips] = useState<ApiPayslip[]>([]);
  const [computing, setComputing] = useState(false);
  const [busy, setBusy] = useState(false);

  const compute = async () => {
    if (!token) return;
    setComputing(true);
    try {
      const r = await hrCenterApi.computePayroll(token, { year, month });
      setRun(r.run); setPayslips(r.payslips);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally { setComputing(false); }
  };

  const approve = async () => {
    if (!token || !run) return;
    setBusy(true);
    try {
      const updated = await hrCenterApi.approvePayrollRun(token, run.id);
      setRun(updated);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const payOne = async (id: string) => {
    if (!token) return;
    try {
      const p = await hrCenterApi.payPayslip(token, id);
      setPayslips((prev) => prev.map((x) => x.id === id ? p : x));
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const payAll = async () => {
    if (!token || !run) return;
    if (!confirm(t('hr.payroll.payAll') + '?')) return;
    setBusy(true);
    try {
      for (const p of payslips.filter((x) => x.status !== 'paid')) {
        await hrCenterApi.payPayslip(token, p.id);
      }
      // Reload
      const r = await hrCenterApi.showPayrollRun(token, run.id);
      setRun(r.run); setPayslips(r.payslips);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const cols: Column<ApiPayslip>[] = [
    { key: 'name', header: t('hr.employees.col.name'), render: (r) => r.userName ?? '—' },
    { key: 'dept', header: t('hr.employees.col.department'), render: (r) => r.department ?? '—', hideOnMobile: true },
    { key: 'base', header: t('hr.payroll.col.base'), align: 'end', render: (r) => formatIls(Number(r.baseSalary)) },
    { key: 'gross', header: t('hr.payroll.col.gross'), align: 'end', render: (r) => formatIls(Number(r.gross)) },
    { key: 'ded', header: t('hr.payroll.col.deductions'), align: 'end', render: (r) => formatIls(Number(r.totalDeductions)) },
    { key: 'net', header: t('hr.payroll.col.net'), align: 'end', render: (r) => <span className="font-bold">{formatIls(Number(r.net))}</span> },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} label={t(`hr.payroll.status.${r.status}` as any)} /> },
    { key: 'actions', header: t('fin.common.actions'), render: (r) => (
      run?.status === 'approved' && r.status !== 'paid' ? (
        <button onClick={() => void payOne(r.id)} className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500">Pay</button>
      ) : null
    ) },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold">{t('hr.payroll.run.step1')}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Year">
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={inputClass + ' w-24'}>
              {Array.from({ length: 5 }, (_, i) => today.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Field label="Month">
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className={inputClass + ' w-24'}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <button onClick={() => void compute()} disabled={computing} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
            {t('hr.payroll.compute')}
          </button>
        </div>
      </section>

      {run && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <KpiCard label={t('hr.payroll.col.gross')} value={formatIls(Number(run.totalGross))} tone="accent" />
            <KpiCard label={t('hr.payroll.col.deductions')} value={formatIls(Number(run.totalDeductions))} tone="warning" />
            <KpiCard label={t('hr.payroll.col.net')} value={formatIls(Number(run.totalNet))} tone="positive" />
            <KpiCard label={t('hr.dashboard.kpi.total')} value={run.employeeCount} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('hr.payroll.run.step2')}</h3>
              <div className="flex items-center gap-2">
                <StatusBadge status={run.status} label={t(`hr.payroll.status.${run.status}` as any)} />
                {run.status === 'draft' && (
                  <button onClick={() => void approve()} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                    {t('hr.payroll.approve')}
                  </button>
                )}
                {run.status === 'approved' && (
                  <button onClick={() => void payAll()} disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                    {t('hr.payroll.payAll')}
                  </button>
                )}
              </div>
            </div>
            <DataTable rows={payslips} columns={cols} rowKey={(r) => r.id} empty={t('fin.common.empty')} dense />
          </section>
        </>
      )}
    </div>
  );
};

const HistoryTab: React.FC = () => {
  const { token, t } = useApp();
  const [runs, setRuns] = useState<ApiPayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailRun, setDetailRun] = useState<ApiPayrollRun | null>(null);
  const [detailSlips, setDetailSlips] = useState<ApiPayslip[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try { setRuns(await hrCenterApi.listPayrollRuns(token)); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const openRun = async (run: ApiPayrollRun) => {
    if (!token) return;
    const r = await hrCenterApi.showPayrollRun(token, run.id);
    setDetailRun(r.run); setDetailSlips(r.payslips);
  };

  const cols: Column<ApiPayrollRun>[] = [
    { key: 'period', header: 'Period', render: (r) => `${r.year}-${String(r.month).padStart(2, '0')}` },
    { key: 'employees', header: t('hr.dashboard.kpi.total'), align: 'end', render: (r) => r.employeeCount },
    { key: 'gross', header: t('hr.payroll.col.gross'), align: 'end', render: (r) => formatIls(Number(r.totalGross)) },
    { key: 'net', header: t('hr.payroll.col.net'), align: 'end', render: (r) => formatIls(Number(r.totalNet)) },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} label={t(`hr.payroll.status.${r.status}` as any)} /> },
    { key: 'paid', header: t('hr.payroll.col.paidAt'), render: (r) => r.paidAt?.slice(0, 10) ?? '—' },
  ];

  return (
    <div className="space-y-3">
      <DataTable rows={runs} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} onRowClick={openRun} />
      {detailRun && (
        <FormModal title={`${t('hr.payroll.payslip.title')} — ${detailRun.year}/${detailRun.month}`} open onClose={() => setDetailRun(null)} size="lg" cancelLabel={t('fin.common.cancel')}>
          <div className="space-y-2 text-sm">
            {detailSlips.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.userName}</span>
                  <span><StatusBadge status={p.status} label={t(`hr.payroll.status.${p.status}` as any)} /></span>
                </div>
                <div className="mt-1 grid grid-cols-3 text-xs">
                  <span>Gross: <span className="font-semibold tabular-nums">{formatIls(Number(p.gross))}</span></span>
                  <span>Ded: <span className="font-semibold tabular-nums">{formatIls(Number(p.totalDeductions))}</span></span>
                  <span>Net: <span className="font-bold tabular-nums text-emerald-700">{formatIls(Number(p.net))}</span></span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={() => window.print()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              {t('hr.payroll.payslip.print')}
            </button>
          </div>
        </FormModal>
      )}
    </div>
  );
};

const IncrementsTab: React.FC = () => {
  const { token, t } = useApp();
  const [rows, setRows] = useState<ApiSalaryIncrement[]>([]);
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [r, e] = await Promise.all([
        hrCenterApi.listIncrements(token),
        hrCenterApi.listEmployees(token),
      ]);
      setRows(r); setEmployees(e);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const cols: Column<ApiSalaryIncrement>[] = [
    { key: 'name', header: t('hr.employees.col.name'), render: (r) => r.userName ?? '—' },
    { key: 'type', header: t('hr.leave.col.type'), render: (r) => t(`hr.payroll.increments.type.${r.type}` as any) },
    { key: 'old', header: 'Old', align: 'end', render: (r) => formatIls(Number(r.oldSalary)) },
    { key: 'new', header: 'New', align: 'end', render: (r) => formatIls(Number(r.newSalary)) },
    { key: 'amount', header: '+', align: 'end', render: (r) => <span className="text-emerald-700">{formatIls(Number(r.amount))}</span> },
    { key: 'effective', header: t('hr.payroll.increments.effectiveDate'), render: (r) => r.effectiveDate ?? '—' },
    { key: 'applied', header: 'Applied', render: (r) => r.applied ? '✓' : '—' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
          + {t('hr.payroll.increments.add')}
        </button>
      </div>
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} />
      <AddIncrementModal open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); void load(); }} employees={employees} />
    </div>
  );
};

const AddIncrementModal: React.FC<{ open: boolean; onClose: () => void; onCreated: () => void; employees: ApiEmployee[] }> = ({ open, onClose, onCreated, employees }) => {
  const { token, t } = useApp();
  const [userId, setUserId] = useState('');
  const [type, setType] = useState<'annual' | 'promotion' | 'bonus' | 'adjustment'>('annual');
  const [mode, setMode] = useState<'amount' | 'percentage'>('amount');
  const [value, setValue] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selected = employees.find((e) => e.id === userId);
  const currentSalary = selected?.baseSalary ? Number(selected.baseSalary) : 0;
  const amount = mode === 'amount' ? parseFloat(value || '0') : currentSalary * (parseFloat(value || '0') / 100);
  const newSalary = currentSalary + amount;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !userId) return;
    setSubmitting(true);
    try {
      await hrCenterApi.createIncrement(token, {
        user_id: userId, type, mode, value: parseFloat(value),
        effective_date: effectiveDate, reason: reason || undefined,
      });
      onCreated();
      setUserId(''); setValue(''); setReason('');
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <FormModal title={t('hr.payroll.increments.add')} open={open} onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel={t('fin.common.save')} cancelLabel={t('fin.common.cancel')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('hr.employees.col.name')} required>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} required className={inputClass}>
            <option value="">—</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        <Field label={t('hr.leave.col.type')}>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className={inputClass}>
            <option value="annual">{t('hr.payroll.increments.type.annual')}</option>
            <option value="promotion">{t('hr.payroll.increments.type.promotion')}</option>
            <option value="bonus">{t('hr.payroll.increments.type.bonus')}</option>
            <option value="adjustment">{t('hr.payroll.increments.type.adjustment')}</option>
          </select>
        </Field>
        <Field label="Current salary">
          <input value={formatIls(currentSalary)} readOnly className={inputClass} />
        </Field>
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value as any)} className={inputClass}>
            <option value="amount">{t('hr.payroll.increments.mode.amount')}</option>
            <option value="percentage">{t('hr.payroll.increments.mode.percent')}</option>
          </select>
        </Field>
        <Field label="Value" required>
          <input type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="New salary">
          <input value={formatIls(newSalary)} readOnly className={inputClass + ' bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700'} />
        </Field>
        <Field label={t('hr.payroll.increments.effectiveDate')} required>
          <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('hr.leave.col.reason')} className="sm:col-span-2">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
        </Field>
      </div>
    </FormModal>
  );
};

const SettingsTab: React.FC = () => {
  const { t } = useApp();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{t('hr.attendance.settings.lateDeduction')}, {t('hr.attendance.settings.absenceDeduction')} — managed in Attendance → Settings.</p>
    </div>
  );
};
