import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { financeCenterApi, type ApiExpense, type ApiExpenseCategory } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { StatusBadge } from '../../shared/dash';
import { AddExpenseModal } from './modals/AddExpenseModal';

/**
 * Expenses tab — full expense log with category, description, amount, recorder.
 * Matches the screenshot layout: simple table, no clutter. The "Add expense"
 * button opens the shared modal; the same modal is also reachable from the
 * Finance Center header.
 */
export const FinanceExpensesTab: React.FC = () => {
  const { t, token, lang } = useApp();
  const [expenses, setExpenses] = useState<ApiExpense[]>([]);
  const [categories, setCategories] = useState<ApiExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ApiExpense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [exps, cats] = await Promise.all([
        financeCenterApi.listExpenses(token, {}),
        financeCenterApi.listExpenseCategories(token),
      ]);
      // Most recent first.
      exps.sort((a, b) => (a.date && b.date ? b.date.localeCompare(a.date) : 0));
      setExpenses(exps);
      setCategories(cats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!token) return;
      if (!window.confirm(t('fin.expenses.confirmDelete'))) return;
      setDeletingId(id);
      setError(null);
      try {
        await financeCenterApi.deleteExpense(token, id);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : t('fin.expenses.deleteError'));
      } finally {
        setDeletingId(null);
      }
    },
    [token, t, load],
  );

  const categoryLabel = (e: ApiExpense): string => {
    if (lang === 'ar') return e.categoryNameAr ?? e.categoryNameEn ?? '—';
    return e.categoryNameEn ?? e.categoryNameAr ?? '—';
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((e) =>
      [e.description, e.categoryNameAr, e.categoryNameEn, e.supplierName, e.submittedByName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [expenses, search]);

  // Auto-create default categories on first use if none exist — keeps the
  // empty state actionable instead of just showing zeros.
  const ensureDefaultCategories = useCallback(async () => {
    if (!token || categories.length > 0) return;
    const seeds = [
      { name_ar: 'كهرباء', name_en: 'Electricity' },
      { name_ar: 'ماء', name_en: 'Water' },
      { name_ar: 'مواد خام', name_en: 'Raw materials' },
      { name_ar: 'صيانة', name_en: 'Maintenance' },
      { name_ar: 'مواصلات', name_en: 'Transport' },
      { name_ar: 'متفرقات', name_en: 'Miscellaneous' },
    ];
    try {
      for (const s of seeds) await financeCenterApi.createExpenseCategory(token, s);
      const cats = await financeCenterApi.listExpenseCategories(token);
      setCategories(cats);
    } catch {
      /* ignore */
    }
  }, [token, categories.length]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('fin.expenses.logTitle')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('fin.expenses.searchPlaceholder')}
              className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={async () => {
                await ensureDefaultCategories();
                setShowAdd(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-rose-500 to-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-rose-400 hover:to-amber-400"
            >
              + {t('fin.expenses.addNew')}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('fin.common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('fin.expenses.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  <th className="pb-2 text-start">{t('fin.expenses.colDate')}</th>
                  <th className="pb-2 text-start">{t('fin.expenses.colType')}</th>
                  <th className="pb-2 text-start">{t('fin.expenses.colDescription')}</th>
                  <th className="pb-2 text-end">{t('fin.expenses.colAmount')}</th>
                  <th className="pb-2 text-start">{t('fin.expenses.colStatus')}</th>
                  <th className="pb-2 text-start">{t('fin.expenses.colRecordedBy')}</th>
                  <th className="pb-2 text-end">{t('fin.expenses.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((e) => (
                  <tr key={e.id} className="text-slate-700 dark:text-slate-300">
                    <td className="py-3 text-xs text-slate-500">{e.date ?? '—'}</td>
                    <td className="py-3 font-medium text-slate-900 dark:text-slate-100">{categoryLabel(e)}</td>
                    <td className="py-3 max-w-md truncate" title={e.description ?? ''}>{e.description ?? '—'}</td>
                    <td className="py-3 text-end tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                      {formatIls(Number(e.amount))}
                    </td>
                    <td className="py-3"><StatusBadge status={e.status} /></td>
                    <td className="py-3 text-xs text-slate-500">{e.submittedByName ?? '—'}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(e)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {t('fin.common.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(e.id)}
                          disabled={deletingId === e.id}
                          className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        >
                          {deletingId === e.id ? '…' : t('fin.common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddExpenseModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            void load();
          }}
        />
      )}

      {editing && (
        <AddExpenseModal
          expense={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
};
