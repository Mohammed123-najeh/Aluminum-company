import React, { useEffect, useMemo, useState } from 'react';
import type { User } from '../../types/user';
import { useApp } from '../../contexts/AppContext';
import { hrCenterApi, type ApiHrDashboard } from '../../services/api';
import { formatIls } from '../../utils/currency';

type Props = { users: User[] };

type Trend = { delta: number; positive: boolean } | null;

type TileProps = {
  label: string;
  value: string;
  unit?: string;
  trend?: Trend;
  icon: React.ReactNode;
  /** Pastel background for the icon square. */
  iconBg: string;
  /** Foreground icon color. */
  iconFg: string;
};

const Tile: React.FC<TileProps> = ({ label, value, unit, trend, icon, iconBg, iconFg }) => (
  <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
    {/* top row: trend (start) + icon (end) */}
    <div className="flex items-start justify-between gap-3">
      {trend ? (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            trend.positive
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {trend.positive ? '+' : '−'}
          {Math.abs(trend.delta)}%
        </span>
      ) : (
        <span aria-hidden className="h-5" />
      )}
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg} ${iconFg}`}>
        {icon}
      </div>
    </div>

    {/* label + value */}
    <p className="mt-6 text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 flex items-baseline gap-2 text-3xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
      {value}
      {unit && (
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{unit}</span>
      )}
    </p>
  </div>
);

// SVG icons matching the screenshot's tone (lucide-ish, stroke 1.8)
const Icons = {
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  userCheck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 11l2 2 4-4" />
    </svg>
  ),
  userX: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l5 5M22 8l-5 5" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01" />
    </svg>
  ),
  hours: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
};

export const StatsCards: React.FC<Props> = ({ users }) => {
  const { t, token } = useApp();
  const [hr, setHr] = useState<ApiHrDashboard | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    hrCenterApi
      .dashboard(token)
      .then((d) => { if (!cancelled) setHr(d); })
      .catch(() => { if (!cancelled) setHr(null); });
    return () => { cancelled = true; };
  }, [token]);

  // ── User totals (always available) ───────────────────────────────────
  const userTotals = useMemo(() => {
    const nonAdmin = users.filter((u) => u.role !== 'admin');
    const supervisors = nonAdmin.filter((u) => u.role === 'supervisor').length;
    const employees = nonAdmin.filter((u) => u.role === 'employee').length;
    // "+ N new this month" from createdAt — small trend chip on the total tile.
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const newThisMonth = nonAdmin.filter((u) => {
      const ts = u.createdAt ? new Date(u.createdAt).getTime() : 0;
      return ts > monthAgo;
    }).length;
    return { total: nonAdmin.length, supervisors, employees, newThisMonth };
  }, [users]);

  // ── HR data with safe fallbacks ──────────────────────────────────────
  const k = hr?.kpi;
  const presentToday = k?.presentToday ?? 0;
  const absentToday = k?.absentToday ?? 0;
  const lateToday = k?.lateToday ?? 0;
  const pendingLeave = k?.pendingLeaveRequests ?? 0;
  const workHoursToday = k?.workHoursToday ?? 0;
  const dailyPayroll = k?.dailyPayroll ?? 0;
  const monthlyPayroll = k?.monthlyPayroll ?? 0;

  // Present/Absent percentage chip (positive when most people are present).
  const totalEmp = userTotals.total || 1;
  const presentPct = Math.round((presentToday / totalEmp) * 100);
  const absentPct = Math.round((absentToday / totalEmp) * 100);

  const empUnit = t('hr.kpi.unit.employee');
  const hourUnit = t('hr.kpi.unit.hour');
  const reqUnit = t('hr.kpi.unit.request');
  const ilsUnit = t('currencyIls');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        label={t('hr.dashboard.kpi.total')}
        value={String(userTotals.total)}
        unit={empUnit}
        trend={userTotals.newThisMonth > 0 ? { delta: userTotals.newThisMonth, positive: true } : null}
        icon={Icons.users}
        iconBg="bg-indigo-50 dark:bg-indigo-950/40"
        iconFg="text-indigo-600 dark:text-indigo-300"
      />
      <Tile
        label={t('hr.dashboard.kpi.present')}
        value={String(presentToday)}
        unit={empUnit}
        trend={presentPct > 0 ? { delta: presentPct, positive: true } : null}
        icon={Icons.userCheck}
        iconBg="bg-emerald-50 dark:bg-emerald-950/40"
        iconFg="text-emerald-600 dark:text-emerald-300"
      />
      <Tile
        label={t('hr.dashboard.kpi.absent')}
        value={String(absentToday)}
        unit={empUnit}
        trend={absentToday > 0 ? { delta: absentPct, positive: false } : null}
        icon={Icons.userX}
        iconBg="bg-rose-50 dark:bg-rose-950/40"
        iconFg="text-rose-600 dark:text-rose-300"
      />
      <Tile
        label={t('hr.dashboard.kpi.late')}
        value={String(lateToday)}
        unit={empUnit}
        trend={null}
        icon={Icons.alert}
        iconBg="bg-amber-50 dark:bg-amber-950/40"
        iconFg="text-amber-600 dark:text-amber-300"
      />
      <Tile
        label={t('hr.dashboard.kpi.workHoursToday')}
        value={String(workHoursToday)}
        unit={hourUnit}
        trend={null}
        icon={Icons.hours}
        iconBg="bg-blue-50 dark:bg-blue-950/40"
        iconFg="text-blue-600 dark:text-blue-300"
      />
      <Tile
        label={t('hr.dashboard.kpi.dailyPayroll')}
        value={formatIls(dailyPayroll).replace(/[^\d.,-]/g, '').trim()}
        unit={ilsUnit}
        trend={null}
        icon={Icons.money}
        iconBg="bg-emerald-50 dark:bg-emerald-950/40"
        iconFg="text-emerald-600 dark:text-emerald-300"
      />
      <Tile
        label={t('hr.dashboard.kpi.monthlyPayroll')}
        value={formatIls(monthlyPayroll).replace(/[^\d.,-]/g, '').trim()}
        unit={ilsUnit}
        trend={null}
        icon={Icons.money}
        iconBg="bg-violet-50 dark:bg-violet-950/40"
        iconFg="text-violet-600 dark:text-violet-300"
      />
      <Tile
        label={t('hr.dashboard.kpi.pendingLeaveRequests')}
        value={String(pendingLeave)}
        unit={reqUnit}
        trend={null}
        icon={Icons.calendar}
        iconBg="bg-orange-50 dark:bg-orange-950/40"
        iconFg="text-orange-600 dark:text-orange-300"
      />
    </div>
  );
};
