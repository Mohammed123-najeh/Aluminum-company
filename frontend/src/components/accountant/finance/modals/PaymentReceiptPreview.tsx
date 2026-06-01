import React, { useRef } from 'react';
import { useApp } from '../../../../contexts/AppContext';
import type { ApiOrder, ApiOrderPayment } from '../../../../services/api';
import { formatIls } from '../../../../utils/currency';

/**
 * Post-submit step of RecordPaymentModal. Shows the freshly-recorded payment
 * as a print-ready receipt voucher. Two exit paths: Print (window.print of
 * just this voucher) or Skip (close without printing). Either way we close
 * once finished so the underlying tab refetches.
 *
 * We isolate the printable region with a `.print-only-target` class +
 * matching @media print rules so the rest of the UI is hidden while
 * window.print() runs.
 */
export const PaymentReceiptPreview: React.FC<{
  order: ApiOrder;
  payment: ApiOrderPayment;
  onPrint: () => void;
  onSkip: () => void;
}> = ({ order, payment, onPrint, onSkip }) => {
  const { t } = useApp();
  const printRef = useRef<HTMLDivElement | null>(null);

  const customer = order.clientName || order.taskCustomerName || order.customerReference || '—';
  const orderRef = order.receiptNumber || `ORD-${order.id}`;
  const total = order.totalAmount ?? 0;
  const paid = order.amountPaid ?? 0;
  const balance = order.balanceDue ?? Math.max(0, total - paid);
  const receiptNo = `PAY-${String(payment.id).padStart(4, '0')}`;
  const paidAt = new Date(payment.paidAt);

  const methodLabel = (() => {
    switch (payment.method) {
      case 'cash': return t('fin.method.cash');
      case 'transfer': return t('fin.method.transfer');
      case 'check': return t('fin.method.check');
      case 'card': return t('fin.method.card');
      default: return '—';
    }
  })();

  const handlePrint = () => {
    // Mark the body so the print stylesheet hides everything else.
    document.body.classList.add('printing-receipt');
    const cleanup = () => {
      document.body.classList.remove('printing-receipt');
      window.removeEventListener('afterprint', cleanup);
      onPrint();
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm print:hidden" aria-hidden />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-50 px-5 py-3 dark:border-slate-700 dark:bg-emerald-950/30 print:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {t('fin.receipt.recordedTitle')}
            </p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/70">
              {t('fin.receipt.recordedSubtitle')}
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
            ✓ {t('fin.receipt.savedBadge')}
          </span>
        </div>

        {/* Printable region */}
        <div ref={printRef} className="receipt-printable space-y-4 p-6 text-slate-900 dark:text-slate-100">
          <div className="flex items-start justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-bold">{t('fin.receipt.companyName')}</h2>
              <p className="text-xs text-slate-500">{t('fin.receipt.companyTagline')}</p>
            </div>
            <div className="text-end">
              <p className="text-xs uppercase tracking-wide text-slate-500">{t('fin.receipt.documentTitle')}</p>
              <p className="font-mono text-sm font-semibold">{receiptNo}</p>
              <p className="mt-0.5 text-xs text-slate-500">{paidAt.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{t('fin.receipt.customer')}</p>
              <p className="font-semibold">{customer}</p>
            </div>
            <div className="text-end">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{t('fin.receipt.orderRef')}</p>
              <p className="font-mono">{orderRef}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                <tr>
                  <td className="px-3 py-2 text-slate-500">{t('fin.receipt.orderTotal')}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{formatIls(total)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-500">{t('fin.receipt.previouslyPaid')}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{formatIls(Math.max(0, paid - payment.amount))}</td>
                </tr>
                <tr className="bg-emerald-50 dark:bg-emerald-950/30">
                  <td className="px-3 py-2 font-semibold text-emerald-800 dark:text-emerald-200">
                    {t('fin.receipt.thisPayment')}
                  </td>
                  <td className="px-3 py-2 text-end font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatIls(payment.amount)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-500">{t('fin.record.methodLabel')}</td>
                  <td className="px-3 py-2 text-end">{methodLabel}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold">{t('fin.receipt.remaining')}</td>
                  <td className="px-3 py-2 text-end font-bold tabular-nums text-rose-600 dark:text-rose-300">
                    {formatIls(balance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {payment.cheque && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/20">
              <p className="mb-2 font-semibold text-indigo-900 dark:text-indigo-200">
                {t('fin.cheque.title')}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <Detail label={t('fin.cheque.bank')} value={payment.cheque.bank ?? '—'} />
                <Detail label={t('fin.cheque.number')} value={payment.cheque.number ?? '—'} mono />
                <Detail label={t('fin.cheque.holder')} value={payment.cheque.holder ?? '—'} />
                <Detail
                  label={t('fin.cheque.amount')}
                  value={payment.cheque.amount != null ? formatIls(payment.cheque.amount) : '—'}
                />
                <Detail label={t('fin.cheque.issueDate')} value={payment.cheque.issueDate ?? '—'} />
                <Detail label={t('fin.cheque.dueDate')} value={payment.cheque.dueDate ?? '—'} />
                <Detail
                  label={t('fin.cheque.status')}
                  value={
                    payment.cheque.status === 'cleared'
                      ? t('fin.cheque.status.cleared')
                      : payment.cheque.status === 'bounced'
                        ? t('fin.cheque.status.bounced')
                        : payment.cheque.status === 'cancelled'
                          ? t('fin.cheque.status.cancelled')
                          : t('fin.cheque.status.pending')
                  }
                />
              </div>
            </div>
          )}

          {payment.note && (
            <div className="text-xs">
              <p className="text-slate-500">{t('fin.receipt.notes')}</p>
              <p>{payment.note}</p>
            </div>
          )}

          <div className="flex items-end justify-between border-t border-slate-200 pt-4 text-xs dark:border-slate-700">
            <div>
              <p className="text-slate-500">{t('fin.receipt.recordedBy')}</p>
              <p className="font-semibold">{payment.recordedByName ?? '—'}</p>
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
            onClick={onSkip}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t('fin.receipt.skipPrint')}
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
