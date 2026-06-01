import React, { useState } from 'react';
import { useApp } from '../../../../contexts/AppContext';
import { SectionHeader } from '../../../shared/dash';
import { CustomerInvoicesTab } from './CustomerInvoicesTab';
import { SupplierInvoicesTab } from './SupplierInvoicesTab';
import { ReceiptVouchersTab } from './ReceiptVouchersTab';
import { PaymentVouchersTab } from './PaymentVouchersTab';
import { OrderPaymentReceiptsTab } from './OrderPaymentReceiptsTab';

type Tab = 'customer' | 'supplier' | 'receipt' | 'orderReceipts' | 'payment';

export const InvoicesPanel: React.FC = () => {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>('customer');

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'customer', label: t('fin.invoices.tab.customer') },
    { key: 'supplier', label: t('fin.invoices.tab.supplier') },
    { key: 'receipt', label: t('fin.invoices.tab.receipt') },
    { key: 'orderReceipts', label: t('fin.invoices.tab.orderReceipts') },
    { key: 'payment', label: t('fin.invoices.tab.payment') },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader title={t('fin.invoices.title')} />
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {tabs.map((tt) => (
          <button
            key={tt.key}
            type="button"
            onClick={() => setTab(tt.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === tt.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-indigo-50 dark:text-slate-300 dark:hover:bg-indigo-950/40'
            }`}
          >
            {tt.label}
          </button>
        ))}
      </div>

      {tab === 'customer' && <CustomerInvoicesTab />}
      {tab === 'supplier' && <SupplierInvoicesTab />}
      {tab === 'receipt' && <ReceiptVouchersTab />}
      {tab === 'orderReceipts' && <OrderPaymentReceiptsTab />}
      {tab === 'payment' && <PaymentVouchersTab />}
    </div>
  );
};
