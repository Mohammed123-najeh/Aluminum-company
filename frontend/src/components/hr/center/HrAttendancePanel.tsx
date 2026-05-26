import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { hrCenterApi, type ApiAttendanceLogRow, type ApiAttendanceMonthly, type ApiEmployee, type ApiPublicHoliday, type ApiWorkScheduleSettings, financeCenterApi } from '../../../services/api';
import { DataTable, Field, inputClass, StatusBadge, type Column } from '../../shared/dash';

type Tab = 'daily' | 'monthly' | 'manual' | 'settings';

export const HrAttendancePanel: React.FC = () => {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>('daily');

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'daily', label: t('hr.attendance.tab.daily') },
    { key: 'monthly', label: t('hr.attendance.tab.monthly') },
    { key: 'manual', label: t('hr.attendance.tab.manual') },
    { key: 'settings', label: t('hr.attendance.tab.settings') },
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

      {tab === 'daily' && <DailyTab />}
      {tab === 'monthly' && <MonthlyTab />}
      {tab === 'manual' && <ManualTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
};

const DailyTab: React.FC = () => {
  const { token, t } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [logs, setLogs] = useState<ApiAttendanceLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await hrCenterApi.attendanceDaily(token, { date });
      setLogs(r.logs);
    } finally {
      setLoading(false);
    }
  }, [token, date]);

  useEffect(() => { void load(); }, [load]);

  const counts = {
    present: logs.filter((l) => l.status === 'present').length,
    late: logs.filter((l) => l.status === 'late').length,
    absent: logs.filter((l) => l.status === 'absent').length,
    leave: logs.filter((l) => l.status === 'leave').length,
    mission: logs.filter((l) => l.status === 'mission').length,
  };

  const justify = async (id: string) => {
    if (!token) return;
    const reason = prompt('Justification reason:');
    if (!reason) return;
    try {
      await hrCenterApi.justifyAttendance(token, id, { justified: true, justification_reason: reason });
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const cols: Column<ApiAttendanceLogRow>[] = [
    { key: 'name', header: t('hr.employees.col.name'), render: (r) => r.userName ?? '—' },
    { key: 'dept', header: t('hr.employees.col.department'), render: (r) => r.department ?? '—', hideOnMobile: true },
    { key: 'in', header: t('hr.attendance.col.clockIn'), render: (r) => r.clockInAt ? new Date(r.clockInAt).toLocaleTimeString() : '—' },
    { key: 'out', header: t('hr.attendance.col.clockOut'), render: (r) => r.clockOutAt ? new Date(r.clockOutAt).toLocaleTimeString() : '—' },
    { key: 'h', header: t('hr.attendance.col.duration'), render: (r) => r.hoursWorked ? `${r.hoursWorked} h` : '—', hideOnMobile: true },
    { key: 'late', header: t('hr.attendance.col.late'), render: (r) => r.lateMinutes || '—', hideOnMobile: true },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: t('fin.common.actions'), render: (r) => (
      !r.justified && (r.status === 'absent' || r.status === 'late')
        ? <button onClick={() => void justify(r.id)} className="text-xs font-semibold text-indigo-600 hover:underline">{t('hr.attendance.justify')}</button>
        : (r.justified ? <span className="text-[10px] text-emerald-600">✓ {t('hr.absence.col.justified')}</span> : null)
    ) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass + ' w-44'} />
        <div className="ms-2 flex flex-wrap gap-2 text-xs">
          <Pill tone="emerald" label={t('hr.attendance.summary.present')} count={counts.present} />
          <Pill tone="amber" label={t('hr.attendance.summary.late')} count={counts.late} />
          <Pill tone="rose" label={t('hr.attendance.summary.absent')} count={counts.absent} />
          <Pill tone="violet" label={t('hr.attendance.summary.leave')} count={counts.leave} />
          <Pill tone="indigo" label={t('hr.attendance.summary.mission')} count={counts.mission} />
        </div>
      </div>
      <DataTable rows={logs} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} />
    </div>
  );
};

const Pill: React.FC<{ tone: 'emerald' | 'amber' | 'rose' | 'violet' | 'indigo'; label: string; count: number }> = ({ tone, label, count }) => {
  const cls: Record<typeof tone, string> = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200',
  };
  return <span className={`rounded-full px-2 py-0.5 font-semibold ${cls[tone]}`}>{label}: {count}</span>;
};

const STATUS_GLYPH: Record<string, string> = {
  present: '✓', late: 'ت', absent: 'غ', leave: 'ج', mission: 'م', holiday: 'ع',
};
const STATUS_CELL_CLASS: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700',
  late: 'bg-amber-100 text-amber-700',
  absent: 'bg-rose-100 text-rose-700',
  leave: 'bg-violet-100 text-violet-700',
  mission: 'bg-indigo-100 text-indigo-700',
  holiday: 'bg-slate-200 text-slate-600',
};

const MonthlyTab: React.FC = () => {
  const { token, t } = useApp();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<ApiAttendanceMonthly | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try { setData(await hrCenterApi.attendanceMonthly(token, { year, month })); }
    finally { setLoading(false); }
  }, [token, year, month]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={inputClass + ' w-24'}>
          {Array.from({ length: 5 }, (_, i) => today.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className={inputClass + ' w-32'}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={() => window.print()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">{t('fin.reports.exportPdf')}</button>
      </div>

      {loading && <p className="text-sm text-slate-500">{t('fin.common.loading')}</p>}
      {data && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-max text-[11px]">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-2 py-2 text-start font-semibold text-slate-600">{t('hr.employees.col.name')}</th>
                {Array.from({ length: data.daysInMonth }, (_, i) => i + 1).map((d) => (
                  <th key={d} className="px-1 py-2 text-center font-semibold text-slate-500">{d}</th>
                ))}
                <th className="px-2 py-2 text-end font-semibold text-emerald-700">P</th>
                <th className="px-2 py-2 text-end font-semibold text-rose-700">A</th>
                <th className="px-2 py-2 text-end font-semibold text-amber-700">L</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={row.userId} className={i % 2 === 1 ? 'bg-slate-50/40 dark:bg-slate-800/20' : ''}>
                  <td className="px-2 py-1 font-medium text-slate-700 dark:text-slate-200">{row.name}</td>
                  {Array.from({ length: data.daysInMonth }, (_, di) => di + 1).map((d) => {
                    const v = row.days[d];
                    return (
                      <td key={d} className="px-0 py-1 text-center">
                        {v ? <span className={`inline-block h-5 w-5 rounded text-center ${STATUS_CELL_CLASS[v] ?? 'bg-slate-100 text-slate-400'}`}>{STATUS_GLYPH[v] ?? '·'}</span> : <span className="text-slate-300">·</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-end font-semibold tabular-nums text-emerald-700">{row.totals.present}</td>
                  <td className="px-2 py-1 text-end font-semibold tabular-nums text-rose-700">{row.totals.absent}</td>
                  <td className="px-2 py-1 text-end font-semibold tabular-nums text-amber-700">{row.totals.late}</td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr><td colSpan={data.daysInMonth + 4} className="p-6 text-center text-slate-400">{t('fin.common.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ManualTab: React.FC = () => {
  const { token, t } = useApp();
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [clockIn, setClockIn] = useState('08:00');
  const [clockOut, setClockOut] = useState('17:00');
  const [status, setStatus] = useState('present');
  const [lateMin, setLateMin] = useState('0');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void hrCenterApi.listEmployees(token).then(setEmployees);
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !userId) return;
    setSubmitting(true); setMsg(null);
    try {
      await hrCenterApi.attendanceManual(token, {
        user_id: userId,
        clock_in_at: `${date}T${clockIn}:00`,
        clock_out_at: status === 'present' || status === 'late' ? `${date}T${clockOut}:00` : undefined,
        status,
        late_minutes: parseInt(lateMin) || 0,
        notes: notes || undefined,
      });
      setMsg('Saved.');
      setNotes('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2">
      <Field label={t('hr.employees.col.name')} required>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} required className={inputClass}>
          <option value="">—</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </Field>
      <Field label={t('fin.invoices.date')} required>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
      </Field>
      <Field label={t('hr.attendance.col.clockIn')}>
        <input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className={inputClass} />
      </Field>
      <Field label={t('hr.attendance.col.clockOut')}>
        <input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className={inputClass} />
      </Field>
      <Field label={t('fin.revenue.col.status')} required>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          <option value="present">{t('hr.attendance.status.present')}</option>
          <option value="late">{t('hr.attendance.status.late')}</option>
          <option value="absent">{t('hr.attendance.status.absent')}</option>
          <option value="leave">{t('hr.attendance.status.leave')}</option>
          <option value="mission">{t('hr.attendance.status.mission')}</option>
          <option value="holiday">{t('hr.attendance.status.holiday')}</option>
        </select>
      </Field>
      <Field label={t('hr.attendance.col.late')}>
        <input type="number" min="0" value={lateMin} onChange={(e) => setLateMin(e.target.value)} className={inputClass} />
      </Field>
      <Field label={t('fin.common.notes')} className="sm:col-span-2">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </Field>
      <div className="sm:col-span-2 flex items-center justify-end gap-2">
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
        <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          {t('fin.common.save')}
        </button>
      </div>
    </form>
  );
};

const SettingsTab: React.FC = () => {
  const { token, t } = useApp();
  const [settings, setSettings] = useState<ApiWorkScheduleSettings | null>(null);
  const [holidays, setHolidays] = useState<ApiPublicHoliday[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: '', nameAr: '', nameEn: '' });

  const load = useCallback(async () => {
    if (!token) return;
    const [s, h] = await Promise.all([
      financeCenterApi.workScheduleSettings(token),
      hrCenterApi.listHolidays(token),
    ]);
    setSettings(s); setHolidays(h);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const saveSettings = async () => {
    if (!token || !settings) return;
    setSavingSettings(true);
    try {
      await financeCenterApi.updateWorkScheduleSettings(token, {
        work_start: settings.workStart + ':00',
        work_end: settings.workEnd + ':00',
        grace_minutes: settings.graceMinutes,
        work_days: settings.workDays,
        late_deduction_per_minute: parseFloat(settings.lateDeductionPerMinute),
        absence_deduction_formula: settings.absenceDeductionFormula,
        vat_rate: parseFloat(settings.vatRate),
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingSettings(false);
    }
  };

  const addHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await hrCenterApi.createHoliday(token, { date: newHoliday.date, name_ar: newHoliday.nameAr, name_en: newHoliday.nameEn });
      setNewHoliday({ date: '', nameAr: '', nameEn: '' });
      void load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const delHoliday = async (id: string) => {
    if (!token) return;
    if (!confirm('Delete?')) return;
    try { await hrCenterApi.deleteHoliday(token, id); void load(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  if (!settings) return <p className="text-sm text-slate-500">{t('fin.common.loading')}</p>;

  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold">{t('hr.attendance.settings.workHours')}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Start">
            <input type="time" value={settings.workStart} onChange={(e) => setSettings({ ...settings, workStart: e.target.value })} className={inputClass} />
          </Field>
          <Field label="End">
            <input type="time" value={settings.workEnd} onChange={(e) => setSettings({ ...settings, workEnd: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t('hr.attendance.settings.grace')}>
            <input type="number" min="0" value={settings.graceMinutes} onChange={(e) => setSettings({ ...settings, graceMinutes: parseInt(e.target.value) || 0 })} className={inputClass} />
          </Field>
        </div>
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500">{t('hr.attendance.settings.workDays')}</p>
          <div className="flex flex-wrap gap-2">
            {dayNames.map((d) => (
              <label key={d} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={settings.workDays.includes(d)}
                  onChange={(e) => setSettings({
                    ...settings,
                    workDays: e.target.checked ? [...settings.workDays, d] : settings.workDays.filter((x) => x !== d),
                  })}
                />
                {d}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label={t('hr.attendance.settings.lateDeduction')}>
            <input type="number" step="0.01" value={settings.lateDeductionPerMinute} onChange={(e) => setSettings({ ...settings, lateDeductionPerMinute: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t('hr.attendance.settings.absenceDeduction')}>
            <select value={settings.absenceDeductionFormula} onChange={(e) => setSettings({ ...settings, absenceDeductionFormula: e.target.value })} className={inputClass}>
              <option value="daily">Daily</option>
              <option value="none">None</option>
            </select>
          </Field>
          <Field label="VAT rate %">
            <input type="number" step="0.01" value={settings.vatRate} onChange={(e) => setSettings({ ...settings, vatRate: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={saveSettings} disabled={savingSettings} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{t('fin.common.save')}</button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold">{t('hr.attendance.settings.holidays')}</h3>
        <form onSubmit={addHoliday} className="mb-3 grid gap-2 sm:grid-cols-4 sm:items-end">
          <Field label={t('fin.invoices.date')}>
            <input type="date" required value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Name (Arabic)">
            <input required value={newHoliday.nameAr} onChange={(e) => setNewHoliday({ ...newHoliday, nameAr: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Name (English)">
            <input required value={newHoliday.nameEn} onChange={(e) => setNewHoliday({ ...newHoliday, nameEn: e.target.value })} className={inputClass} />
          </Field>
          <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">+ Add</button>
        </form>
        <ul className="space-y-1">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
              <span><span className="font-mono">{h.date}</span> — {h.nameAr} / {h.nameEn}</span>
              <button onClick={() => void delHoliday(h.id)} className="text-xs text-rose-600 hover:underline">{t('fin.common.delete')}</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
