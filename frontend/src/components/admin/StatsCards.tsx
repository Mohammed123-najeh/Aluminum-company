import React, { useEffect, useMemo, useState } from 'react';
import type { User } from '../../types/user';
import { useApp } from '../../contexts/AppContext';
import { hrCenterApi, type ApiHrDashboard, adminAnalyticsApi, type ApiAdminAnalytics } from '../../services/api';

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
  orders: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 11H6L5 9z" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  alertClock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <circle cx="12" cy="13" r="8" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M9 2h6" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  ),
};

export const StatsCards: React.FC<Props> = ({ users }) => {
  const { t, token } = useApp();
  const [hr, setHr] = useState<ApiHrDashboard | null>(null);
  const [adminA, setAdminA] = useState<ApiAdminAnalytics | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    hrCenterApi
      .dashboard(token)
      .then((d) => { if (!cancelled) setHr(d); })
      .catch(() => { if (!cancelled) setHr(null); });
    adminAnalyticsApi
      .get(token)
      .then((d) => { if (!cancelled) setAdminA(d); })
      .catch(() => { if (!cancelled) setAdminA(null); });
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

  // Present/Absent percentage chip (positive when most people are present).
  const totalEmp = userTotals.total || 1;
  const presentPct = Math.round((presentToday / totalEmp) * 100);
  const absentPct = Math.round((absentToday / totalEmp) * 100);

  // ── Operational pulse (from /admin/analytics) ────────────────────────
  const orderStatuses = adminA?.orders.byStatus ?? {};
  const activeOrders = (orderStatuses.submitted ?? 0) + (orderStatuses.in_progress ?? 0);
  const taskStatuses = adminA?.tasks.byStatus;
  const openTasks = (taskStatuses?.pending ?? 0) + (taskStatuses?.in_progress ?? 0);
  const overdueTasks = adminA?.tasks.overdue ?? 0;
  const inventoryUnits = adminA?.storehouse.totalQuantityUnits ?? 0;
  const totalTasks = adminA?.tasks.total ?? 0;
  const overduePct = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  const empUnit = t('hr.kpi.unit.employee');
  const orderUnit = t('hr.kpi.unit.order');
  const taskUnit = t('hr.kpi.unit.task');
  const unitUnit = t('hr.kpi.unit.unit');

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
        label={t('admin.kpi.activeOrders')}
        value={String(activeOrders)}
        unit={orderUnit}
        trend={null}
        icon={Icons.orders}
        iconBg="bg-blue-50 dark:bg-blue-950/40"
        iconFg="text-blue-600 dark:text-blue-300"
      />
      <Tile
        label={t('admin.kpi.openTasks')}
        value={String(openTasks)}
        unit={taskUnit}
        trend={null}
        icon={Icons.list}
        iconBg="bg-sky-50 dark:bg-sky-950/40"
        iconFg="text-sky-600 dark:text-sky-300"
      />
      <Tile
        label={t('admin.kpi.overdueTasks')}
        value={String(overdueTasks)}
        unit={taskUnit}
        trend={overdueTasks > 0 ? { delta: overduePct, positive: false } : null}
        icon={Icons.alertClock}
        iconBg="bg-rose-50 dark:bg-rose-950/40"
        iconFg="text-rose-600 dark:text-rose-300"
      />
      <Tile
        label={t('admin.kpi.inventoryUnits')}
        value={inventoryUnits.toLocaleString()}
        unit={unitUnit}
        trend={null}
        icon={Icons.box}
        iconBg="bg-violet-50 dark:bg-violet-950/40"
        iconFg="text-violet-600 dark:text-violet-300"
      />
    </div>
  );
};
