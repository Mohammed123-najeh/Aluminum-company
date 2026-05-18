import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import {
  attendanceApi,
  usersApi,
  type ApiAttendanceLog,
  type ApiPayrollRow,
  type ApiUser,
} from '../../services/api';
import { formatIls } from '../../utils/currency';

function formatHours(totalHours: number): string {
  const h = Math.floor(totalHours);
  const m = Math.round((totalHours - h) * 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

type RoleFilter = 'all' | 'supervisor' | 'employee' | 'accountant' | 'hr' | 'sales';

function matchesRole(row: ApiPayrollRow, f: RoleFilter): boolean {
  if (f === 'all') return true;
  if (f === 'supervisor') return row.role === 'supervisor';
  if (f === 'employee') return row.role === 'employee' && (!row.employeeType || row.employeeType === '' );
  if (f === 'accountant' || f === 'hr' || f === 'sales') {
    return row.role === 'employee' && row.employeeType === f;
  }
  return true;
}

export const AdminPayrollPanel: React.FC = () => {
  const { t, token } = useApp();
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(todayIso());
  const [rows, setRows] = useState<ApiPayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // Per-row editing buffer for salary / hourly rate
  const [editId, setEditId] = useState<string | null>(null);
  const [editBaseSalary, setEditBaseSalary] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Per-user log drawer
  const [drawerUser, setDrawerUser] = useState<ApiPayrollRow | null>(null);
  const [drawerLogs, setDrawerLogs] = useState<ApiAttendanceLog[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const summary = await attendanceApi.summary(token, { from, to });
      setRows(summary.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payroll');
    } finally {
      setLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => matchesRole(r, roleFilter))
      .filter((r) => (q ? r.userName.toLowerCase().includes(q) : true));
  }, [rows, search, roleFilter]);

  const totals = useMemo(() => {
    const totalHours = filtered.reduce((acc, r) => acc + r.totalHours, 0);
    const totalEarnings = filtered.reduce((acc, r) => acc + (r.computedEarnings ?? 0), 0);
    const monthlySalaryTotal = filtered.reduce((acc, r) => acc + (r.baseSalary ?? 0), 0);
    return {
      totalHours,
      totalEarnings,
      monthlySalaryTotal,
      headcount: filtered.length,
    };
  }, [filtered]);

  const beginEdit = (row: ApiPayrollRow) => {
    setEditId(row.userId);
    setEditBaseSalary(row.baseSalary != null ? String(row.baseSalary) : '');
    setEditHourlyRate(row.hourlyRate != null ? String(row.hourlyRate) : '');
    setSavedMsg(null);
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveEdit = async (row: ApiPayrollRow) => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const payload: { base_salary?: number | null; hourly_rate?: number | null } = {};
      if (editBaseSalary.trim() === '') {
        payload.base_salary = null;
      } else {
        const n = Number(editBaseSalary);
        if (!Number.isFinite(n) || n < 0) throw new Error('Invalid salary');
        payload.base_salary = n;
      }
      if (editHourlyRate.trim() === '') {
        payload.hourly_rate = null;
      } else {
        const n = Number(editHourlyRate);
        if (!Number.isFinite(n) || n < 0) throw new Error('Invalid hourly rate');
        payload.hourly_rate = n;
      }
      const updated: ApiUser = await usersApi.update(row.userId, payload, token);
      setRows((prev) =>
        prev.map((r) =>
          r.userId === row.userId
            ? {
                ...r,
                baseSalary: updated.baseSalary != null ? Number(updated.baseSalary) : null,
                hourlyRate: updated.hourlyRate != null ? Number(updated.hourlyRate) : null,
                computedEarnings:
                  updated.hourlyRate != null ? Number(updated.hourlyRate) * r.totalHours : null,
              }
            : r,
        ),
      );
      setEditId(null);
      setSavedMsg(`${row.userName} ${t('saveChanges')} ✓`);
      window.setTimeout(() => setSavedMsg(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const openDrawer = async (row: ApiPayrollRow) => {
    if (!token) return;
    setDrawerUser(row);
    setDrawerLogs([]);
    setDrawerLoading(true);
    try {
      const logs = await attendanceApi.list(token, { userId: row.userId, from, to });
      setDrawerLogs(logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance');
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerUser(null);
    setDrawerLogs([]);
  };

  const roleBadgeColor = (row: ApiPayrollRow): string => {
    if (row.role === 'supervisor') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    if (row.employeeType === 'hr') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
    if (row.employeeType === 'accountant') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    if (row.employeeType === 'sales') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
  };

  const roleLabel = (row: ApiPayrollRow): string => {
    if (row.role === 'supervisor') return t('supervisorRole');
    if (row.employeeType) return row.employeeType;
    return t('employeeRole');
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}
      {savedMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {savedMsg}
        </div>
      )}

      {/* Toolbar */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('payrollSearchPlaceholder')}
              className="w-full rounded-lg border border-slate-200 bg-white ps-9 pe-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="all">{t('payrollFilterAll')}</option>
            <option value="supervisor">{t('supervisorRole')}</option>
            <option value="employee">{t('employeeRole')}</option>
            <option value="accountant">accountant</option>
            <option value="hr">hr</option>
            <option value="sales">sales</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">{t('payrollFrom')}</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">{t('payrollTo')}</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-linear-to-br from-indigo-50 to-white p-4 shadow-sm dark:border-slate-700 dark:from-indigo-950/30 dark:to-slate-800/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">{t('payrollHeadcount')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-900 dark:text-indigo-100">{totals.headcount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-linear-to-br from-emerald-50 to-white p-4 shadow-sm dark:border-slate-700 dark:from-emerald-950/30 dark:to-slate-800/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{t('payrollTotalHours')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">{formatHours(totals.totalHours)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-linear-to-br from-amber-50 to-white p-4 shadow-sm dark:border-slate-700 dark:from-amber-950/30 dark:to-slate-800/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">{t('payrollHourlyEarnings')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900 dark:text-amber-100">{formatIls(totals.totalEarnings)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-linear-to-br from-slate-50 to-white p-4 shadow-sm dark:border-slate-700 dark:from-slate-700/30 dark:to-slate-800/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('payrollMonthlySalaries')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatIls(totals.monthlySalaryTotal)}</p>
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-500">{t('loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t('payrollColEmployee')}</th>
                  <th className="px-4 py-3">{t('payrollColRole')}</th>
                  <th className="px-4 py-3 text-right">{t('payrollColBaseSalary')}</th>
                  <th className="px-4 py-3 text-right">{t('payrollColHourlyRate')}</th>
                  <th className="px-4 py-3 text-right">{t('payrollColHours')}</th>
                  <th className="px-4 py-3 text-right">{t('payrollColEarned')}</th>
                  <th className="px-4 py-3">{t('payrollColLastSeen')}</th>
                  <th className="px-4 py-3 text-right">{t('actionsCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t('payrollEmpty')}
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{row.userName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {row.sessionsCount} {t('payrollSessions')}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${roleBadgeColor(row)}`}>
                        {roleLabel(row)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editId === row.userId ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editBaseSalary}
                          onChange={(e) => setEditBaseSalary(e.target.value)}
                          className="w-28 rounded border border-slate-200 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        />
                      ) : (
                        <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {row.baseSalary != null ? formatIls(row.baseSalary) : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editId === row.userId ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editHourlyRate}
                          onChange={(e) => setEditHourlyRate(e.target.value)}
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        />
                      ) : (
                        <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {row.hourlyRate != null ? `${formatIls(row.hourlyRate)} / h` : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatHours(row.totalHours)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
                      {row.computedEarnings != null ? formatIls(row.computedEarnings) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {row.lastClockInAt ? new Date(row.lastClockInAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editId === row.userId ? (
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => void saveEdit(row)}
                            disabled={saving}
                            className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {t('saveChanges')}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => beginEdit(row)}
                            className="rounded-md border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                          >
                            {t('payrollEditPay')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void openDrawer(row)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            {t('payrollViewLogs')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Drawer with attendance logs */}
      {drawerUser && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-slate-900/40 backdrop-blur-sm" onClick={closeDrawer}>
          <div
            className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{drawerUser.userName}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatHours(drawerUser.totalHours)} ·{' '}
                  {drawerUser.computedEarnings != null ? formatIls(drawerUser.computedEarnings) : '—'} ·{' '}
                  {drawerUser.sessionsCount} {t('payrollSessions')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              {drawerLoading ? (
                <p className="text-sm text-slate-500">{t('loading')}</p>
              ) : drawerLogs.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('payrollNoSessions')}</p>
              ) : (
                <ol className="relative space-y-3 border-l-2 border-indigo-200 pl-4 dark:border-indigo-900/60">
                  {drawerLogs.map((log) => (
                    <li key={log.id} className="relative">
                      <span className="absolute -left-[1.4rem] top-1.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-950" />
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {log.clockInAt ? new Date(log.clockInAt).toLocaleString() : '—'}{' '}
                        <span className="text-slate-400">→</span>{' '}
                        {log.clockOutAt ? new Date(log.clockOutAt).toLocaleString() : <em className="text-amber-600 dark:text-amber-400">{t('payrollStillOpen')}</em>}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {log.hoursWorked != null ? formatHours(log.hoursWorked) : '—'}
                        {log.ipAddress ? ` · ${log.ipAddress}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
