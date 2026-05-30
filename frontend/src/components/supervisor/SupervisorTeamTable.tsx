import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { User } from '../../types/user';

type Props = {
  employees: User[];
  loading: boolean;
  error: string | null;
  onEdit: (user: User) => void;
  onToggleStatus: (id: string) => void;
  onMessage: (employeeId: string) => void;
  onAssignTask: (employeeId: string) => void;
};

type RoleFilter = 'all' | 'sales' | 'accountant' | 'hr' | 'untyped';

export const SupervisorTeamTable: React.FC<Props> = ({
  employees,
  loading,
  error,
  onEdit,
  onToggleStatus,
  onMessage,
  onAssignTask,
}) => {
  const { t } = useApp();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((emp) => {
      if (q) {
        const hay = `${emp.name} ${emp.email} ${emp.mainJob ?? ''} ${emp.employeeType ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (roleFilter === 'all') return true;
      if (roleFilter === 'untyped') return !emp.employeeType;
      return emp.employeeType === roleFilter;
    });
  }, [employees, search, roleFilter]);

  const counts = useMemo(() => {
    const c = { all: employees.length, sales: 0, accountant: 0, hr: 0, untyped: 0 };
    employees.forEach((e) => {
      if (e.employeeType === 'sales') c.sales++;
      else if (e.employeeType === 'accountant') c.accountant++;
      else if (e.employeeType === 'hr') c.hr++;
      else c.untyped++;
    });
    return c;
  }, [employees]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    );
  }
  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-slate-500 dark:text-slate-400">{t('noEmployeesYetTeam')}</p>
      </div>
    );
  }

  const filterChip = (key: RoleFilter, label: string, count: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setRoleFilter(key)}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        roleFilter === key
          ? 'bg-indigo-600 text-white shadow'
          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {label} <span className="opacity-70">({count})</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
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
            placeholder={t('teamSearchPlaceholder')}
            className="w-full rounded-lg border border-slate-200 bg-white ps-9 pe-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filterChip('all', t('payrollFilterAll'), counts.all)}
          {filterChip('sales', 'sales', counts.sales)}
          {filterChip('accountant', 'accountant', counts.accountant)}
          {filterChip('hr', 'hr', counts.hr)}
          {filterChip('untyped', t('teamFilterUntyped'), counts.untyped)}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                <th className="px-5 py-3">{t('userCol')}</th>
                <th className="px-5 py-3">{t('roleTypeCol')}</th>
                <th className="px-5 py-3">{t('mainJob')}</th>
                <th className="px-5 py-3">{t('statusCol')}</th>
                <th className="px-5 py-3">{t('actionsCol')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t('teamNoMatches')}
                  </td>
                </tr>
              )}
              {filtered.map((emp) => {
                return (
                  <tr
                    key={emp.id}
                    className={`border-b border-slate-100 dark:border-slate-700 ${emp.status === 'suspended' ? 'opacity-75' : ''}`}
                  >
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{emp.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{emp.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                        {t('employee')}
                      </span>
                      {emp.employeeType && (
                        <span className="ml-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {emp.employeeType}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{emp.mainJob || '—'}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          emp.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        }`}
                      >
                        {emp.status === 'active' ? t('statusActive') : t('statusSuspended')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          onClick={() => onMessage(emp.id)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {t('messageEmployee')}
                        </button>
                        <button
                          onClick={() => onAssignTask(emp.id)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {t('assignTask')}
                        </button>
                        <button
                          onClick={() => onEdit(emp)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {t('edit')}
                        </button>
                        <button
                          onClick={() => onToggleStatus(emp.id)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium transition hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                        >
                          {emp.status === 'active' ? t('suspend') : t('activate')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
