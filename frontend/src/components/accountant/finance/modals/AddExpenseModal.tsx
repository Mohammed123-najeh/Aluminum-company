import React, { useEffect, useState } from 'react';
import { useApp } from '../../../../contexts/AppContext';
import { financeCenterApi, type ApiExpense, type ApiExpenseCategory } from '../../../../services/api';

/**
 * Expense entry modal. Doubles as add + edit:
 *  - No `expense` prop → "Add expense": fill category / description / amount /
 *    date / supplier / reference and submit. The expense applies immediately
 *    (status='paid') and shows in the Overview right away.
 *  - With `expense` prop → "Edit expense": fields are prefilled and submit
 *    PATCHes the existing row; the Finance ledger (Overview KPI/net/trend) is
 *    re-synced server-side so edits flow straight through.
 */
export const AddExpenseModal: React.FC<{
  onClose: () => void;
  onSuccess?: () => void;
  expense?: ApiExpense;
}> = ({ onClose, onSuccess, expense }) => {
  const { t, token, lang } = useApp();
  const isEdit = !!expense;
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>(expense?.categoryId ?? '');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [date, setDate] = useState(expense?.date ?? (() => new Date().toISOString().slice(0, 10)));
  const [supplierName, setSupplierName] = useState(expense?.supplierName ?? '');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'check' | 'card'>(
    (expense?.paymentMethod as 'cash' | 'transfer' | 'check' | 'card') ?? 'cash',
  );
  const [referenceNo, setReferenceNo] = useState(expense?.referenceNo ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    financeCenterApi
      .listExpenseCategories(token)
      .then((rows) => {
        setCategories(rows);
        // Default to the first category only when adding (no category chosen yet).
        if (rows.length > 0 && !categoryId) setCategoryId(rows[0].id);
      })
      .catch(() => setCategories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const amountNum = amount.trim() ? Number(amount) : NaN;
  const valid = categoryId && description.trim() && Number.isFinite(amountNum) && amountNum > 0 && date;

  const submit = async () => {
    if (!token || !valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        category_id: categoryId,
        description: description.trim(),
        amount: amountNum,
        date,
        supplier_name: supplierName.trim() || undefined,
        payment_method: paymentMethod,
        reference_no: referenceNo.trim() || undefined,
      };
      if (isEdit && expense) {
        await financeCenterApi.updateExpense(token, expense.id, payload);
      } else {
        await financeCenterApi.createExpense(token, payload);
      }
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('fin.expense.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  const categoryLabel = (c: ApiExpenseCategory) =>
    lang === 'ar' ? c.nameAr ?? c.nameEn ?? '—' : c.nameEn ?? c.nameAr ?? '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => !submitting && onClose()} aria-hidden />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="bg-linear-to-r from-rose-500 to-amber-500 px-5 py-4 text-white">
          <h2 className="text-base font-bold">{t(isEdit ? 'fin.expense.editTitle' : 'fin.expense.modalTitle')}</h2>
          <p className="mt-0.5 text-xs text-white/80">{t(isEdit ? 'fin.expense.editSubtitle' : 'fin.expense.modalSubtitle')}</p>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('fin.expense.categoryLabel')}
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {categories.length === 0 && <option value="">{t('fin.expense.noCategory')}</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('fin.expense.descriptionLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder={t('fin.expense.descriptionPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('fin.expense.amountLabel')}
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="0.00"
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('fin.expense.dateLabel')}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('fin.expense.supplierLabel')}
              </label>
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder={t('fin.expense.supplierPlaceholder')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('fin.expense.methodLabel')}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="cash">{t('fin.method.cash')}</option>
                <option value="transfer">{t('fin.method.transfer')}</option>
                <option value="check">{t('fin.method.check')}</option>
                <option value="card">{t('fin.method.card')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('fin.expense.refLabel')}
            </label>
            <input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder={t('fin.expense.refPlaceholder')}
            />
          </div>
        </div>

        {error && (
          <p className="mx-5 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || submitting}
            className="rounded-lg bg-linear-to-r from-rose-500 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-rose-400 hover:to-amber-400 disabled:opacity-50"
          >
            {submitting ? '…' : t(isEdit ? 'fin.expense.update' : 'fin.expense.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};
