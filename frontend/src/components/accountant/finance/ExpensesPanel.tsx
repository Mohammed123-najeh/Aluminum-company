import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { financeCenterApi, type ApiExpense, type ApiExpenseCategory } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, FilterBar, FormModal, Field, inputClass, SectionHeader, StatusBadge, type Column } from '../../shared/dash';

type View = 'list' | 'categories';

export const ExpensesPanel: React.FC = () => {
  const { token, t, lang } = useApp();
  const [view, setView] = useState<View>('list');
  const [rows, setRows] = useState<ApiExpense[]>([]);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try {
      const [list, cats] = await Promise.all([
        financeCenterApi.listExpenses(token, { status, category_id: catFilter }),
        financeCenterApi.listExpenseCategories(token),
      ]);
      setRows(list); setCategories(cats);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [token, status, catFilter]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, action: 'approved' | 'rejected' | 'paid') => {
    if (!token) return;
    const reason = action === 'rejected' ? prompt(t('fin.expenses.rejectionReason') + ':') ?? '' : '';
    try {
      await financeCenterApi.decideExpense(token, id, { status: action, rejection_reason: reason || undefined });
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const cols: Column<ApiExpense>[] = [
    { key: 'date', header: t('fin.revenue.col.date'), render: (r) => r.date ?? '—' },
    { key: 'category', header: t('fin.expenses.col.category'), render: (r) => lang === 'ar' ? r.categoryNameAr : r.categoryNameEn },
    { key: 'description', header: t('fin.expenses.col.description'), render: (r) => r.description },
    { key: 'amount', header: t('fin.revenue.col.amount'), align: 'end', render: (r) => formatIls(Number(r.amount)) },
    { key: 'submitter', header: t('fin.expenses.col.submittedBy'), render: (r) => r.submittedByName ?? '—', hideOnMobile: true },
    {
      key: 'actions', header: t('fin.common.actions'), render: (r) => (
        <span className="flex items-center gap-1">
          <StatusBadge status={r.status} label={t(`fin.expenses.status.${r.status}` as any)} />
          {r.status === 'pending' && (
            <>
              <button onClick={() => void decide(r.id, 'approved')} className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500">{t('fin.expenses.approve')}</button>
              <button onClick={() => void decide(r.id, 'rejected')} className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-rose-500">{t('fin.expenses.reject')}</button>
            </>
          )}
          {r.status === 'approved' && (
            <button onClick={() => void decide(r.id, 'paid')} className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-indigo-500">{t('fin.expenses.markPaid')}</button>
          )}
        </span>
      )
    },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('fin.expenses.title')}
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={() => setView(view === 'list' ? 'categories' : 'list')} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              {view === 'list' ? t('fin.expenses.categories.title') : t('fin.expenses.title')}
            </button>
            {view === 'list' && (
              <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
                + {t('fin.expenses.add')}
              </button>
            )}
          </div>
        }
      />

      {view === 'categories' ? (
        <CategoriesManager categories={categories} onChange={load} />
      ) : (
        <>
          <FilterBar>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-40`}>
              <option value="">{t('fin.common.all')}</option>
              <option value="pending">{t('fin.expenses.status.pending')}</option>
              <option value="approved">{t('fin.expenses.status.approved')}</option>
              <option value="rejected">{t('fin.expenses.status.rejected')}</option>
              <option value="paid">{t('fin.expenses.status.paid')}</option>
            </select>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={`${inputClass} w-48`}>
              <option value="">{t('fin.common.all')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{lang === 'ar' ? c.nameAr : c.nameEn}</option>)}
            </select>
          </FilterBar>

          {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
          <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} />

          <AddExpenseModal open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); void load(); }} categories={categories} />
        </>
      )}
    </div>
  );
};

const AddExpenseModal: React.FC<{ open: boolean; onClose: () => void; onCreated: () => void; categories: ApiExpenseCategory[] }> = ({ open, onClose, onCreated, categories }) => {
  const { token, t, lang } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !categoryId) return;
    setSubmitting(true);
    try {
      await financeCenterApi.createExpense(token, {
        category_id: categoryId,
        description,
        amount: parseFloat(amount),
        date,
        supplier_name: supplierName || undefined,
        payment_method: paymentMethod,
        reference_no: reference || undefined,
      });
      onCreated();
      setDescription(''); setAmount(''); setSupplierName(''); setReference(''); setCategoryId('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal title={t('fin.expenses.add')} open={open} onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel={t('fin.common.save')} cancelLabel={t('fin.common.cancel')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('fin.revenue.col.date')} required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.expenses.col.category')} required>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className={inputClass}>
            <option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{lang === 'ar' ? c.nameAr : c.nameEn}</option>)}
          </select>
        </Field>
        <Field label={t('fin.expenses.col.description')} className="sm:col-span-2" required>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} className={inputClass} />
        </Field>
        <Field label={t('fin.revenue.col.amount')} required>
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.invoices.supplier')}>
          <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('fin.revenue.col.method')}>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
            <option value="cash">Cash / نقدي</option>
            <option value="bank">Bank / تحويل</option>
            <option value="check">Check / شيك</option>
            <option value="card">Card / بطاقة</option>
          </select>
        </Field>
        <Field label={t('fin.revenue.col.ref')}>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </FormModal>
  );
};

const CategoriesManager: React.FC<{ categories: ApiExpenseCategory[]; onChange: () => void }> = ({ categories, onChange }) => {
  const { token, t, lang } = useApp();
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !nameAr || !nameEn) return;
    setSubmitting(true);
    try {
      await financeCenterApi.createExpenseCategory(token, { name_ar: nameAr, name_en: nameEn });
      setNameAr(''); setNameEn('');
      onChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    if (!confirm('Delete category?')) return;
    try {
      await financeCenterApi.deleteExpenseCategory(token, id);
      onChange();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <Field label="Name (Arabic)" required>
          <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="Name (English)" required>
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} required className={inputClass} />
        </Field>
        <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          + {t('fin.expenses.categories.add')}
        </button>
      </form>
      <ul className="space-y-1">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            <span>{lang === 'ar' ? c.nameAr : c.nameEn} <span className="text-xs text-slate-400">({lang === 'ar' ? c.nameEn : c.nameAr})</span></span>
            <button onClick={() => void remove(c.id)} className="text-xs text-rose-600 hover:underline">{t('fin.common.delete')}</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
