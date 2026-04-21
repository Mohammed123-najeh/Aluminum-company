import React, { useState } from 'react';
import type { User, EmployeeType } from '../../types/user';
import { useApp } from '../../contexts/AppContext';

type Props = {
  users: User[];
  onAssign: (employeeId: string, supervisorId: string | null) => void;
  onEdit: (user: User) => void;
};

const COLORS = ['bg-blue-500','bg-sky-500','bg-indigo-500','bg-violet-500','bg-orange-500','bg-amber-500','bg-emerald-500','bg-teal-500','bg-rose-500','bg-pink-500'];
const avatarColor = (id: string) => COLORS[id.split('').reduce((a,c)=>a+c.charCodeAt(0),0) % COLORS.length];
const initials = (name: string) => name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

function formatShort(iso: string|null|undefined, never: string) {
  if (!iso) return never;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' ' + d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
}

const TYPE_BADGE: Record<EmployeeType, string> = {
  accountant: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  sales: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  hr: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

type Col = { id: string|null; supervisor: User|null; employees: User[] };

const SupCard: React.FC<{user:User}> = ({user}) => (
  <div className={`flex items-center gap-3 rounded-xl border-2 bg-white p-3 shadow-sm dark:bg-slate-800 ${user.status==='suspended'?'border-red-200 opacity-75 dark:border-red-800':'border-indigo-200 dark:border-indigo-800'}`}>
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(user.id)} ${user.status==='suspended'?'opacity-60':''}`}>
      {initials(user.name)}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Supervisor</span>
        {user.mainJob && <span className="text-[10px] text-slate-500 dark:text-slate-400">· {user.mainJob}</span>}
        {user.status==='suspended' && <span className="rounded-full bg-red-100 px-1.5 py-px text-[9px] font-semibold text-red-600 dark:bg-red-900/40 dark:text-red-400">Suspended</span>}
      </div>
    </div>
  </div>
);

const EmpCard: React.FC<{user:User; onDragStart:(e:React.DragEvent,id:string)=>void; onEdit:(u:User)=>void; never:string}> = ({user,onDragStart,onEdit,never}) => (
  <div draggable onDragStart={e=>onDragStart(e,user.id)}
    className={`group flex cursor-grab items-center gap-2.5 rounded-lg border bg-white p-2.5 shadow-sm transition hover:shadow-md active:cursor-grabbing active:opacity-60 dark:bg-slate-800 ${user.status==='suspended'?'border-red-200 opacity-80 dark:border-red-800':'border-slate-200 hover:border-indigo-300 dark:border-slate-700 dark:hover:border-indigo-700'}`}>
    <div className="shrink-0 text-slate-300 group-hover:text-slate-400 dark:text-slate-600">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm8-12a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>
    </div>
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(user.id)} ${user.status==='suspended'?'opacity-60':''}`}>
      {initials(user.name)}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
      <div className="flex flex-wrap items-center gap-1 mt-0.5">
        {user.employeeType && <span className={`inline-flex rounded-full px-1.5 py-px text-[9px] font-semibold capitalize ${TYPE_BADGE[user.employeeType]}`}>{user.employeeType}</span>}
        {user.status==='suspended' && <span className="inline-flex rounded-full bg-red-100 px-1.5 py-px text-[9px] font-semibold text-red-600 dark:bg-red-900/40 dark:text-red-400">suspended</span>}
      </div>
      <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">Last: {formatShort(user.lastLogin, never)}</p>
    </div>
    <button onClick={()=>onEdit(user)} className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition hover:text-indigo-500 group-hover:opacity-100 dark:text-slate-600 dark:hover:text-indigo-400">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
    </button>
  </div>
);

export const OrgChart: React.FC<Props> = ({ users, onAssign, onEdit }) => {
  const { t } = useApp();
  const [dragOverId, setDragOverId] = useState<string|'unassigned'|null>(null);
  const [dragging, setDragging] = useState<string|null>(null);

  const supervisors = users.filter(u=>u.role==='supervisor');
  const employees = users.filter(u=>u.role==='employee');

  const columns: Col[] = [
    ...supervisors.map(s=>({id:s.id, supervisor:s, employees: employees.filter(e=>e.supervisorId===s.id)})),
    {id:null, supervisor:null, employees: employees.filter(e=>!e.supervisorId)},
  ];

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(id);
  };
  const onDragOver = (e: React.DragEvent, colId: string|null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(colId ?? 'unassigned');
  };
  const onDrop = (e: React.DragEvent, supervisorId: string|null) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) onAssign(id, supervisorId);
    setDragOverId(null);
    setDragging(null);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('organizationChart')}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('dragHelp')}</p>
        </div>
        {dragging && (
          <div className="animate-pulse rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
            {t('dropToAssign')}
          </div>
        )}
      </div>

      <div className="flex gap-5 overflow-x-auto pb-4">
        {columns.map(col => {
          const colKey = col.id ?? 'unassigned';
          const isOver = dragOverId === colKey;
          return (
            <div key={colKey} className="flex w-64 shrink-0 flex-col gap-3">
              {col.supervisor ? (
                <SupCard user={col.supervisor} />
              ) : (
                <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-lg text-slate-400 dark:bg-slate-700">?</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('unassigned')}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{t('noSupervisor')}</p>
                  </div>
                </div>
              )}
              {col.supervisor && <div className="mx-auto h-4 w-0.5 bg-gradient-to-b from-indigo-300 to-slate-200 dark:from-indigo-800 dark:to-slate-700"/>}
              <div
                onDragOver={e=>onDragOver(e,col.id)}
                onDrop={e=>onDrop(e,col.id)}
                onDragLeave={()=>setDragOverId(null)}
                className={`min-h-[80px] flex-1 rounded-xl border-2 p-2 transition-all duration-150 ${isOver?'border-indigo-400 bg-indigo-50 shadow-inner shadow-indigo-100 dark:border-indigo-600 dark:bg-indigo-950/30':'border-dashed border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50'}`}
              >
                {isOver && <div className="mb-2 flex items-center justify-center rounded-lg border border-indigo-300 bg-indigo-100/70 py-2 text-xs font-medium text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">{t('dropHere')}</div>}
                <div className="space-y-2">
                  {col.employees.map(emp=>(
                    <EmpCard key={emp.id} user={emp} onDragStart={onDragStart} onEdit={onEdit} never={t('never')}/>
                  ))}
                </div>
                {col.employees.length===0 && !isOver && (
                  <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-600">
                    {col.supervisor ? t('noEmployeesYet') : t('noUnassigned')}
                  </p>
                )}
                <p className="mt-2 text-center text-[10px] text-slate-300 dark:text-slate-600">
                  {col.employees.length} {col.employees.length===1?'employee':'employees'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
