import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { InnerSidebar, type InnerNavItem } from '../shared/dash';
import { HrEmployeesPanel } from './center/HrEmployeesPanel';
import { HrAttendancePanel } from './center/HrAttendancePanel';
import { HrPayrollPanel } from './center/HrPayrollPanel';
import { HrLeavePanel } from './center/HrLeavePanel';
import { HrAbsenceTardinessPanel } from './center/HrAbsenceTardinessPanel';

type Section = 'employees' | 'attendance' | 'payroll' | 'leaves' | 'absences';

const Icon = {
  employees: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" /></svg>,
  attendance: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-12a.75.75 0 0 0-1.5 0v4c0 .2.08.39.22.53l2.5 2.5a.75.75 0 1 0 1.06-1.06L10.75 9.69V6Z" clipRule="evenodd" /></svg>,
  payroll: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1H3V5Zm0 3v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H3Z" /></svg>,
  leaves: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a1 1 0 0 1 1 1v1h8V4a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a1 1 0 0 1 1-1Zm-2 6v7h14V9H3Z" /></svg>,
  absences: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1 4a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0V6Zm1 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clipRule="evenodd" /></svg>,
};

export const HrCenterPanel: React.FC = () => {
  const { t } = useApp();
  const [section, setSection] = useState<Section>('employees');

  const items: InnerNavItem<Section>[] = [
    { key: 'employees', label: t('hr.nav.employees'), icon: Icon.employees },
    { key: 'attendance', label: t('hr.nav.attendance'), icon: Icon.attendance },
    { key: 'payroll', label: t('hr.nav.payroll'), icon: Icon.payroll },
    { key: 'leaves', label: t('hr.nav.leaves'), icon: Icon.leaves },
    { key: 'absences', label: t('hr.nav.absences'), icon: Icon.absences },
  ];

  return (
    <div className="flex gap-4">
      <InnerSidebar items={items} active={section} onChange={setSection} title={t('hrCenterTitle')} />
      <div className="min-w-0 flex-1">
        {section === 'employees' && <HrEmployeesPanel />}
        {section === 'attendance' && <HrAttendancePanel />}
        {section === 'payroll' && <HrPayrollPanel />}
        {section === 'leaves' && <HrLeavePanel />}
        {section === 'absences' && <HrAbsenceTardinessPanel />}
      </div>
    </div>
  );
};
