import React from 'react';

type Tone = 'green' | 'amber' | 'rose' | 'indigo' | 'slate' | 'violet';

const toneClass: Record<Tone, string> = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  rose: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
  indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200',
  slate: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
};

const STATUS_TONE: Record<string, Tone> = {
  paid: 'green', completed: 'green', approved: 'green', present: 'green', active: 'green',
  sent: 'indigo', draft: 'slate', pending: 'amber', pending_approval: 'amber', partial: 'amber', late: 'amber',
  overdue: 'rose', rejected: 'rose', cancelled: 'slate', absent: 'rose', suspended: 'slate',
  leave: 'violet', mission: 'violet', holiday: 'slate',
};

type Props = { status: string; label?: string; tone?: Tone };

export const StatusBadge: React.FC<Props> = ({ status, label, tone }) => {
  const t = tone ?? STATUS_TONE[status] ?? 'slate';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClass[t]}`}>
      {label ?? status}
    </span>
  );
};
