import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../../contexts/AppContext';
import { financeCenterApi, type ApiCustomerInvoice } from '../../../../services/api';
import { formatIls } from '../../../../utils/currency';

/**
 * Header action — "Issue receipt voucher". Creates a formal receipt voucher
 * recording money received from a customer. Optionally allocates the receipt
 * to one or more outstanding customer invoices (which marks those invoices
 * paid/partial). A revenue finance_transaction is auto-emitted on the server.
 */
export const IssueReceiptModal: React.FC<{
  onClose: () => void;
  onSuccess?: () => void;
}> = ({ onClose, onSuccess }) => {
  const { t, token } = useApp();
  const [invoices, setInvoices] = useState<ApiCustomerInvoice[]>([]);
  const [payerName, setPayerName] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'transfer' | 'check' | 'card'>('cash');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  // Map invoice id → amount to allocate from this receipt.
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    financeCenterApi
      .listCustomerInvoices(token, { status: 'unpaid' })
      .then(setInvoices)
      .catch(() => setInvoices([]));
    // Also pull partials — server filter only supports one value, so do a second call.
    financeCenterApi
      .listCustomerInvoices(token, { status: 'partial' })
      .then((more) => setInvoices((prev) => [...prev, ...more]))
      .catch(() => {});
  }, [token]);

  const amountNum = amount.trim() ? Number(amount) : NaN;
  const allocatedTotal = useMemo(
    () => Object.values(allocations).reduce((sum, v) => sum + (v.trim() ? Number(v) || 0 : 0), 0),
    [allocations],
  );
  const overAllocated = Number.isFinite(amountNum) && allocatedTotal > amountNum + 0.009;
  const valid = Number.isFinite(amountNum) && amountNum > 0 && date && !overAllocated;

  const submit = async () => {
    if (!token || !valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const allocs = Object.entries(allocations)
        .map(([invoiceId, amt]) => ({ invoice_id: invoiceId, amount: Number(amt) }))
        .filter((a) => Number.isFinite(a.amount) && a.amount > 0);
      await financeCenterApi.createReceiptVoucher(token, {
        date,
        payer_name: payerName.trim() || undefined,
        amount: amountNum,
        method,
        reference_no: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations: allocs,
      });
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('fin.issue.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => !submitting && onClose()} aria-hidden />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="bg-linear-to-r from-emerald-600 to-teal-500 px-5 py-4 text-white">
          <h2 className="text-base font-bold">{t('fin.issue.modalTitle')}</h2>
          <p className="mt-0.5 text-xs text-white/85">{t('fin.issue.modalSubtitle')}</p>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('fin.issue.payerLabel')}
              </label>
              <input
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder={t('fin.issue.payerPlaceholder')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('fin.issue.dateLabel')}
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
                {t('fin.issue.amountLabel')}
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
                {t('fin.issue.methodLabel')}
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
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
              {t('fin.issue.refLabel')}
            </label>
            <input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder={t('fin.issue.refPlaceholder')}
            />
          </div>

          {invoices.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('fin.issue.allocationsLabel')}
                </p>
                <p className={`text-[11px] font-semibold tabular-nums ${overAllocated ? 'text-rose-600' : 'text-slate-500'}`}>
                  {formatIls(allocatedTotal)} / {Number.isFinite(amountNum) ? formatIls(amountNum) : '—'}
                </p>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <ul className="divide-y divide-slate-100 text-xs dark:divide-slate-700">
                  {invoices.map((inv) => (
                    <li key={inv.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-mono text-slate-500">{inv.number}</span>{' '}
                        <span className="text-slate-700 dark:text-slate-300">{inv.clientName ?? '—'}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-rose-600 dark:text-rose-300">
                        {formatIls(Number(inv.balance))}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        max={Number(inv.balance)}
                        value={allocations[inv.id] ?? ''}
                        onChange={(e) =>
                          setAllocations((prev) => ({ ...prev, [inv.id]: e.target.value }))
                        }
                        className="w-24 rounded border border-slate-200 px-2 py-1 text-xs tabular-nums dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        placeholder="0.00"
                        dir="ltr"
                      />
                    </li>
                  ))}
                </ul>
              </div>
              {overAllocated && (
                <p className="mt-1 text-[11px] text-rose-600">{t('fin.issue.overAllocateError')}</p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('fin.issue.notesLabel')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
            className="rounded-lg bg-linear-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50"
          >
            {submitting ? '…' : t('fin.issue.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};
