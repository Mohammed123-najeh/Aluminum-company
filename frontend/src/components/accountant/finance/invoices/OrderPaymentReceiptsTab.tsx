import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../../contexts/AppContext';
import { financeCenterApi, type ApiOrderPaymentReceipt } from '../../../../services/api';
import { formatIls } from '../../../../utils/currency';
import { DataTable, type Column } from '../../../shared/dash';
import { OrderPaymentReceiptModal } from './OrderPaymentReceiptModal';

/**
 * "إيصالات دفعات الطلبات" — every customer order payment Finance has
 * recorded, presented as a printable receipt. Backed by /finance/order-
 * payment-receipts (one row per OrderPayment).
 */
export const OrderPaymentReceiptsTab: React.FC = () => {
  const { t, token } = useApp();
  const [rows, setRows] = useState<ApiOrderPaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ApiOrderPaymentReceipt | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      setRows(await financeCenterApi.listOrderPaymentReceipts(token));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.number, r.orderRef, r.clientName, r.method, r.referenceNo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  const methodLabel = (m: string | null) => {
    switch (m) {
      case 'cash': return t('fin.method.cash');
      case 'transfer': return t('fin.method.transfer');
      case 'check': return t('fin.method.check');
      case 'card': return t('fin.method.card');
      default: return '—';
    }
  };

  const cols: Column<ApiOrderPaymentReceipt>[] = [
    { key: 'number', header: t('fin.invoices.number'), render: (r) => <span className="font-mono text-xs font-semibold">{r.number}</span> },
    { key: 'date', header: t('fin.invoices.date'), render: (r) => r.date ?? '—' },
    { key: 'customer', header: t('fin.receipt.customer'), render: (r) => r.clientName ?? '—' },
    { key: 'order', header: t('fin.receipt.orderRef'), render: (r) => <span className="font-mono text-xs">{r.orderRef ?? '—'}</span>, hideOnMobile: true },
    { key: 'amount', header: t('fin.receipt.amount'), align: 'end', render: (r) => <span className="tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">{formatIls(r.amount)}</span> },
    { key: 'method', header: t('fin.record.methodLabel'), render: (r) => methodLabel(r.method), hideOnMobile: true },
    {
      key: 'actions',
      header: t('fin.orders.colActions'),
      align: 'end',
      render: (r) => (
        <button
          type="button"
          onClick={() => setSelected(r)}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {t('fin.receipt.viewPrint')}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('fin.orderReceipts.subtitle')}</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('fin.payments.searchPlaceholder')}
          className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <DataTable rows={filtered} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} />
      {selected && (
        <OrderPaymentReceiptModal receipt={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};
