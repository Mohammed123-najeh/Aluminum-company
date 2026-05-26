import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../../contexts/AppContext';
import { financeCenterApi, type ApiSupplier, type ApiSupplierInvoice } from '../../../../services/api';
import { formatIls } from '../../../../utils/currency';
import { DataTable, FormModal, Field, inputClass, StatusBadge, type Column } from '../../../shared/dash';

type Line = { description: string; quantity: string; unit_price: string };

export const SupplierInvoicesTab: React.FC = () => {
  const { token, t } = useApp();
  const [rows, setRows] = useState<ApiSupplierInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try {
      const [list, sup] = await Promise.all([
        financeCenterApi.listSupplierInvoices(token),
        financeCenterApi.listSuppliers(token),
      ]);
      setRows(list); setSuppliers(sup);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    if (!token) return;
    const reason = status === 'rejected' ? prompt(t('fin.expenses.rejectionReason') + ':') ?? '' : '';
    try {
      await financeCenterApi.decideSupplierInvoice(token, id, { status, rejection_reason: reason || undefined });
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const cols: Column<ApiSupplierInvoice>[] = [
    { key: 'number', header: t('fin.invoices.number'), render: (r) => <span className="font-mono text-xs">{r.number}</span> },
    { key: 'date', header: t('fin.invoices.date'), render: (r) => r.date ?? '—' },
    { key: 'due', header: t('fin.invoices.dueDate'), render: (r) => r.dueDate ?? '—', hideOnMobile: true },
    { key: 'supplier', header: t('fin.invoices.supplier'), render: (r) => r.supplierName ?? '—' },
    { key: 'total', header: t('fin.invoices.total'), align: 'end', render: (r) => formatIls(Number(r.total)) },
    { key: 'paid', header: t('fin.invoices.paid'), align: 'end', render: (r) => formatIls(Number(r.paid)), hideOnMobile: true },
    { key: 'balance', header: t('fin.invoices.balance'), align: 'end', render: (r) => formatIls(Number(r.balance)) },
    {
      key: 'status', header: t('fin.revenue.col.status'), render: (r) => (
        <span className="flex items-center gap-2">
          <StatusBadge status={r.status} />
          {r.status === 'pending_approval' && (
            <span className="flex gap-1">
              <button onClick={(e) => { e.stopPropagation(); void decide(r.id, 'approved'); }} className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500">{t('fin.expenses.approve')}</button>
              <button onClick={(e) => { e.stopPropagation(); void decide(r.id, 'rejected'); }} className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-rose-500">{t('fin.expenses.reject')}</button>
            </span>
          )}
        </span>
      )
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
          + {t('fin.invoices.create')}
        </button>
      </div>
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} />
      <CreateSupplierInvoiceModal open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); void load(); }} suppliers={suppliers} />
    </div>
  );
};

const CreateSupplierInvoiceModal: React.FC<{ open: boolean; onClose: () => void; onCreated: () => void; suppliers: ApiSupplier[] }> = ({ open, onClose, onCreated, suppliers }) => {
  const { token, t } = useApp();
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ description: '', quantity: '1', unit_price: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const addLine = () => setLines((p) => [...p, { description: '', quantity: '1', unit_price: '' }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const updateLine = (i: number, k: keyof Line, v: string) => setLines((p) => p.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity || '0') * parseFloat(l.unit_price || '0')), 0);
  const vat = Math.round(subtotal * 0.15 * 100) / 100;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !supplierId || !number) return;
    setSubmitting(true);
    try {
      await financeCenterApi.createSupplierInvoice(token, {
        number, date, due_date: dueDate || undefined,
        supplier_id: supplierId, notes: notes || undefined,
        items: lines.map((l) => ({
          description: l.description,
          quantity: parseFloat(l.quantity || '1'),
          unit_price: parseFloat(l.unit_price || '0'),
        })),
      });
      onCreated();
      setNumber(''); setLines([{ description: '', quantity: '1', unit_price: '' }]); setNotes(''); setDueDate(''); setSupplierId('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal title={t('fin.invoices.create')} open={open} onClose={onClose} onSubmit={submit} submitting={submitting} size="lg" submitLabel={t('fin.common.save')} cancelLabel={t('fin.common.cancel')}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('fin.invoices.number')} required>
          <input value={number} onChange={(e) => setNumber(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.invoices.date')} required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.invoices.dueDate')}>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('fin.invoices.supplier')} className="sm:col-span-3" required>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required className={inputClass}>
            <option value="">—</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('fin.invoices.lineDesc')}</h4>
          <button type="button" onClick={addLine} className="text-xs font-semibold text-indigo-600 hover:underline">+ {t('fin.invoices.addLine')}</button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input value={l.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder={t('fin.invoices.lineDesc')} className={`${inputClass} col-span-6`} />
              <input type="number" step="0.001" value={l.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} className={`${inputClass} col-span-2`} />
              <input type="number" step="0.01" value={l.unit_price} onChange={(e) => updateLine(i, 'unit_price', e.target.value)} className={`${inputClass} col-span-3`} />
              <button type="button" onClick={() => removeLine(i)} className="col-span-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100">×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex justify-between"><span className="text-slate-500">{t('fin.invoices.subtotal')}</span><span className="font-semibold tabular-nums">{formatIls(subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">{t('fin.invoices.vat')} (15%)</span><span className="font-semibold tabular-nums">{formatIls(vat)}</span></div>
        <div className="mt-1 flex justify-between border-t border-slate-300 pt-1 dark:border-slate-600">
          <span className="font-bold">{t('fin.invoices.total')}</span><span className="font-bold tabular-nums">{formatIls(subtotal + vat)}</span>
        </div>
      </div>

      <Field label={t('fin.common.notes')} className="mt-3">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </Field>
    </FormModal>
  );
};
