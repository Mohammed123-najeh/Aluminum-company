import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

/** Page header for a center: title + subtitle on the leading side, action buttons on the trailing side. */
export const CenterHeader: React.FC<Props> = ({ title, subtitle, actions }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
