import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../../contexts/AppContext';
import { financeCenterApi, type ApiPaymentVoucher, type ApiSupplier, type ApiSupplierInvoice } from '../../../../services/api';
import { formatIls } from '../../../../utils/currency';
import { DataTable, FormModal, Field, inputClass, type Column } from '../../../shared/dash';

export const PaymentVouchersTab: React.FC = () => {
  const { token, t } = useApp();
  const [rows, setRows] = useState<ApiPaymentVoucher[]>([]);
  const [openSupplierInvoices, setOpenSupplierInvoices] = useState<ApiSupplierInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try {
      const [list, inv, sup] = await Promise.all([
        financeCenterApi.listPaymentVouchers(token),
        financeCenterApi.listSupplierInvoices(token, { status: 'approved' }),
        financeCenterApi.listSuppliers(token),
      ]);
      setRows(list);
      setOpenSupplierInvoices(inv.filter((i) => Number(i.balance) > 0));
      setSuppliers(sup);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const cols: Column<ApiPaymentVoucher>[] = [
    { key: 'number', header: t('fin.invoices.number'), render: (r) => <span className="font-mono text-xs">{r.number}</span> },
    { key: 'date', header: t('fin.invoices.date'), render: (r) => r.date ?? '—' },
    { key: 'payee', header: t('fin.payment.payee'), render: (r) => r.payeeName ?? '—' },
    { key: 'amount', header: t('fin.revenue.col.amount'), align: 'end', render: (r) => formatIls(Number(r.amount)) },
    { key: 'purpose', header: t('fin.payment.purpose'), render: (r) => r.purpose ?? '—', hideOnMobile: true },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
          + {t('fin.payment.create')}
        </button>
      </div>
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} />
      <CreatePaymentModal open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); void load(); }} openSupplierInvoices={openSupplierInvoices} suppliers={suppliers} />
    </div>
  );
};

const CreatePaymentModal: React.FC<{
  open: boolean; onClose: () => void; onCreated: () => void;
  openSupplierInvoices: ApiSupplierInvoice[]; suppliers: ApiSupplier[];
}> = ({ open, onClose, onCreated, openSupplierInvoices, suppliers }) => {
  const { token, t } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [payeeType, setPayeeType] = useState<'supplier' | 'employee' | 'other'>('supplier');
  const [payeeId, setPayeeId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [purpose, setPurpose] = useState('');
  const [allocs, setAllocs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const filtered = openSupplierInvoices.filter((inv) => payeeType !== 'supplier' || !payeeId || inv.supplierId === payeeId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !amount) return;
    setSubmitting(true);
    try {
      const allocations = Object.entries(allocs)
        .filter(([, v]) => v && parseFloat(v) > 0)
        .map(([invoice_id, v]) => ({ invoice_id, amount: parseFloat(v) }));
      await financeCenterApi.createPaymentVoucher(token, {
        date, payee_type: payeeType,
        payee_id: payeeId || undefined,
        payee_name: payeeName || undefined,
        amount: parseFloat(amount), method,
        purpose: purpose || undefined,
        allocations: allocations.length > 0 ? allocations : undefined,
      });
      onCreated();
      setAmount(''); setPayeeName(''); setPayeeId(''); setPurpose(''); setAllocs({});
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal title={t('fin.payment.create')} open={open} onClose={onClose} onSubmit={submit} submitting={submitting} size="lg" submitLabel={t('fin.common.save')} cancelLabel={t('fin.common.cancel')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('fin.invoices.date')} required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.payments.col.type')}>
          <select value={payeeType} onChange={(e) => setPayeeType(e.target.value as any)} className={inputClass}>
            <option value="supplier">{t('fin.payments.type.supplier')}</option>
            <option value="employee">{t('fin.payments.type.employee')}</option>
            <option value="other">{t('fin.payments.type.other')}</option>
          </select>
        </Field>
        {payeeType === 'supplier' ? (
          <Field label={t('fin.payment.payee')} className="sm:col-span-2">
            <select value={payeeId} onChange={(e) => setPayeeId(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        ) : (
          <Field label={t('fin.payment.payee')} className="sm:col-span-2">
            <input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} className={inputClass} />
          </Field>
        )}
        <Field label={t('fin.revenue.col.amount')} required>
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.receipt.method')}>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
            <option value="bank">Bank / تحويل</option>
            <option value="cash">Cash / نقدي</option>
            <option value="check">Check / شيك</option>
          </select>
        </Field>
        <Field label={t('fin.payment.purpose')} className="sm:col-span-2">
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inputClass} />
        </Field>
      </div>

      {payeeType === 'supplier' && filtered.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('fin.receipt.invoices')}</h4>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800"><tr>
                <th className="px-2 py-1.5 text-start">{t('fin.invoices.number')}</th>
                <th className="px-2 py-1.5 text-end">{t('fin.invoices.balance')}</th>
                <th className="px-2 py-1.5 text-end">{t('fin.invoices.recordPayment')}</th>
              </tr></thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-2 py-1.5"><span className="font-mono">{inv.number}</span></td>
                    <td className="px-2 py-1.5 text-end tabular-nums text-rose-700">{formatIls(Number(inv.balance))}</td>
                    <td className="px-2 py-1.5 text-end">
                      <input type="number" step="0.01" min="0" max={Number(inv.balance)} value={allocs[inv.id] ?? ''} onChange={(e) => setAllocs((p) => ({ ...p, [inv.id]: e.target.value }))} className={`${inputClass} w-24 text-end`} />
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
