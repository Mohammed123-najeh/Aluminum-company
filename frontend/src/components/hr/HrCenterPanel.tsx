import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { CenterHeader, TabBar, type TabItem } from '../shared/dash';
import { HrOverviewTab } from './center/HrOverviewTab';
import { HrEmployeesPanel } from './center/HrEmployeesPanel';
import { HrAttendancePanel } from './center/HrAttendancePanel';
import { HrPayrollPanel, IncrementsTab } from './center/HrPayrollPanel';
import { HrLeavePanel } from './center/HrLeavePanel';
import { HrAbsenceTardinessPanel } from './center/HrAbsenceTardinessPanel';
import { HrReportsPanel } from './center/HrReportsPanel';

type Section = 'overview' | 'employees' | 'attendance' | 'payroll' | 'leaves' | 'increments' | 'absences' | 'reports';

export const HrCenterPanel: React.FC = () => {
  const { t } = useApp();
  const [section, setSection] = useState<Section>('overview');

  const tabs: TabItem<Section>[] = [
    { key: 'overview', label: t('hr.tab.overview') },
    { key: 'employees', label: t('hr.nav.employees') },
    { key: 'attendance', label: t('hr.nav.attendance') },
    { key: 'payroll', label: t('hr.nav.payroll') },
    { key: 'leaves', label: t('hr.nav.leaves') },
    { key: 'increments', label: t('hr.payroll.tab.increments') },
    { key: 'absences', label: t('hr.nav.absences') },
    { key: 'reports', label: t('hr.nav.reports') },
  ];

  const actions = (
    <>
      <button type="button" onClick={() => setSection('attendance')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {t('hr.action.attendanceReport')}
      </button>
      <button type="button" onClick={() => setSection('reports')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {t('hr.action.payrollReport')}
      </button>
    </>
  );

  return (
    <div>
      <CenterHeader title={t('hr.center.title')} subtitle={t('hr.center.subtitle')} actions={actions} />
      <TabBar items={tabs} active={section} onChange={setSection} />

      {section === 'overview' && <HrOverviewTab />}
      {section === 'employees' && <HrEmployeesPanel />}
      {section === 'attendance' && <HrAttendancePanel />}
      {section === 'payroll' && <HrPayrollPanel />}
      {section === 'leaves' && <HrLeavePanel />}
      {section === 'increments' && <IncrementsTab />}
      {section === 'absences' && <HrAbsenceTardinessPanel />}
      {section === 'reports' && <HrReportsPanel />}
    </div>
  );
};
