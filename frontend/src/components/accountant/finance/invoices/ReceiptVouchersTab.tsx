import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../../contexts/AppContext';
import { financeCenterApi, type ApiCustomerInvoice, type ApiReceiptVoucher } from '../../../../services/api';
import { formatIls } from '../../../../utils/currency';
import { DataTable, FormModal, Field, inputClass, type Column } from '../../../shared/dash';

export const ReceiptVouchersTab: React.FC = () => {
  const { token, t } = useApp();
  const [rows, setRows] = useState<ApiReceiptVoucher[]>([]);
  const [openInvoices, setOpenInvoices] = useState<ApiCustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try {
      const [list, invoices] = await Promise.all([
        financeCenterApi.listReceiptVouchers(token),
        financeCenterApi.listCustomerInvoices(token),
      ]);
      setRows(list);
      setOpenInvoices(invoices.filter((i) => Number(i.balance) > 0));
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const cols: Column<ApiReceiptVoucher>[] = [
    { key: 'number', header: t('fin.invoices.number'), render: (r) => <span className="font-mono text-xs">{r.number}</span> },
    { key: 'date', header: t('fin.invoices.date'), render: (r) => r.date ?? '—' },
    { key: 'from', header: t('fin.receipt.from'), render: (r) => r.clientName ?? '—' },
    { key: 'amount', header: t('fin.receipt.amount'), align: 'end', render: (r) => formatIls(Number(r.amount)) },
    { key: 'method', header: t('fin.receipt.method'), render: (r) => r.method ?? '—', hideOnMobile: true },
    { key: 'ref', header: t('fin.revenue.col.ref'), render: (r) => r.referenceNo ?? '—', hideOnMobile: true },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
          + {t('fin.receipt.create')}
        </button>
      </div>
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} />
      <CreateReceiptModal open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); void load(); }} openInvoices={openInvoices} />
    </div>
  );
};

const CreateReceiptModal: React.FC<{ open: boolean; onClose: () => void; onCreated: () => void; openInvoices: ApiCustomerInvoice[] }> = ({ open, onClose, onCreated, openInvoices }) => {
  const { token, t } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [clientId, setClientId] = useState('');
  const [payerName, setPayerName] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [allocs, setAllocs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const filtered = openInvoices.filter((inv) => !clientId || inv.clientId === clientId);
  const clients = Array.from(new Map(openInvoices.filter((i) => i.clientId).map((i) => [i.clientId!, i.clientName ?? ''])).entries());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !amount) return;
    setSubmitting(true);
    try {
      const allocations = Object.entries(allocs)
        .filter(([, v]) => v && parseFloat(v) > 0)
        .map(([invoice_id, v]) => ({ invoice_id, amount: parseFloat(v) }));
      await financeCenterApi.createReceiptVoucher(token, {
        date, client_id: clientId || undefined, payer_name: payerName || undefined,
        amount: parseFloat(amount), method, reference_no: reference || undefined,
        allocations: allocations.length > 0 ? allocations : undefined,
      });
      onCreated();
      setAmount(''); setPayerName(''); setReference(''); setAllocs({}); setClientId('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal title={t('fin.receipt.create')} open={open} onClose={onClose} onSubmit={submit} submitting={submitting} size="lg" submitLabel={t('fin.common.save')} cancelLabel={t('fin.common.cancel')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('fin.invoices.date')} required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.receipt.from')}>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
            <option value="">—</option>
            {clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </Field>
        <Field label={t('fin.payments.col.payee')} className="sm:col-span-2">
          <input value={payerName} onChange={(e) => setPayerName(e.target.value)} className={inputClass} placeholder="(if not in client list)" />
        </Field>
        <Field label={t('fin.receipt.amount')} required>
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.receipt.method')}>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
            <option value="cash">Cash / نقدي</option>
            <option value="bank">Bank / تحويل</option>
            <option value="check">Check / شيك</option>
            <option value="card">Card / بطاقة</option>
          </select>
        </Field>
        <Field label={t('fin.revenue.col.ref')} className="sm:col-span-2">
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
        </Field>
      </div>

      {filtered.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('fin.receipt.invoices')}</h4>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-2 py-1.5 text-start">{t('fin.invoices.number')}</th>
                  <th className="px-2 py-1.5 text-end">{t('fin.invoices.balance')}</th>
                  <th className="px-2 py-1.5 text-end">{t('fin.invoices.recordPayment')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-2 py-1.5"><span className="font-mono">{inv.number}</span></td>
                    <td className="px-2 py-1.5 text-end tabular-nums text-rose-700">{formatIls(Number(inv.balance))}</td>
                    <td className="px-2 py-1.5 text-end">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={Number(inv.balance)}
                        value={allocs[inv.id] ?? ''}
                        onChange={(e) => setAllocs((p) => ({ ...p, [inv.id]: e.target.value }))}
                        className={`${inputClass} w-24 text-end`}
                        placeholder="0.00"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FormModal>
  );
};
