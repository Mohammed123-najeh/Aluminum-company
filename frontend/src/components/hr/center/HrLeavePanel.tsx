import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { leaveRequestsApi, hrCenterApi, type ApiLeaveRequest, type ApiLeaveBalanceRow } from '../../../services/api';
import { DataTable, FormModal, Field, inputClass, StatusBadge, type Column } from '../../shared/dash';

type Tab = 'requests' | 'balances' | 'calendar';

export const HrLeavePanel: React.FC = () => {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>('requests');

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'requests', label: t('hr.leave.tab.requests') },
    { key: 'balances', label: t('hr.leave.tab.balances') },
    { key: 'calendar', label: t('hr.leave.tab.calendar') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {tabs.map((tt) => (
          <button key={tt.key} type="button" onClick={() => setTab(tt.key)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${tab === tt.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-indigo-950/40'}`}>
            {tt.label}
          </button>
        ))}
      </div>

      {tab === 'requests' && <RequestsTab />}
      {tab === 'balances' && <BalancesTab />}
      {tab === 'calendar' && <CalendarTab />}
    </div>
  );
};

const RequestsTab: React.FC = () => {
  const { token, t } = useApp();
  const [rows, setRows] = useState<ApiLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [decideRow, setDecideRow] = useState<ApiLeaveRequest | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try { setRows(await leaveRequestsApi.listHr(token, statusFilter ? { status: statusFilter } : undefined)); }
    finally { setLoading(false); }
  }, [token, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const cols: Column<ApiLeaveRequest>[] = [
    { key: 'name', header: t('hr.employees.col.name'), render: (r) => r.userName ?? '—' },
    { key: 'type', header: t('hr.leave.col.type'), render: (r) => r.type },
    { key: 'from', header: t('hr.leave.col.from'), render: (r) => r.startDate },
    { key: 'to', header: t('hr.leave.col.to'), render: (r) => r.endDate },
    { key: 'days', header: t('hr.leave.col.days'), align: 'end', render: (r) => r.daysCount },
    { key: 'reason', header: t('hr.leave.col.reason'), render: (r) => r.reason ?? '—', hideOnMobile: true },
    { key: 'status', header: t('fin.revenue.col.status'), render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: t('fin.common.actions'), render: (r) => (
      r.status === 'pending' ? (
        <button onClick={() => setDecideRow(r)} className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-indigo-500">Decide</button>
      ) : null
    ) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass + ' w-40'}>
          <option value="">{t('fin.common.all')}</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} loading={loading} empty={t('fin.common.empty')} />
      {decideRow && <DecideModal request={decideRow} onClose={() => setDecideRow(null)} onDone={() => { setDecideRow(null); void load(); }} />}
    </div>
  );
};

const DecideModal: React.FC<{ request: ApiLeaveRequest; onClose: () => void; onDone: () => void }> = ({ request, onClose, onDone }) => {
  const { token, t } = useApp();
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await leaveRequestsApi.decide(token, request.id, { status: decision, decision_note: note });
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal title="Decide leave request" open onClose={onClose} onSubmit={submit} submitting={submitting} submitLabel={t('fin.common.save')} cancelLabel={t('fin.common.cancel')}>
      <div className="space-y-3 text-sm">
        <p>{request.userName} — {request.type} {request.startDate} → {request.endDate} ({request.daysCount} days)</p>
        <Field label="Decision">
          <select value={decision} onChange={(e) => setDecision(e.target.value as any)} className={inputClass}>
            <option value="approved">Approve</option>
            <option value="rejected">Reject</option>
          </select>
        </Field>
        <Field label="Note">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />
        </Field>
      </div>
    </FormModal>
  );
};

const BalancesTab: React.FC = () => {
  const { token, t } = useApp();
  const [rows, setRows] = useState<ApiLeaveBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try { setRows(await hrCenterApi.leaveBalances(token)); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const adjust = async (row: ApiLeaveBalanceRow) => {
    if (!token) return;
    const next = prompt(`Set new balance for ${row.name}:`, String(row.balance));
    if (next === null) return;
    const n = parseFloat(next);
    if (Number.isNaN(n)) return;
    try {
      await hrCenterApi.adjustLeaveBalance(token, row.userId, { annual_leave_balance: n });
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const cols: Column<ApiLeaveBalanceRow>[] = [
    { key: 'name', header: t('hr.employees.col.name'), render: (r) => r.name },
    { key: 'dept', header: t('hr.employees.col.department'), render: (r) => r.department ?? '—', hideOnMobile: true },
    { key: 'balance', header: t('hr.leave.balance.col.balance'), align: 'end', render: (r) => r.balance },
    { key: 'used', header: t('hr.leave.balance.col.used'), align: 'end', render: (r) => r.used },
    { key: 'remaining', header: t('hr.leave.balance.col.remaining'), align: 'end', render: (r) => <span className="font-bold">{r.remaining}</span> },
    { key: 'actions', header: '', render: (r) => (
      <button onClick={() => void adjust(r)} className="text-xs font-semibold text-indigo-600 hover:underline">Adjust</button>
    ) },
  ];

  return <DataTable rows={rows} columns={cols} rowKey={(r) => r.userId} loading={loading} empty={t('fin.common.empty')} />;
};

const CalendarTab: React.FC = () => {
  const { token } = useApp();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [leaves, setLeaves] = useState<ApiLeaveRequest[]>([]);

  useEffect(() => {
    if (!token) return;
    void leaveRequestsApi.listHr(token, { status: 'approved' }).then(setLeaves);
  }, [token]);

  const start = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDay = start.getDay();

  const eventsByDay: Record<number, ApiLeaveRequest[]> = {};
  for (const lr of leaves) {
    const s = new Date(lr.startDate);
    const e = new Date(lr.endDate);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        const day = d.getDate();
        (eventsByDay[day] ??= []).push(lr);
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={inputClass + ' w-24'}>
          {Array.from({ length: 5 }, (_, i) => today.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className={inputClass + ' w-24'}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: startDay }, (_, i) => <div key={`blank-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const events = eventsByDay[d] ?? [];
            return (
              <div key={d} className={`min-h-16 rounded-lg border p-1 text-[10px] ${events.length > 0 ? 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                <p className="font-semibold">{d}</p>
                {events.slice(0, 2).map((ev) => (
                  <p key={ev.id} className="truncate text-violet-700 dark:text-violet-300">{ev.userName} ({ev.type})</p>
                ))}
                {events.length > 2 && <p className="text-slate-400">+{events.length - 2}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
