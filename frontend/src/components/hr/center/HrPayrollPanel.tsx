import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { attendanceApi, hrCenterApi, type ApiPayrollRow, type ApiSalaryIncrement, type ApiEmployee } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, FormModal, Field, inputClass, KpiCard, type Column } from '../../shared/dash';

type Preset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Preset): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preset === 'today') return { from: isoDate(today), to: isoDate(today) };
  if (preset === 'yesterday') {
    const y = new Date(today); y.setDate(today.getDate() - 1);
    return { from: isoDate(y), to: isoDate(y) };
  }
  if (preset === 'this_week') {
    const start = new Date(today); start.setDate(today.getDate() - today.getDay());
    return { from: isoDate(start), to: isoDate(today) };
  }
  if (preset === 'this_month') {
    const start = new Date(today); start.setDate(1);
    return { from: isoDate(start), to: isoDate(today) };
  }
  return { from: isoDate(today), to: isoDate(today) };
}

function formatHours(h: number): string {
  const whole = Math.floor(h);
  const m = Math.round((h - whole) * 60);
  return `${whole}h ${m.toString().padStart(2, '0')}m`;
}

export const HrPayrollPanel: React.FC = () => {
  const { t, token } = useApp();

  const initial = rangeForPreset('this_month');
  const [preset, setPreset] = useState<Preset>('this_month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ApiPayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      const r = rangeForPreset(p);
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try {
      const s = await attendanceApi.summary(token, { from, to });
      setRows(s.rows.filter((r) => r.role !== 'admin'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load salaries');
    } finally {
      setLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.userName} ${r.employeeType ?? ''} ${r.role}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const totals = useMemo(() => {
    const totalHours = filtered.reduce((s, r) => s + r.totalHours, 0);
    const totalEarnings = filtered.reduce((s, r) => s + (r.computedEarnings ?? 0), 0);
    const headcount = filtered.length;
    const ratedCount = filtered.filter((r) => r.hourlyRate != null && r.hourlyRate > 0).length;
    const avgRate = (() => {
      const rates = filtered.map((r) => r.hourlyRate ?? 0).filter((x) => x > 0);
      return rates.length ? rates.reduce((s, x) => s + x, 0) / rates.length : 0;
    })();
    return { totalHours, totalEarnings, headcount, ratedCount, avgRate };
  }, [filtered]);

  const positionLabel = (r: ApiPayrollRow): string => {
    if (r.role === 'supervisor') return t('supervisor');
    if (r.employeeType === 'hr') return t('hr');
    if (r.employeeType === 'accountant') return t('accountant');
    if (r.employeeType === 'sales') return t('sales');
    return t('employeeRole');
  };

  const cols: Column<ApiPayrollRow>[] = [
    {
      key: 'employee',
      header: t('payrollColEmployee'),
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">{r.userName}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{positionLabel(r)}</p>
        </div>
      ),
    },
    {
      key: 'rate',
      header: t('payrollColHourlyRate'),
      align: 'end',
      render: (r) =>
        r.hourlyRate != null && r.hourlyRate > 0
          ? <span className="font-mono tabular-nums">{formatIls(r.hourlyRate)} / h</span>
          : <span className="text-xs text-rose-600 dark:text-rose-300">{t('salariesNoRate')}</span>,
    },
    {
      key: 'sessions',
      header: t('payrollSessions'),
      align: 'end',
      hideOnMobile: true,
      render: (r) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{r.sessionsCount}</span>,
    },
    {
      key: 'hours',
      header: t('payrollColHours'),
      align: 'end',
      render: (r) => <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">{formatHours(r.totalHours)}</span>,
    },
    {
      key: 'earned',
      header: t('payrollColEarned'),
      align: 'end',
      render: (r) =>
        r.computedEarnings != null
          ? <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">{formatIls(r.computedEarnings)}</span>
          : <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: 'lastSeen',
      header: t('payrollColLastSeen'),
      hideOnMobile: true,
      render: (r) => r.lastClockInAt ? new Date(r.lastClockInAt).toLocaleString() : '—',
    },
  ];

  const presetChip = (p: Preset, label: string) => (
    <button
      key={p}
      type="button"
      onClick={() => applyPreset(p)}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        preset === p
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          {presetChip('today', t('salariesPresetToday'))}
          {presetChip('yesterday', t('salariesPresetYesterday'))}
          {presetChip('this_week', t('salariesPresetThisWeek'))}
          {presetChip('this_month', t('salariesPresetThisMonth'))}
          {presetChip('custom', t('salariesPresetCustom'))}
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Field label={t('payrollFrom')}>
              <input
                type="date"
                value={from}
                onChange={(e) => { setPreset('custom'); setFrom(e.target.value); }}
                max={to}
                className={`${inputClass} w-40`}
              />
            </Field>
            <Field label={t('payrollTo')}>
              <input
                type="date"
                value={to}
                onChange={(e) => { setPreset('custom'); setTo(e.target.value); }}
                min={from}
                className={`${inputClass} w-40`}
              />
            </Field>
          </div>
        </div>
        <div className="mt-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('salariesSearchPlaceholder')}
            className={`${inputClass} w-full max-w-md`}
          />
        </div>
      </section>

      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {err}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t('payrollHeadcount')} value={totals.headcount} tone="accent" />
        <KpiCard label={t('payrollTotalHours')} value={formatHours(totals.totalHours)} tone="neutral" />
        <KpiCard label={t('payrollHourlyEarnings')} value={formatIls(totals.totalEarnings)} tone="positive" />
        <KpiCard
          label={t('payrollAvgHourlyRate')}
          value={`${formatIls(totals.avgRate)} / h`}
          tone="warning"
          hint={`${totals.ratedCount}/${totals.headcount}`}
        />
      </div>

      <DataTable
        rows={filtered}
        columns={cols}
        rowKey={(r) => r.userId}
        loading={loading}
        empty={t('payrollEmpty')}
      />
    </div>
  );
};

export const IncrementsTab: React.FC = () => {
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
  const currentSalary = selected?.hourlyRate ? Number(selected.hourlyRate) : 0;
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
