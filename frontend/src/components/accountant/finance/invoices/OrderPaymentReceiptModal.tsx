import React from 'react';
import { useApp } from '../../../../contexts/AppContext';
import type { ApiOrderPaymentReceipt } from '../../../../services/api';
import { formatIls } from '../../../../utils/currency';

/**
 * Stand-alone view + print modal for a saved order-payment receipt.
 * Same printable card the Record-Payment flow shows post-submit, but
 * fed from the persisted row so the operator can re-print at any time.
 */
export const OrderPaymentReceiptModal: React.FC<{
  receipt: ApiOrderPaymentReceipt;
  onClose: () => void;
}> = ({ receipt, onClose }) => {
  const { t } = useApp();

  const methodLabel = (() => {
    switch (receipt.method) {
      case 'cash': return t('fin.method.cash');
      case 'transfer': return t('fin.method.transfer');
      case 'check': return t('fin.method.check');
      case 'card': return t('fin.method.card');
      default: return '—';
    }
  })();

  const handlePrint = () => {
    document.body.classList.add('printing-receipt');
    const cleanup = () => {
      document.body.classList.remove('printing-receipt');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm print:hidden" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 print:max-w-none print:rounded-none print:shadow-none">
        <div className="receipt-printable space-y-4 p-6 text-slate-900 dark:text-slate-100">
          <div className="flex items-start justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-bold">{t('fin.receipt.companyName')}</h2>
              <p className="text-xs text-slate-500">{t('fin.receipt.companyTagline')}</p>
            </div>
            <div className="text-end">
              <p className="text-xs uppercase tracking-wide text-slate-500">{t('fin.receipt.documentTitle')}</p>
              <p className="font-mono text-sm font-semibold">{receipt.number}</p>
              <p className="mt-0.5 text-xs text-slate-500">{receipt.date ?? '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{t('fin.receipt.customer')}</p>
              <p className="font-semibold">{receipt.clientName ?? '—'}</p>
            </div>
            <div className="text-end">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{t('fin.receipt.orderRef')}</p>
              <p className="font-mono">{receipt.orderRef ?? '—'}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                <tr className="bg-emerald-50 dark:bg-emerald-950/30">
                  <td className="px-3 py-2 font-semibold text-emerald-800 dark:text-emerald-200">
                    {t('fin.receipt.thisPayment')}
                  </td>
                  <td className="px-3 py-2 text-end font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatIls(receipt.amount)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-500">{t('fin.record.methodLabel')}</td>
                  <td className="px-3 py-2 text-end">{methodLabel}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {receipt.cheque && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/20">
              <p className="mb-2 font-semibold text-indigo-900 dark:text-indigo-200">
                {t('fin.cheque.title')}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <Detail label={t('fin.cheque.bank')} value={receipt.cheque.bank ?? '—'} />
                <Detail label={t('fin.cheque.number')} value={receipt.cheque.number ?? '—'} mono />
                <Detail label={t('fin.cheque.holder')} value={receipt.cheque.holder ?? '—'} />
                <Detail
                  label={t('fin.cheque.amount')}
                  value={receipt.cheque.amount != null ? formatIls(receipt.cheque.amount) : '—'}
                />
                <Detail label={t('fin.cheque.issueDate')} value={receipt.cheque.issueDate ?? '—'} />
                <Detail label={t('fin.cheque.dueDate')} value={receipt.cheque.dueDate ?? '—'} />
                <Detail
                  label={t('fin.cheque.status')}
                  value={
                    receipt.cheque.status === 'cleared'
                      ? t('fin.cheque.status.cleared')
                      : receipt.cheque.status === 'bounced'
                        ? t('fin.cheque.status.bounced')
                        : receipt.cheque.status === 'cancelled'
                          ? t('fin.cheque.status.cancelled')
                          : t('fin.cheque.status.pending')
                  }
                />
              </div>
            </div>
          )}

          {receipt.note && (
            <div className="text-xs">
              <p className="text-slate-500">{t('fin.receipt.notes')}</p>
              <p>{receipt.note}</p>
            </div>
          )}

          <div className="flex items-end justify-between border-t border-slate-200 pt-4 text-xs dark:border-slate-700">
            <div>
              <p className="text-slate-500">{t('fin.receipt.recordedBy')}</p>
              <p className="font-semibold">{receipt.recordedByName ?? '—'}</p>
            </div>
            <div className="text-end">
              <p className="text-slate-500">{t('fin.receipt.signature')}</p>
              <div className="mt-3 h-8 w-32 border-b border-slate-300 dark:border-slate-600" />
            </div>
          </div>

          <p className="pt-2 text-center text-[10px] text-slate-400">
            {t('fin.receipt.footer')}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/50 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-lg bg-linear-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-400"
          >
            🖨 {t('fin.receipt.print')}
          </button>
        </div>
      </div>
    </div>
  );
};

const Detail: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    <p className={mono ? 'font-mono text-xs font-semibold' : 'text-xs font-semibold'}>{value}</p>
  </div>
);
