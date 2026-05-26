import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../../contexts/AppContext';
import { financeCenterApi, type ApiCustomerInvoice } from '../../../../services/api';
import { formatIls } from '../../../../utils/currency';
import { DataTable, FormModal, Field, inputClass, StatusBadge, type Column } from '../../../shared/dash';

type Line = { description: string; quantity: string; unit_price: string };

export const CustomerInvoicesTab: React.FC = () => {
  const { token, t } = useApp();
  const [rows, setRows] = useState<ApiCustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ApiCustomerInvoice | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try { setRows(await financeCenterApi.listCustomerInvoices(token)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const cols: Column<ApiCustomerInvoice>[] = [
    { key: 'number', header: t('fin.invoices.number'), render: (r) => <span className="font-mono text-xs">{r.number}</span> },
    { key: 'date', header: t('fin.invoices.date'), render: (r) => r.date ?? '—' },
    { key: 'due', header: t('fin.invoices.dueDate'), render: (r) => r.dueDate ?? '—', hideOnMobile: true },
    { key: 'client', header: t('fin.invoices.client'), render: (r) => r.clientName ?? '—' },
    { key: 'total', header: t('fin.invoices.total'), align: 'end', render: (r) => formatIls(Number(r.total)) },
    { key: 'paid', header: t('fin.invoices.paid'), align: 'end', render: (r) => formatIls(Number(r.paid)), hideOnMobile: true },
    { key: 'balance', header: t('fin.invoices.balance'), align: 'end', render: (r) => formatIls(Number(r.balance)) },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} label={t(`fin.invoices.status.${r.status === 'partial' ? 'partial' : r.status}` as any)} /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
          + {t('fin.invoices.create')}
        </button>
      </div>
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <DataTable
        rows={rows}
        columns={cols}
        rowKey={(r) => r.id}
        loading={loading}
        empty={t('fin.common.empty')}
        onRowClick={(r) => setDetail(r)}
      />
      <CreateCustomerInvoiceModal open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); void load(); }} />
      {detail && <InvoiceDetailModal invoice={detail} onClose={() => setDetail(null)} />}
    </div>
  );
};

const CreateCustomerInvoiceModal: React.FC<{ open: boolean; onClose: () => void; onCreated: () => void }> = ({ open, onClose, onCreated }) => {
  const { token, t } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [clientName, setClientName] = useState('');
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
    if (!token) return;
    if (lines.length === 0 || lines.every((l) => !l.description || !l.unit_price)) {
      alert('Add at least one line item');
      return;
    }
    setSubmitting(true);
    try {
      await financeCenterApi.createCustomerInvoice(token, {
        date, due_date: dueDate || undefined,
        client_name_snapshot: clientName || undefined,
        notes: notes || undefined,
        items: lines.map((l) => ({
          description: l.description,
          quantity: parseFloat(l.quantity || '1'),
          unit_price: parseFloat(l.unit_price || '0'),
        })),
      });
      onCreated();
      setLines([{ description: '', quantity: '1', unit_price: '' }]);
      setClientName(''); setNotes(''); setDueDate('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal title={t('fin.invoices.create')} open={open} onClose={onClose} onSubmit={submit} submitting={submitting} size="lg" submitLabel={t('fin.common.save')} cancelLabel={t('fin.common.cancel')}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('fin.invoices.date')} required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.invoices.dueDate')}>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('fin.invoices.client')}>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('fin.invoices.lineDesc')}</h4>
          <button type="button" onClick={addLine} className="text-xs font-semibold text-indigo-600 hover:underline">
            + {t('fin.invoices.addLine')}
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input value={l.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder={t('fin.invoices.lineDesc')} className={`${inputClass} col-span-6`} />
              <input type="number" step="0.001" value={l.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} placeholder={t('fin.invoices.lineQty')} className={`${inputClass} col-span-2`} />
              <input type="number" step="0.01" value={l.unit_price} onChange={(e) => updateLine(i, 'unit_price', e.target.value)} placeholder={t('fin.invoices.linePrice')} className={`${inputClass} col-span-3`} />
              <button type="button" onClick={() => removeLine(i)} className="col-span-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100">×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex justify-between"><span className="text-slate-500">{t('fin.invoices.subtotal')}</span><span className="font-semibold tabular-nums">{formatIls(subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">{t('fin.invoices.vat')} (15%)</span><span className="font-semibold tabular-nums">{formatIls(vat)}</span></div>
        <div className="mt-1 flex justify-between border-t border-slate-300 pt-1 dark:border-slate-600">
          <span className="font-bold">{t('fin.invoices.total')}</span>
          <span className="font-bold tabular-nums">{formatIls(subtotal + vat)}</span>
        </div>
      </div>

      <Field label={t('fin.common.notes')} className="mt-3">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </Field>
    </FormModal>
  );
};

const InvoiceDetailModal: React.FC<{ invoice: ApiCustomerInvoice; onClose: () => void }> = ({ invoice, onClose }) => {
  const { t } = useApp();
  return (
    <FormModal title={`${t('fin.invoices.number')}: ${invoice.number}`} open onClose={onClose} size="lg" cancelLabel={t('fin.common.cancel')}>
      <div className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs text-slate-400">{t('fin.invoices.date')}</p><p className="font-medium">{invoice.date ?? '—'}</p></div>
          <div><p className="text-xs text-slate-400">{t('fin.invoices.dueDate')}</p><p className="font-medium">{invoice.dueDate ?? '—'}</p></div>
          <div><p className="text-xs text-slate-400">{t('fin.invoices.client')}</p><p className="font-medium">{invoice.clientName ?? '—'}</p></div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-2 py-1.5 text-start">{t('fin.invoices.lineDesc')}</th>
                <th className="px-2 py-1.5 text-end">{t('fin.invoices.lineQty')}</th>
                <th className="px-2 py-1.5 text-end">{t('fin.invoices.linePrice')}</th>
                <th className="px-2 py-1.5 text-end">{t('fin.invoices.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it) => (
                <tr key={it.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-2 py-1.5">{it.description}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums">{Number(it.quantity)}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums">{formatIls(Number(it.unitPrice))}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums">{formatIls(Number(it.lineTotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex justify-between"><span className="text-slate-500">{t('fin.invoices.subtotal')}</span><span className="font-semibold tabular-nums">{formatIls(Number(invoice.subtotal))}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">{t('fin.invoices.vat')} ({invoice.vatRate}%)</span><span className="font-semibold tabular-nums">{formatIls(Number(invoice.vatAmount))}</span></div>
          <div className="mt-1 flex justify-between border-t border-slate-300 pt-1 dark:border-slate-600">
            <span className="font-bold">{t('fin.invoices.total')}</span><span className="font-bold tabular-nums">{formatIls(Number(invoice.total))}</span>
          </div>
          <div className="flex justify-between"><span className="text-slate-500">{t('fin.invoices.paid')}</span><span className="font-semibold tabular-nums text-emerald-700">{formatIls(Number(invoice.paid))}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">{t('fin.invoices.balance')}</span><span className="font-semibold tabular-nums text-rose-700">{formatIls(Number(invoice.balance))}</span></div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            {t('fin.invoices.print')}
          </button>
        </div>
      </div>
    </FormModal>
  );
};
