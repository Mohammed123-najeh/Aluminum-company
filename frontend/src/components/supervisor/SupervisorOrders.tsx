import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { ApiOrder } from '../../services/api';

type Props = {
  orders: ApiOrder[];
  loading: boolean;
  error: string | null;
};

export const SupervisorOrders: React.FC<Props> = ({ orders, loading, error }) => {
  const { t } = useApp();
  const [detail, setDetail] = useState<ApiOrder | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('supervisorOrdersReadOnly')}</p>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">{t('noOrdersYet')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => setDetail(order)}
              className="w-full rounded-xl border border-slate-200 bg-white p-5 text-start shadow-sm transition hover:border-indigo-200 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-900 dark:hover:bg-slate-800/80"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {t('orderNumberLabel').replace('{id}', order.id)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {order.customerReference || '—'} · {order.creatorName}
                  </p>
                  {order.taskTitle && (
                    <p className="mt-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      {t('linkedTask')}: {order.taskTitle}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {order.status}
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                {order.items.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    {item.profileCode} {item.profileName} / {item.colorName} × {item.quantity} {t('unitsShort')}
                  </li>
                ))}
                {order.items.length > 3 && (
                  <li className="text-xs text-slate-400">{t('orderMoreItems').replace('{n}', String(order.items.length - 3))}</li>
                )}
              </ul>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('orderDetailModalTitle')}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('supervisorOrdersReadOnly')}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{t('orderId')}</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">#{detail.id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{t('statusCol')}</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{detail.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{t('customerReference')}</dt>
                <dd className="text-slate-900 dark:text-slate-100">{detail.customerReference || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{t('orderCreator')}</dt>
                <dd className="text-slate-900 dark:text-slate-100">{detail.creatorName}</dd>
              </div>
              {detail.taskTitle && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">{t('linkedTask')}</dt>
                  <dd className="text-end text-slate-900 dark:text-slate-100">{detail.taskTitle}</dd>
                </div>
              )}
            </dl>
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('orderItems')}
            </h3>
            <ul className="mt-2 space-y-2">
              {detail.items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/40"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {item.profileCode} {item.profileName}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400"> · {item.colorName}</span>
                  <span className="block text-slate-600 dark:text-slate-400">
                    {item.quantity} {t('unitsShort')}
                  </span>
                  {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="mt-6 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-300"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
