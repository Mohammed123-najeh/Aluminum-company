import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { financeCenterApi, type ApiFinanceTransaction } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { DataTable, FilterBar, FormModal, Field, inputClass, KpiCard, SectionHeader, StatusBadge, type Column } from '../../shared/dash';

export const RevenuePanel: React.FC = () => {
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
      setRows(await financeCenterApi.listTransactions(token, { type: 'revenue', from, to, source }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token, from, to, source]);

  useEffect(() => { void load(); }, [load]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const totals = useMemo(() => {
    let m = 0, q = 0, y = 0;
    for (const r of rows) {
      if (!r.date) continue;
      const d = new Date(r.date);
      const amt = Number(r.amount);
      if (d >= yearStart) y += amt;
      if (d >= quarterStart) q += amt;
      if (d >= monthStart) m += amt;
    }
    return { m, q, y };
  }, [rows, monthStart.getTime(), quarterStart.getTime(), yearStart.getTime()]);

  const cols: Column<ApiFinanceTransaction>[] = [
    { key: 'date', header: t('fin.revenue.col.date'), render: (r) => r.date ?? '—' },
    { key: 'source', header: t('fin.revenue.col.source'), render: (r) => r.source },
    { key: 'party', header: t('fin.revenue.col.party'), render: (r) => r.partyName ?? '—' },
    { key: 'amount', header: t('fin.revenue.col.amount'), align: 'end', render: (r) => formatIls(Number(r.amount)) },
    { key: 'method', header: t('fin.revenue.col.method'), render: (r) => r.method ?? '—', hideOnMobile: true },
    { key: 'ref', header: t('fin.revenue.col.ref'), render: (r) => r.referenceNo ?? '—', hideOnMobile: true },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t('fin.revenue.title')}
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            + {t('fin.revenue.add')}
          </button>
        }
        filters={
          <FilterBar
            dateFrom={from}
            dateTo={to}
            onDateChange={(f, tt) => { setFrom(f); setTo(tt); }}
          >
            <select value={source} onChange={(e) => setSource(e.target.value)} className={`${inputClass} w-48`}>
              <option value="">{t('fin.common.all')}</option>
              <option value="order">{t('fin.revenue.source.order')}</option>
              <option value="service">{t('fin.revenue.source.service')}</option>
              <option value="investment">{t('fin.revenue.source.investment')}</option>
              <option value="receipt">{t('fin.invoices.tab.receipt')}</option>
              <option value="other">{t('fin.revenue.source.other')}</option>
            </select>
          </FilterBar>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label={t('fin.revenue.summary.month')} value={formatIls(totals.m)} tone="positive" />
        <KpiCard label={t('fin.revenue.summary.quarter')} value={formatIls(totals.q)} tone="accent" />
        <KpiCard label={t('fin.revenue.summary.year')} value={formatIls(totals.y)} tone="neutral" />
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} />

      <AddRevenueModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => { setOpen(false); void load(); }}
      />
    </div>
  );
};

const AddRevenueModal: React.FC<{ open: boolean; onClose: () => void; onCreated: () => void }> = ({ open, onClose, onCreated }) => {
  const { token, t } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('order');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await financeCenterApi.createTransaction(token, {
        type: 'revenue', source, party_name: partyName, amount: parseFloat(amount),
        method, reference_no: reference, date, notes,
      });
      onCreated();
      setAmount(''); setPartyName(''); setReference(''); setNotes('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal title={t('fin.revenue.add')} open={open} onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel={t('fin.common.save')} cancelLabel={t('fin.common.cancel')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('fin.revenue.col.date')} required>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.revenue.col.source')} required>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
            <option value="order">{t('fin.revenue.source.order')}</option>
            <option value="service">{t('fin.revenue.source.service')}</option>
            <option value="investment">{t('fin.revenue.source.investment')}</option>
            <option value="other">{t('fin.revenue.source.other')}</option>
          </select>
        </Field>
        <Field label={t('fin.revenue.col.party')} className="sm:col-span-2">
          <input value={partyName} onChange={(e) => setPartyName(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('fin.revenue.col.amount')} required>
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} />
        </Field>
        <Field label={t('fin.revenue.col.method')}>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
            <option value="cash">Cash / نقدي</option>
            <option value="bank">Bank transfer / تحويل بنكي</option>
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
