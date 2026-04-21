import React from 'react';
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

function formatShort(iso: string | null | undefined, never: string) {
  if (!iso) return never;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

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

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
              <th className="px-5 py-3">{t('userCol')}</th>
              <th className="px-5 py-3">{t('roleTypeCol')}</th>
              <th className="px-5 py-3">{t('mainJob')}</th>
              <th className="px-5 py-3">{t('statusCol')}</th>
              <th className="px-5 py-3">{t('lastLoginCol')}</th>
              <th className="px-5 py-3">{t('actionsCol')}</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
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
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs">
                  {formatShort(emp.lastLogin ?? null, t('never'))}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
