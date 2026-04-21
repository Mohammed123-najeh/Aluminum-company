import React from 'react';
import type { User } from '../../types/user';
import { useApp } from '../../contexts/AppContext';

type Props = { users: User[] };

type CardProps = {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor: string;
};

const StatCard: React.FC<CardProps> = ({ label, value, sub, icon, iconBg, valueColor }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${valueColor}`}>{value}</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{sub}</p>
      </div>
      <div className={`rounded-xl p-2.5 ${iconBg}`}>{icon}</div>
    </div>
  </div>
);

export const StatsCards: React.FC<Props> = ({ users }) => {
  const { t } = useApp();
  const nonAdmin = users.filter((u) => u.role !== 'admin');
  const total = nonAdmin.length;
  const active = nonAdmin.filter((u) => u.status === 'active').length;
  const suspended = nonAdmin.filter((u) => u.status === 'suspended').length;
  const supervisors = users.filter((u) => u.role === 'supervisor').length;
  const employees = users.filter((u) => u.role === 'employee').length;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label={t('totalAccounts')} value={total} sub={`${suspended} ${t('statusSuspended').toLowerCase()}`}
        valueColor="text-slate-800 dark:text-slate-100" iconBg="bg-slate-100 dark:bg-slate-700"
        icon={<svg className="h-5 w-5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
      />
      <StatCard label={t('active')} value={active} sub={t('currentlyActive')}
        valueColor="text-emerald-600 dark:text-emerald-400" iconBg="bg-emerald-50 dark:bg-emerald-900/30"
        icon={<svg className="h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      />
      <StatCard label={t('supervisors')} value={supervisors} sub={t('teamLeads')}
        valueColor="text-indigo-600 dark:text-indigo-400" iconBg="bg-indigo-50 dark:bg-indigo-900/30"
        icon={<svg className="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2.25 2.25 4.5-4.5m5.25 3a8.25 8.25 0 11-16.5 0 8.25 8.25 0 0116.5 0z" /></svg>}
      />
      <StatCard label={t('employees')} value={employees} sub={t('allDepartments')}
        valueColor="text-orange-600 dark:text-orange-400" iconBg="bg-orange-50 dark:bg-orange-900/30"
        icon={<svg className="h-5 w-5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>}
      />
    </div>
  );
};
