import React, { useMemo, useState } from 'react';
import type { User } from '../../types/user';
import { useApp } from '../../contexts/AppContext';
import { formatIls } from '../../utils/currency';

type Props = {
  users: User[];
  onEdit: (user: User) => void;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
};

type ConfirmState = { userId: string; action: 'delete'|'suspend'|'activate' } | null;
type RoleFilter = 'all'|'supervisor'|'employee'|'accountant'|'sales'|'hr';
type StatusFilter = 'all'|'active'|'suspended';

const COLORS = ['bg-blue-500','bg-sky-500','bg-indigo-500','bg-violet-500','bg-orange-500','bg-amber-500','bg-emerald-500','bg-teal-500','bg-rose-500','bg-pink-500'];
const avatarColor = (id: string) => COLORS[id.split('').reduce((a,c)=>a+c.charCodeAt(0),0) % COLORS.length];
const initials = (name: string) => name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

const roleBadge: Record<string,string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  supervisor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  employee: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};
const typeBadge: Record<string,string> = {
  accountant: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  sales: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  hr: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

const Missing: React.FC = () => <span className="text-slate-300 dark:text-slate-600">-</span>;

function formatLogin(iso: string | null | undefined, never: string) {
  if (!iso) return never;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return never;
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + ' - ' + d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatHireYear(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : String(d.getFullYear());
}

function formatHourlyRate(rate: string | null | undefined) {
  if (rate == null || rate === '') return null;
  const n = Number(rate);
  return Number.isFinite(n) ? `${formatIls(n)} / h` : null;
}

function profileDepartment(user: User) {
  return user.department ?? user.employeeType ?? null;
}

function matchesRole(user: User, filter: RoleFilter) {
  if (filter === 'all') return true;
  if (filter === 'supervisor') return user.role === 'supervisor';
  if (filter === 'employee') return user.role === 'employee';
  return user.role === 'employee' && user.employeeType === filter;
}

const ConfirmDialog: React.FC<{state:ConfirmState; users:User[]; onConfirm:()=>void; onCancel:()=>void}> = ({state,users,onConfirm,onCancel}) => {
  const { t } = useApp();
  if (!state) return null;
  const user = users.find(u=>u.id===state.userId);
  const isDel = state.action==='delete';
  const titleKey = isDel ? 'deleteAccount' : state.action==='suspend' ? 'suspendAccount' : 'activateAccount';
  const msgKey = isDel ? 'deleteConfirmMsg' : state.action==='suspend' ? 'suspendConfirmMsg' : 'activateConfirmMsg';
  const name = user?.name ?? '';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl mx-4 dark:bg-slate-800">
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${isDel?'bg-red-100 dark:bg-red-900/40':'bg-amber-100 dark:bg-amber-900/40'}`}>
          {isDel ? (
            <svg className="h-6 w-6 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
          ) : (
            <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
          )}
        </div>
        <h3 className="text-center text-base font-semibold text-slate-900 dark:text-slate-100">{t(titleKey)}</h3>
        <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">{t(msgKey).replace('this user', name || 'this user')}</p>
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
            {t('cancel')}
          </button>
          <button onClick={onConfirm} className={`flex-1 rounded-lg py-2 text-sm font-medium text-white transition ${isDel?'bg-red-600 hover:bg-red-700':'bg-amber-500 hover:bg-amber-600'}`}>
            {t(isDel?'delete':state.action==='suspend'?'suspend':'activate')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const UserTable: React.FC<Props> = ({ users, onEdit, onToggleStatus, onDelete }) => {
  const { t } = useApp();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const nonAdminUsers = useMemo(() => users.filter((u) => u.role !== 'admin'), [users]);
  const supervisorMap = useMemo(
    () => Object.fromEntries(users.filter(u=>u.role==='supervisor').map(u=>[u.id,u.name])),
    [users],
  );
  const departments = useMemo(
    () => Array.from(new Set(nonAdminUsers.map(profileDepartment).filter(Boolean) as string[])).sort(),
    [nonAdminUsers],
  );

  const summary = useMemo(() => ({
    total: nonAdminUsers.length,
    supervisors: nonAdminUsers.filter((u) => u.role === 'supervisor').length,
    employees: nonAdminUsers.filter((u) => u.role === 'employee').length,
    withPhone: nonAdminUsers.filter((u) => Boolean(u.phone)).length,
    withRate: nonAdminUsers.filter((u) => Boolean(u.hourlyRate)).length,
  }), [nonAdminUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return nonAdminUsers.filter(u => {
      const department = profileDepartment(u);
      const supervisorName = u.supervisorId ? supervisorMap[u.supervisorId] : null;
      const hay = [
        u.name,
        u.email,
        u.phone,
        u.employeeNumber,
        u.mainJob,
        u.department,
        u.employeeType,
        u.contractType,
        u.nationality,
        supervisorName,
      ].filter(Boolean).join(' ').toLowerCase();

      if (q && !hay.includes(q)) return false;
      if (!matchesRole(u, roleFilter)) return false;
      if (departmentFilter !== 'all' && department !== departmentFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      return true;
    });
  }, [departmentFilter, nonAdminUsers, roleFilter, search, statusFilter, supervisorMap]);

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {summary.total} {t('users')}
            </span>
            <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300">
              {summary.supervisors} {t('supervisorFilter')}
            </span>
            <span className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 font-medium text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300">
              {summary.employees} {t('employeeFilter')}
            </span>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              {summary.withRate} {t('payrollColHourlyRate')}
            </span>
            <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {summary.withPhone} {t('hr.employees.col.phone')}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto_auto_auto_auto]">
            <div className="relative">
              <svg className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('teamSearchPlaceholder')}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 ps-9 pe-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"/>
            </div>
            <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value as RoleFilter)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
              <option value="all">{t('allRoles')}</option>
              <option value="supervisor">{t('supervisorFilter')}</option>
              <option value="employee">{t('employeeFilter')}</option>
              <option value="accountant">{t('accountant')}</option>
              <option value="sales">{t('sales')}</option>
              <option value="hr">{t('hr')}</option>
            </select>
            <select value={departmentFilter} onChange={e=>setDepartmentFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
              <option value="all">{t('allDepartments')}</option>
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
              <option value="all">{t('allStatus')}</option>
              <option value="active">{t('activeFilter')}</option>
              <option value="suspended">{t('suspendedFilter')}</option>
            </select>
            <span className="self-center whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">{filtered.length} {filtered.length===1 ? 'result' : 'results'}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-start text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                <th className="px-5 py-3">{t('adminColContact')}</th>
                <th className="px-5 py-3">{t('adminColWorkProfile')}</th>
                <th className="px-5 py-3">{t('reportsToCol')}</th>
                <th className="px-5 py-3 text-center">{t('adminColHireYear')}</th>
                <th className="px-5 py-3 text-right">{t('payrollColHourlyRate')}</th>
                <th className="px-5 py-3">{t('statusCol')}</th>
                <th className="px-5 py-3">{t('lastLoginCol')}</th>
                <th className="px-5 py-3">{t('actionsCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">{t('noUsersFound')}</td></tr>
              ) : filtered.map((user) => {
                const department = profileDepartment(user);
                const workLine = [department, user.contractType].filter(Boolean).join(' - ');
                const hireYear = formatHireYear(user.hireDate);
                const hireDate = formatDate(user.hireDate);
                const supervisorName = user.supervisorId ? supervisorMap[user.supervisorId] : null;

                return (
                  <tr key={user.id} className="group hover:bg-slate-50 transition-colors dark:hover:bg-slate-700/40">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(user.id)} ${user.status==='suspended'?'opacity-50':''}`}>
                          {initials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
                          <p className="truncate text-xs text-slate-400 dark:text-slate-500">{user.email}</p>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{user.phone || `${t('hr.employees.col.phone')}: -`}</span>
                            {user.employeeNumber && <span>{t('adminColEmployeeNo')}: {user.employeeNumber}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${roleBadge[user.role]}`}>{t(user.role as 'admin'|'supervisor'|'employee')}</span>
                          {user.employeeType && <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${typeBadge[user.employeeType]}`}>{t(user.employeeType as 'accountant'|'sales'|'hr')}</span>}
                        </div>
                        <p className="truncate text-[11px] text-slate-600 dark:text-slate-300" title={user.mainJob ?? user.department ?? undefined}>
                          {user.mainJob ?? user.department ?? <Missing />}
                        </p>
                        <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                          {workLine || <Missing />}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-400">
                      {supervisorName ?? <Missing />}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {hireYear ?? <Missing />}
                      </div>
                      {hireDate && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          {hireDate}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                      {formatHourlyRate(user.hourlyRate) ?? <Missing />}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${user.status==='active'?'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400':'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${user.status==='active'?'bg-emerald-500':'bg-red-500'}`}/>
                        {t(user.status==='active'?'statusActive':'statusSuspended')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatLogin(user.lastLogin, t('never'))}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={()=>onEdit(user)} title={t('edit')} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
                        </button>
                        <button onClick={()=>setConfirm({userId:user.id,action:user.status==='active'?'suspend':'activate'})} title={t(user.status==='active'?'suspend':'activate')}
                          className={`rounded-lg p-1.5 transition ${user.status==='active'?'text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400':'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400'}`}>
                          {user.status==='active' ? (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                          ) : (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          )}
                        </button>
                        <button onClick={()=>setConfirm({userId:user.id,action:'delete'})} title={t('delete')} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition dark:hover:bg-red-900/30 dark:hover:text-red-400">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
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
      <ConfirmDialog state={confirm} users={users} onConfirm={()=>{if(confirm){confirm.action==='delete'?onDelete(confirm.userId):onToggleStatus(confirm.userId);setConfirm(null);}}} onCancel={()=>setConfirm(null)}/>
    </>
  );
};
