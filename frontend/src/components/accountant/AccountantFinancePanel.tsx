import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { CenterHeader, TabBar, type TabItem } from '../shared/dash';
import { FinanceOverviewTab } from './finance/FinanceOverviewTab';
import { RevenuePanel } from './finance/RevenuePanel';
import { PaymentsPanel } from './finance/PaymentsPanel';
import { InvoicesPanel } from './finance/invoices/InvoicesPanel';
import { ExpensesPanel } from './finance/ExpensesPanel';
import { DebtsPanel } from './finance/DebtsPanel';
import { AdvancesPanel } from './finance/AdvancesPanel';
import { FinanceReportsPanel } from './finance/FinanceReportsPanel';

type Section = 'overview' | 'revenue' | 'payments' | 'invoices' | 'expenses' | 'debts' | 'advances' | 'reports';

export const AccountantFinancePanel: React.FC = () => {
  const { t } = useApp();
  const [section, setSection] = useState<Section>('overview');

  const tabs: TabItem<Section>[] = [
    { key: 'overview', label: t('fin.tab.overview') },
    { key: 'revenue', label: t('fin.nav.revenue') },
    { key: 'payments', label: t('fin.nav.payments') },
    { key: 'invoices', label: t('fin.nav.invoices') },
    { key: 'expenses', label: t('fin.nav.expenses') },
    { key: 'debts', label: t('fin.nav.debts') },
    { key: 'advances', label: t('fin.nav.advances') },
    { key: 'reports', label: t('fin.nav.reports') },
  ];

  const actions = (
    <>
      <button type="button" onClick={() => setSection('payments')} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
        + {t('fin.action.recordPayment')}
      </button>
      <button type="button" onClick={() => setSection('expenses')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        + {t('fin.action.addExpense')}
      </button>
      <button type="button" onClick={() => setSection('invoices')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {t('fin.action.issueReceipt')}
      </button>
    </>
  );

  return (
    <div>
      <CenterHeader title={t('fin.center.title')} subtitle={t('fin.center.subtitle')} actions={actions} />
      <TabBar items={tabs} active={section} onChange={setSection} />

      {section === 'overview' && <FinanceOverviewTab />}
      {section === 'revenue' && <RevenuePanel />}
      {section === 'payments' && <PaymentsPanel />}
      {section === 'invoices' && <InvoicesPanel />}
      {section === 'expenses' && <ExpensesPanel />}
      {section === 'debts' && <DebtsPanel />}
      {section === 'advances' && <AdvancesPanel />}
      {section === 'reports' && <FinanceReportsPanel />}
    </div>
  );
};
