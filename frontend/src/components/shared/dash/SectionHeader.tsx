import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
};

export const SectionHeader: React.FC<Props> = ({ title, subtitle, actions, filters }) => (
  <div className="mb-4 space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
  </div>
);
