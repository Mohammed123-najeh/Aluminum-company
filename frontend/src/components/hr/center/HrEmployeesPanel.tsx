import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { hrCenterApi, type ApiEmployee } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, FilterBar, FormModal, Field, inputClass, SectionHeader, StatusBadge, type Column } from '../../shared/dash';
import { HrEmployeeProfile } from './HrEmployeeProfile';

export const HrEmployeesPanel: React.FC = () => {
  const { token, t } = useApp();
  const [view, setView] = useState<'grid' | 'table'>('table');
  const [rows, setRows] = useState<ApiEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try { setRows(await hrCenterApi.listEmployees(token, { status, q })); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [token, status, q]);

  useEffect(() => { void load(); }, [load]);

  if (activeId) {
    return <HrEmployeeProfile userId={activeId} onBack={() => setActiveId(null)} />;
  }

  const initials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const cols: Column<ApiEmployee>[] = [
    { key: 'avatar', header: '', width: '40px', render: (r) => (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 text-[10px] font-bold text-white">
        {initials(r.name)}
      </div>
    ) },
    { key: 'name', header: t('hr.employees.col.name'), render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'empNumber', header: t('hr.employees.col.empNumber'), render: (r) => r.employeeNumber ?? '—', hideOnMobile: true },
    { key: 'dept', header: t('hr.employees.col.department'), render: (r) => r.department ?? r.employeeType ?? '—' },
    { key: 'role', header: t('hr.employees.col.role'), render: (r) => r.mainJob ?? '—', hideOnMobile: true },
    { key: 'phone', header: t('hr.employees.col.phone'), render: (r) => r.phone ?? '—', hideOnMobile: true },
    { key: 'salary', header: t('hr.employees.col.baseSalary'), align: 'end', render: (r) => r.baseSalary ? formatIls(Number(r.baseSalary)) : '—' },
    { key: 'status', header: t('hr.employees.col.status'), render: (r) => <StatusBadge status={r.status} label={t(`hr.employees.status.${r.status}` as any)} /> },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('hr.employees.title')}
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
              <button onClick={() => setView('grid')} className={`rounded px-2 py-1 ${view === 'grid' ? 'bg-indigo-600 text-white' : ''}`}>{t('hr.employees.viewGrid')}</button>
              <button onClick={() => setView('table')} className={`rounded px-2 py-1 ${view === 'table' ? 'bg-indigo-600 text-white' : ''}`}>{t('hr.employees.viewTable')}</button>
            </div>
            <button onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
              + {t('hr.employees.add')}
            </button>
          </div>
        }
      />

      <FilterBar search={q} onSearchChange={setQ}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-32`}>
          <option value="">{t('fin.common.all')}</option>
          <option value="active">{t('hr.employees.status.active')}</option>
          <option value="suspended">{t('hr.employees.status.suspended')}</option>
        </select>
      </FilterBar>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 text-sm font-bold text-white">
                  {initials(r.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.mainJob ?? '—'}</p>
                </div>
                <StatusBadge status={r.status} label={t(`hr.employees.status.${r.status}` as any)} />
              </div>
              <div className="mt-3 grid gap-1 text-xs text-slate-500">
                <p>{t('hr.employees.col.department')}: <span className="font-medium text-slate-700 dark:text-slate-200">{r.department ?? r.employeeType ?? '—'}</span></p>
                <p>{t('hr.employees.col.phone')}: <span className="font-medium text-slate-700 dark:text-slate-200">{r.phone ?? '—'}</span></p>
                <p>{t('hr.employees.col.hireDate')}: <span className="font-medium text-slate-700 dark:text-slate-200">{r.hireDate ?? '—'}</span></p>
              </div>
            </button>
          ))}
          {rows.length === 0 && !loading && <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">{t('fin.common.empty')}</p>}
        </div>
      ) : (
        <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} onRowClick={(r) => setActiveId(r.id)} />
      )}

      <AddEmployeeModal open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); void load(); }} />
    </div>
  );
};

const AddEmployeeModal: React.FC<{ open: boolean; onClose: () => void; onCreated: () => void }> = ({ open, onClose, onCreated }) => {
  const { token, t } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'employee' | 'supervisor'>('employee');
  const [department, setDepartment] = useState('');
  const [mainJob, setMainJob] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [phone, setPhone] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await hrCenterApi.createEmployee(token, {
        name, email, password, role,
        department: department || undefined,
        main_job: mainJob || undefined,
        base_salary: baseSalary ? parseFloat(baseSalary) : undefined,
        phone: phone || undefined,
        hire_date: hireDate || undefined,
      });
      onCreated();
      setName(''); setEmail(''); setPassword(''); setDepartment(''); setMainJob(''); setBaseSalary(''); setPhone(''); setHireDate('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal title={t('hr.employees.add')} open={open} onClose={onClose} onSubmit={submit} submitting={submitting} size="lg" submitLabel={t('fin.common.save')} cancelLabel={t('fin.common.cancel')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('hr.employees.col.name')} required>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="Email" required>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="Password" required>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={inputClass} />
        </Field>
        <Field label={t('hr.employees.col.role')}>
          <select value={role} onChange={(e) => setRole(e.target.value as any)} className={inputClass}>
            <option value="employee">Employee</option>
            <option value="supervisor">Supervisor</option>
          </select>
        </Field>
        <Field label={t('hr.employees.col.department')}>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Job title">
          <input value={mainJob} onChange={(e) => setMainJob(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('hr.employees.col.baseSalary')}>
          <input type="number" step="0.01" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('hr.employees.col.phone')}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('hr.employees.col.hireDate')}>
          <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </FormModal>
  );
};
