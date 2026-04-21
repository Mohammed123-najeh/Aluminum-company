import React, { useState } from 'react';
import type { User, UpdateUserInput } from '../../types/user';
import { useApp } from '../../contexts/AppContext';

type Props = {
  employee: User;
  onUpdate: (id: string, input: UpdateUserInput) => Promise<void>;
  onClose: () => void;
};

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500';

export const SupervisorEmployeeModal: React.FC<Props> = ({ employee, onUpdate, onClose }) => {
  const { t } = useApp();
  const [name, setName] = useState(employee.name);
  const [email, setEmail] = useState(employee.email);
  const [mainJob, setMainJob] = useState(employee.mainJob ?? '');
  const [status, setStatus] = useState<'active' | 'suspended'>(employee.status);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('fullName') + ' required';
    if (!email.trim()) e.email = t('emailAddress') + ' required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await onUpdate(employee.id, {
        name: name.trim(),
        email: email.trim(),
        mainJob: mainJob.trim() || null,
        status,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('editEmployee')}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('fullName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder={t('namePlaceholder')}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('emailAddress')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder={t('emailPlaceholder')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('mainJob')}</label>
            <input
              type="text"
              value={mainJob}
              onChange={(e) => setMainJob(e.target.value)}
              className={inputCls}
              placeholder={t('mainJobPlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('statusCol')}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium transition ${
                  status === 'active'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                {t('statusActive')}
              </button>
              <button
                type="button"
                onClick={() => setStatus('suspended')}
                className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium transition ${
                  status === 'suspended'
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                    : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                {t('statusSuspended')}
              </button>
            </div>
          </div>
          <div className="flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-70"
            >
              {saving ? (
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                t('saveChanges')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
