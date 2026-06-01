import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { CenterHeader, TabBar, type TabItem } from '../shared/dash';
import { FinanceOverviewTab } from './finance/FinanceOverviewTab';
import { FinanceOrdersTab } from './finance/FinanceOrdersTab';
import { FinancePaymentsTab } from './finance/FinancePaymentsTab';
import { FinanceExpensesTab } from './finance/FinanceExpensesTab';
import { FinanceDebtsTab } from './finance/FinanceDebtsTab';
import { FinanceAdvancesTab } from './finance/FinanceAdvancesTab';
import { FinanceReportsTab } from './finance/FinanceReportsTab';
import { InvoicesPanel } from './finance/invoices/InvoicesPanel';
import { RecordPaymentModal, AddExpenseModal, IssueReceiptModal } from './finance/modals';

type Section = 'overview' | 'orders' | 'payments' | 'invoices' | 'expenses' | 'debts' | 'advances' | 'reports';

/**
 * Finance Center orchestrator. Eight tabs, three header action modals shared
 * across every tab so Finance can record a payment / add an expense / issue
 * a receipt from anywhere in the section.
 */
export const AccountantFinancePanel: React.FC = () => {
  const { t } = useApp();
  const [section, setSection] = useState<Section>('overview');
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showIssueReceipt, setShowIssueReceipt] = useState(false);
  // Bumping this counter forces tabs that read the same data to refetch — e.g.
  // recording a payment from the header should refresh Overview's recent-orders
  // even if we're sitting on the Overview tab when we open the modal.
  const [reloadKey, setReloadKey] = useState(0);
  const bumpReload = () => setReloadKey((k) => k + 1);

  const tabs: TabItem<Section>[] = [
    { key: 'overview', label: t('fin.tab.overview') },
    { key: 'orders', label: t('fin.nav.orders') },
    { key: 'payments', label: t('fin.nav.payments') },
    { key: 'invoices', label: t('fin.nav.invoices') },
    { key: 'expenses', label: t('fin.nav.expenses') },
    { key: 'debts', label: t('fin.nav.debts') },
    { key: 'advances', label: t('fin.nav.advances') },
    { key: 'reports', label: t('fin.nav.reports') },
  ];

  const actions = (
    <>
      <button
        type="button"
        onClick={() => setShowRecordPayment(true)}
        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
      >
        + {t('fin.action.recordPayment')}
      </button>
      <button
        type="button"
        onClick={() => setShowAddExpense(true)}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        + {t('fin.action.addExpense')}
      </button>
      <button
        type="button"
        onClick={() => setShowIssueReceipt(true)}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        $ {t('fin.action.issueReceipt')}
      </button>
    </>
  );

  return (
    <div>
      <CenterHeader title={t('fin.center.title')} subtitle={t('fin.center.subtitle')} actions={actions} />
      <TabBar items={tabs} active={section} onChange={setSection} />

      {/* `key={reloadKey}` forces a remount + refetch when an action modal
          commits, so the visible tab always shows fresh data. */}
      <div key={`${section}:${reloadKey}`}>
        {section === 'overview' && <FinanceOverviewTab onViewAllOrders={() => setSection('orders')} />}
        {section === 'orders' && <FinanceOrdersTab />}
        {section === 'payments' && <FinancePaymentsTab />}
        {section === 'invoices' && <InvoicesPanel />}
        {section === 'expenses' && <FinanceExpensesTab />}
        {section === 'debts' && <FinanceDebtsTab />}
        {section === 'advances' && <FinanceAdvancesTab />}
        {section === 'reports' && <FinanceReportsTab />}
      </div>

      {showRecordPayment && (
        <RecordPaymentModal
          onClose={() => setShowRecordPayment(false)}
          onSuccess={() => {
            setShowRecordPayment(false);
            bumpReload();
          }}
        />
      )}
      {showAddExpense && (
        <AddExpenseModal
          onClose={() => setShowAddExpense(false)}
          onSuccess={() => {
            setShowAddExpense(false);
            bumpReload();
          }}
        />
      )}
      {showIssueReceipt && (
        <IssueReceiptModal
          onClose={() => setShowIssueReceipt(false)}
          onSuccess={() => {
            setShowIssueReceipt(false);
            bumpReload();
          }}
        />
      )}
    </div>
  );
};
