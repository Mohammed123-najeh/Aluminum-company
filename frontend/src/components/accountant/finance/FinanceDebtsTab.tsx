import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { ordersApi, type ApiOrder } from '../../../services/api';
import { formatIls } from '../../../utils/currency';
import { StatusBadge } from '../../shared/dash';

type DateMode = 'all' | 'today' | 'month' | 'year' | 'exact';

function orderCustomer(order: ApiOrder): string {
  return order.clientName ?? order.taskCustomerName ?? order.customerReference ?? '-';
}

function orderDebtDate(order: ApiOrder): string | null {
  return order.paymentDueAt ?? order.updatedAt ?? order.createdAt ?? null;
}

function isoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

const DebtMetric: React.FC<{
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'slate' | 'rose' | 'amber' | 'indigo';
}> = ({ label, value, hint, tone = 'slate' }) => {
  const toneClass =
    tone === 'rose' ? 'text-rose-700 dark:text-rose-300'
      : tone === 'amber' ? 'text-amber-700 dark:text-amber-300'
        : tone === 'indigo' ? 'text-indigo-700 dark:text-indigo-300'
          : 'text-slate-900 dark:text-slate-100';

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
};

/**
 * Debts tab - outstanding customer balances with efficient client/date filters.
 * Date filtering uses due date first; if an order has no due date, it falls
 * back to the order's last update date so no receivable becomes unsearchable.
 */
export const FinanceDebtsTab: React.FC = () => {
  const { t, token, lang } = useApp();
  const isAr = lang === 'ar';
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [dateMode, setDateMode] = useState<DateMode>('all');
  const [monthValue, setMonthValue] = useState(today.slice(0, 7));
  const [yearValue, setYearValue] = useState(today.slice(0, 4));
  const [exactDate, setExactDate] = useState(today);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const all = await ordersApi.list(token, { receipts_only: true });
      const debts = all.filter((o) => (o.balanceDue ?? 0) > 0.009);
      debts.sort((a, b) => {
        const ad = a.paymentDueAt ?? '9999-12-31';
        const bd = b.paymentDueAt ?? '9999-12-31';
        return ad.localeCompare(bd);
      });
      setOrders(debts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const matchesDate = useCallback((order: ApiOrder) => {
    if (dateMode === 'all') return true;
    const day = isoDay(orderDebtDate(order));
    if (!day) return false;
    if (dateMode === 'today') return day === today;
    if (dateMode === 'month') return monthValue ? day.startsWith(monthValue) : true;
    if (dateMode === 'year') return yearValue ? day.startsWith(yearValue) : true;
    return exactDate ? day === exactDate : true;
  }, [dateMode, exactDate, monthValue, today, yearValue]);

  const matchingOrders = useMemo(() => {
    const needle = clientSearch.trim().toLowerCase();
    return orders.filter((order) => {
      if (!matchesDate(order)) return false;
      if (!needle) return true;
      const hay = [
        orderCustomer(order),
        order.clientPhone,
        order.receiptNumber,
        order.id,
        order.customerReference,
        order.taskTitle,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [clientSearch, matchesDate, orders]);

  const customerGroups = useMemo(() => {
    const groups = new Map<string, {
      name: string;
      count: number;
      total: number;
      late: number;
      latestDate: string | null;
    }>();

    matchingOrders.forEach((order) => {
      const name = orderCustomer(order);
      if (name === '-') return;
      const current = groups.get(name) ?? {
        name,
        count: 0,
        total: 0,
        late: 0,
        latestDate: null,
      };
      const due = order.paymentDueAt ?? null;
      const debtDate = orderDebtDate(order);

      current.count += 1;
      current.total += order.balanceDue ?? 0;
      if (due !== null && due < today) current.late += 1;
      if (debtDate && (!current.latestDate || new Date(debtDate).getTime() > new Date(current.latestDate).getTime())) {
        current.latestDate = debtDate;
      }
      groups.set(name, current);
    });

    return Array.from(groups.values())
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .slice(0, 10);
  }, [matchingOrders, today]);

  const visibleOrders = useMemo(() => (
    selectedCustomer
      ? matchingOrders.filter((order) => orderCustomer(order) === selectedCustomer)
      : matchingOrders
  ), [matchingOrders, selectedCustomer]);

  const summary = useMemo(() => {
    const totalRemaining = visibleOrders.reduce((sum, order) => sum + (order.balanceDue ?? 0), 0);
    const lateRows = visibleOrders.filter((order) => {
      const due = order.paymentDueAt ?? null;
      return due !== null && due < today;
    });
    const customerCount = new Set(visibleOrders.map(orderCustomer).filter((name) => name !== '-')).size;

    return {
      rowCount: visibleOrders.length,
      customerCount,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      lateCount: lateRows.length,
      lateRemaining: Math.round(lateRows.reduce((sum, order) => sum + (order.balanceDue ?? 0), 0) * 100) / 100,
    };
  }, [today, visibleOrders]);

  const selectedCustomerStats = useMemo(() => {
    if (!selectedCustomer) return null;
    const latest = visibleOrders.reduce<string | null>((latestDate, order) => {
      const debtDate = orderDebtDate(order);
      if (!debtDate) return latestDate;
      if (!latestDate) return debtDate;
      return new Date(debtDate).getTime() > new Date(latestDate).getTime() ? debtDate : latestDate;
    }, null);

    return {
      name: selectedCustomer,
      rows: visibleOrders.length,
      total: summary.totalRemaining,
      lateCount: summary.lateCount,
      latest,
    };
  }, [selectedCustomer, summary.lateCount, summary.totalRemaining, visibleOrders]);

  const dateLabel =
    dateMode === 'all' ? (isAr ? 'كل الفترات' : 'All dates')
    : dateMode === 'today' ? (isAr ? 'اليوم' : 'Today')
    : dateMode === 'month' ? monthValue
    : dateMode === 'year' ? yearValue
    : exactDate;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('fin.debts.heading')}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'ابحث باسم العميل وراجع سجل المديونية حسب اليوم أو الشهر أو السنة أو تاريخ محدد.'
              : 'Search a client and review receivables by today, month, year, or an exact date.'}
          </p>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(16rem,1fr)_auto] xl:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isAr ? 'اسم العميل أو رقم الطلب' : 'Client name or order number'}
            </span>
            <input
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setSelectedCustomer(null);
              }}
              placeholder={isAr ? 'مثال: محمد، normal، أو رقم الإيصال...' : 'Example: Muhammad, normal, or receipt number...'}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800/60">
              {([
                ['all', isAr ? 'الكل' : 'All'],
                ['today', isAr ? 'اليوم' : 'Today'],
                ['month', isAr ? 'الشهر' : 'Month'],
                ['year', isAr ? 'السنة' : 'Year'],
                ['exact', isAr ? 'تاريخ محدد' : 'Exact date'],
              ] as Array<[DateMode, string]>).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDateMode(mode)}
                  className={`rounded-md px-3 py-1.5 transition ${
                    dateMode === mode
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {dateMode === 'month' && (
              <input
                type="month"
                value={monthValue}
                onChange={(e) => setMonthValue(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            )}
            {dateMode === 'year' && (
              <input
                type="number"
                min="2000"
                max="2100"
                value={yearValue}
                onChange={(e) => setYearValue(e.target.value.slice(0, 4))}
                className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            )}
            {dateMode === 'exact' && (
              <input
                type="date"
                value={exactDate}
                onChange={(e) => setExactDate(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            )}
          </div>
        </div>

        {customerGroups.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Matching customers</p>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                >
                  Clear selected customer
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {customerGroups.map((customer) => (
                <button
                  key={customer.name}
                  type="button"
                  onClick={() => setSelectedCustomer(customer.name)}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-start transition ${
                    selectedCustomer === customer.name
                      ? 'border-indigo-500 bg-white shadow-sm ring-2 ring-indigo-500/15 dark:bg-slate-900'
                      : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/70'
                  }`}
                >
                  <span className="block max-w-48 truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {customer.name}
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                    {customer.count} orders - {formatIls(Math.round(customer.total * 100) / 100)}
                    {customer.late > 0 ? ` - ${customer.late} late` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DebtMetric label={isAr ? 'النتائج' : 'Rows'} value={summary.rowCount} hint={dateLabel} />
          <DebtMetric label={isAr ? 'إجمالي المتبقي' : 'Total receivable'} value={formatIls(summary.totalRemaining)} tone="rose" />
          <DebtMetric label={isAr ? 'المتأخر' : 'Late amount'} value={formatIls(summary.lateRemaining)} hint={`${summary.lateCount} ${isAr ? 'طلب' : 'orders'}`} tone="amber" />
          <DebtMetric
            label={selectedCustomer ? 'Selected customer' : (isAr ? 'عدد العملاء' : 'Customers')}
            value={selectedCustomer ? selectedCustomer : summary.customerCount}
            tone="indigo"
          />
        </div>

        {selectedCustomerStats && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-300">
                  Customer history
                </p>
                <h4 className="mt-1 text-base font-bold text-slate-950 dark:text-slate-50">{selectedCustomerStats.name}</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Showing this customer only for {dateLabel}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Show all customers
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <DebtMetric label="Customer orders" value={selectedCustomerStats.rows} hint={dateLabel} />
              <DebtMetric label="Customer receivable" value={formatIls(selectedCustomerStats.total)} tone="rose" />
              <DebtMetric label="Late orders" value={selectedCustomerStats.lateCount} tone="amber" />
              <DebtMetric label="Latest activity" value={selectedCustomerStats.latest ? isoDay(selectedCustomerStats.latest) ?? '-' : '-'} tone="indigo" />
            </div>

            {visibleOrders.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {visibleOrders.slice(0, 6).map((order) => {
                  const due = order.paymentDueAt ?? null;
                  const isLate = due !== null && due < today;
                  return (
                    <div key={`history-${order.id}`} className="rounded-lg border border-white/80 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-slate-600 dark:text-slate-300">{order.receiptNumber ?? `ORD-${order.id}`}</span>
                        <span className={`font-semibold tabular-nums ${isLate ? 'text-amber-700 dark:text-amber-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                          {formatIls(order.balanceDue ?? 0)}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">
                        Due: {due ?? '-'} - {isLate ? 'Late' : 'Normal'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">{t('fin.common.loading')}</p>
      ) : visibleOrders.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{t('fin.debts.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                <th className="pb-2 text-start">{t('fin.overview.colCustomer')}</th>
                <th className="pb-2 text-start">{t('fin.overview.colOrderNo')}</th>
                <th className="pb-2 text-end">{t('fin.debts.colRemaining')}</th>
                <th className="pb-2 text-start">{t('fin.debts.colDueDate')}</th>
                <th className="pb-2 text-start">{t('fin.debts.colStatus')}</th>
                <th className="pb-2 text-end">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {visibleOrders.map((order) => {
                const due = order.paymentDueAt ?? null;
                const isLate = due !== null && due < today;
                const customerName = orderCustomer(order);
                return (
                  <tr
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCustomer(customerName)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedCustomer(customerName);
                      }
                    }}
                    className={`cursor-pointer text-slate-700 outline-none transition focus:bg-indigo-50 focus:ring-2 focus:ring-inset focus:ring-indigo-500/30 dark:text-slate-300 dark:focus:bg-indigo-950/20 ${
                      selectedCustomer === customerName
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-3 font-medium text-slate-900 dark:text-slate-100">
                      {customerName}
                    </td>
                    <td className="py-3 font-mono text-xs">{order.receiptNumber ?? `ORD-${order.id}`}</td>
                    <td className="py-3 text-end tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                      {formatIls(order.balanceDue ?? 0)}
                    </td>
                    <td className="py-3 text-xs text-slate-500">{due ?? '-'}</td>
                    <td className="py-3">
                      {isLate ? (
                        <StatusBadge status="late" tone="amber" label={t('fin.debts.statusLate')} />
                      ) : (
                        <StatusBadge status="normal" tone="indigo" label={t('fin.debts.statusNormal')} />
                      )}
                    </td>
                    <td className="py-3 text-end">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        View
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
