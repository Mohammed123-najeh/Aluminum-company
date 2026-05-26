import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { InnerSidebar, type InnerNavItem } from '../shared/dash';
import { FinanceDashboard } from './finance/FinanceDashboard';
import { RevenuePanel } from './finance/RevenuePanel';
import { PaymentsPanel } from './finance/PaymentsPanel';
import { InvoicesPanel } from './finance/invoices/InvoicesPanel';
import { ExpensesPanel } from './finance/ExpensesPanel';
import { DebtsPanel } from './finance/DebtsPanel';
import { AdvancesPanel } from './finance/AdvancesPanel';
import { FinanceReportsPanel } from './finance/FinanceReportsPanel';

type Section = 'dashboard' | 'revenue' | 'payments' | 'invoices' | 'expenses' | 'debts' | 'advances' | 'reports';

const Icon = {
  dashboard: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4Zm8 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V4Zm0 8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4Zm-8 2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2Z" /></svg>,
  revenue: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 0 1 1 1v1.06A4 4 0 0 1 14 8a1 1 0 1 1-2 0 2 2 0 1 0-4 0c0 .94.65 1.74 1.53 1.95l1.94.49A4 4 0 0 1 11 17.94V19a1 1 0 1 1-2 0v-1.06A4 4 0 0 1 6 14a1 1 0 1 1 2 0 2 2 0 1 0 4 0c0-.94-.65-1.74-1.53-1.95l-1.94-.49A4 4 0 0 1 9 4.06V3a1 1 0 0 1 1-1Z" /></svg>,
  payments: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1H3V5Zm0 3v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H3Zm3 3a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Z" /></svg>,
  invoices: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v15l-2-1-2 1-2-1-2 1-2-1-2 1V3Zm3 4a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H6Zm0 4a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H6Z" /></svg>,
  expenses: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Zm2 2v6h12V8H4Zm2 2a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Z" /></svg>,
  debts: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-12a.75.75 0 0 0-1.5 0v4c0 .2.08.39.22.53l2.5 2.5a.75.75 0 1 0 1.06-1.06L10.75 9.69V6Z" clipRule="evenodd" /></svg>,
  advances: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" /></svg>,
  reports: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h7.379a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 16.5 6.62V16.5A1.5 1.5 0 0 1 15 18H4.5A1.5 1.5 0 0 1 3 16.5V3.5Z" /></svg>,
};

export const AccountantFinancePanel: React.FC = () => {
  const { t } = useApp();
  const [section, setSection] = useState<Section>('dashboard');

  const items: InnerNavItem<Section>[] = [
    { key: 'dashboard', label: t('fin.nav.dashboard'), icon: Icon.dashboard },
    { key: 'revenue', label: t('fin.nav.revenue'), icon: Icon.revenue },
    { key: 'payments', label: t('fin.nav.payments'), icon: Icon.payments },
    { key: 'invoices', label: t('fin.nav.invoices'), icon: Icon.invoices },
    { key: 'expenses', label: t('fin.nav.expenses'), icon: Icon.expenses },
    { key: 'debts', label: t('fin.nav.debts'), icon: Icon.debts },
    { key: 'advances', label: t('fin.nav.advances'), icon: Icon.advances },
    { key: 'reports', label: t('fin.nav.reports'), icon: Icon.reports },
  ];

  return (
    <div className="flex gap-4">
      <InnerSidebar items={items} active={section} onChange={setSection} title={t('accountantFinanceTitle')} />
      <div className="min-w-0 flex-1">
        {section === 'dashboard' && <FinanceDashboard />}
        {section === 'revenue' && <RevenuePanel />}
        {section === 'payments' && <PaymentsPanel />}
        {section === 'invoices' && <InvoicesPanel />}
        {section === 'expenses' && <ExpensesPanel />}
        {section === 'debts' && <DebtsPanel />}
        {section === 'advances' && <AdvancesPanel />}
        {section === 'reports' && <FinanceReportsPanel />}
      </div>
    </div>
  );
};
