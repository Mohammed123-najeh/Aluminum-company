import React, { useState, useEffect } from 'react';
import type { User, CreateUserInput, UpdateUserInput, EmployeeType } from '../../types/user';
import { useApp } from '../../contexts/AppContext';

type Props = {
  users: User[];
  editUser: User | null;
  onCreate: (input: CreateUserInput) => void;
  onUpdate: (input: UpdateUserInput) => void;
  onClose: () => void;
};

const EMP_TYPES: { value: EmployeeType; key: 'accountant'|'sales'|'hr' }[] = [
  { value: 'accountant', key: 'accountant' },
  { value: 'sales', key: 'sales' },
  { value: 'hr', key: 'hr' },
];

const inputCls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500';

const Field: React.FC<{label:string;required?:boolean;error?:string;children:React.ReactNode}> = ({label,required,error,children}) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
      {label}{required && <span className="ms-0.5 text-red-500">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

export const UserModal: React.FC<Props> = ({ users, editUser, onCreate, onUpdate, onClose }) => {
  const { t } = useApp();
  const isEdit = Boolean(editUser);

  const [name, setName] = useState(editUser?.name ?? '');
  const [email, setEmail] = useState(editUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<'supervisor'|'employee'>(
    editUser && editUser.role !== 'admin' ? editUser.role : 'employee',
  );
  const [empType, setEmpType] = useState<EmployeeType>(editUser?.employeeType ?? 'accountant');
  const [mainJob, setMainJob] = useState(editUser?.mainJob ?? '');
  const [supId, setSupId] = useState(editUser?.supervisorId ?? '');
  const [baseSal, setBaseSal] = useState(editUser?.baseSalary != null ? String(editUser.baseSalary) : '');
  const [annualLeave, setAnnualLeave] = useState(
    editUser?.annualLeaveBalance != null ? String(editUser.annualLeaveBalance) : '',
  );
  const [errors, setErrors] = useState<Record<string,string>>({});

  const supervisors = users.filter(u=>u.role==='supervisor' && u.id!==editUser?.id);

  useEffect(() => {
    if (role === 'supervisor') setSupId('');
  }, [role]);

  useEffect(() => {
    setBaseSal(editUser?.baseSalary != null ? String(editUser.baseSalary) : '');
    setAnnualLeave(editUser?.annualLeaveBalance != null ? String(editUser.annualLeaveBalance) : '');
  }, [editUser]);

  const validate = () => {
    const e: Record<string,string> = {};
    if (!name.trim()) e.name = t('fullName') + ' required';
    if (!email.trim()) e.email = t('emailAddress') + ' required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email';
    if (users.some(u=>u.email.toLowerCase()===email.toLowerCase()&&u.id!==editUser?.id)) e.email = 'Email already in use';
    if (!isEdit && !password) e.password = t('minPassword');
    if (!isEdit && password && password.length<8) e.password = t('minPassword');
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const comp =
      role === 'employee'
        ? {
            baseSalary: baseSal.trim() === '' ? null : Number(baseSal),
            annualLeaveBalance: annualLeave.trim() === '' ? null : Number(annualLeave),
          }
        : {};

    if (isEdit) {
      onUpdate({
        name: name.trim(),
        email: email.trim(),
        role,
        employeeType: role === 'employee' ? empType : undefined,
        mainJob: role === 'supervisor' ? (mainJob.trim() || null) : undefined,
        supervisorId: role === 'employee' ? (supId || null) : null,
        ...comp,
      });
    } else {
      onCreate({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        employeeType: role === 'employee' ? empType : undefined,
        mainJob: role === 'supervisor' ? (mainJob.trim() || null) : undefined,
        supervisorId: role === 'employee' ? (supId || null) : null,
        ...comp,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          className="relative flex w-full max-w-lg max-h-[min(90vh,calc(100dvh-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
          <div className="min-w-0 pe-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {isEdit ? t('editAccount') : t('createAccount')}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {isEdit ? `${t('editingLabel')} ${editUser?.name}` : t('addNewUser')}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition dark:hover:bg-slate-700 dark:hover:text-slate-200">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4">
          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3">
            {(['supervisor','employee'] as const).map(r => (
              <button key={r} type="button" onClick={()=>setRole(r)}
                className={`rounded-xl border-2 px-4 py-3 text-start transition ${role===r?(r==='supervisor'?'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50':'border-orange-500 bg-orange-50 dark:bg-orange-950/50'):'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'}`}>
                <p className={`text-sm font-semibold capitalize ${role===r?(r==='supervisor'?'text-indigo-700 dark:text-indigo-300':'text-orange-700 dark:text-orange-300'):'text-slate-600 dark:text-slate-400'}`}>{t(r)}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{r==='supervisor'?t('managesTeam'):t('reportsToSupervisor')}</p>
              </button>
            ))}
          </div>

          <Field label={t('fullName')} required error={errors.name}>
            <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder={t('namePlaceholder')} className={inputCls}/>
          </Field>

          <Field label={t('emailAddress')} required error={errors.email}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={t('emailPlaceholder')} className={inputCls}/>
          </Field>

          {!isEdit && (
            <Field label={t('password')} required error={errors.password}>
              <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition dark:border-slate-600 dark:bg-slate-700">
                <input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={t('minPassword')}
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none dark:text-slate-100"/>
                <button type="button" onClick={()=>setShowPw(p=>!p)} className="px-3 text-xs font-medium text-slate-400 hover:text-slate-700 transition dark:hover:text-slate-200">
                  {showPw?'Hide':'Show'}
                </button>
              </div>
            </Field>
          )}

          {role === 'supervisor' && (
            <Field label={t('mainJob')}>
              <input
                type="text"
                value={mainJob}
                onChange={e => setMainJob(e.target.value)}
                placeholder={t('mainJobPlaceholder')}
                className={inputCls}
              />
            </Field>
          )}

          {role==='employee' && (
            <>
              <Field label={t('departmentType')} required>
                <div className="grid grid-cols-3 gap-2">
                  {EMP_TYPES.map(et => (
                    <button key={et.value} type="button" onClick={()=>setEmpType(et.value)}
                      className={`rounded-lg border py-2 text-xs font-semibold transition ${empType===et.value?'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300':'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'}`}>
                      {t(et.key)}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('assignToSupervisor')}>
                <select value={supId} onChange={e=>setSupId(e.target.value)} className={inputCls}>
                  <option value="">{t('unassignedOption')}</option>
                  {supervisors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label={t('adminColBaseSalary')}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={baseSal}
                  onChange={(e) => setBaseSal(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
              <Field label={t('adminColAnnualLeave')}>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={annualLeave}
                  onChange={(e) => setAnnualLeave(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('userModalSalaryHint')}</p>
            </>
          )}

          </div>
          <div className="flex shrink-0 gap-3 border-t border-slate-100 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
              {t('cancel')}
            </button>
            <button type="submit" className="flex-1 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-blue-500">
              {isEdit ? t('saveChanges') : t('createAccount')}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};
