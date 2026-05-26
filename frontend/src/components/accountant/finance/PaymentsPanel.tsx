import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { financeCenterApi, type ApiFinanceTransaction } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, FilterBar, FormModal, Field, inputClass, SectionHeader, StatusBadge, type Column } from '../../shared/dash';

export const PaymentsPanel: React.FC = () => {
  const { token, t } = useApp();
  const [rows, setRows] = useState<ApiFinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [source, setSource] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try {
      setRows(await financeCenterApi.listTransactions(token, { type: 'payment', from, to, source }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token, from, to, source]);

  useEffect(() => { void load(); }, [load]);

  const cols: Column<ApiFinanceTransaction>[] = [
    { key: 'date', header: t('fin.revenue.col.date'), render: (r) => r.date ?? '—' },
    { key: 'payee', header: t('fin.payments.col.payee'), render: (r) => r.partyName ?? '—' },
    { key: 'type', header: t('fin.payments.col.type'), render: (r) => r.source },
    { key: 'amount', header: t('fin.revenue.col.amount'), align: 'end', render: (r) => formatIls(Number(r.amount)) },
    { key: 'method', header: t('fin.revenue.col.method'), render: (r) => r.method ?? '—', hideOnMobile: true },
    { key: 'ref', header: t('fin.revenue.col.ref'), render: (r) => r.referenceNo ?? '—', hideOnMobile: true },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('fin.payments.title')}
        actions={
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
            + {t('fin.payments.add')}
          </button>
        }
        filters={
          <FilterBar dateFrom={from} dateTo={to} onDateChange={(f, tt) => { setFrom(f); setTo(tt); }}>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={`${inputClass} w-48`}>
              <option value="">{t('fin.common.all')}</option>
              <option value="supplier">{t('fin.payments.type.supplier')}</option>
              <option value="payroll">{t('fin.payments.type.employee')}</option>
              <option value="expense">{t('fin.payments.type.expense')}</option>
              <option value="rent">{t('fin.payments.type.rent')}</option>
              <option value="other">{t('fin.payments.type.other')}</option>
            </select>
          </FilterBar>
        }
      />

      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} />

      <AddPaymentModal open={open} onClose={() => setOpen(false)} onCreated={() => { setOpen(false); void load(); }} />
    </div>
  );
};

const AddPaymentModal: React.FC<{ open: boolean; onClose: () => void; onCreated: () => void }> = ({ open, onClose, onCreated }) => {
  const { token, t } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('supplier');
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await financeCenterApi.createTransaction(token, {
        type: 'payment', source, party_name: payeeName, amount: parseFloat(amount),
        method, reference_no: reference, date, notes,
      });
      onCreated();
      setAmount(''); setPayeeName(''); setReference(''); setNotes('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal title={t('fin.payments.add')} open={open} onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel={t('fin.common.save')} cancelLabel={t('fin.common.cancel')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('fin.revenue.col.date')} required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.payments.col.type')} required>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
            <option value="supplier">{t('fin.payments.type.supplier')}</option>
            <option value="payroll">{t('fin.payments.type.employee')}</option>
            <option value="expense">{t('fin.payments.type.expense')}</option>
            <option value="rent">{t('fin.payments.type.rent')}</option>
            <option value="other">{t('fin.payments.type.other')}</option>
          </select>
        </Field>
        <Field label={t('fin.payments.col.payee')} className="sm:col-span-2" required>
          <input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.revenue.col.amount')} required>
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.revenue.col.method')}>
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
        <Field label={t('fin.common.notes')} className="sm:col-span-2">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
        </Field>
      </div>
    </FormModal>
  );
};
