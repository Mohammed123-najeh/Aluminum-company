import React from 'react';

type Tone = 'green' | 'amber' | 'rose' | 'indigo' | 'slate' | 'violet';

const toneClass: Record<Tone, { bg: string; dot: string }> = {
  green: {
    bg: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  amber: {
    bg: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
    dot: 'bg-rose-500',
  },
  indigo: {
    bg: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200',
    dot: 'bg-indigo-500',
  },
  slate: {
    bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  violet: {
    bg: 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
    dot: 'bg-violet-500',
  },
};

const STATUS_TONE: Record<string, Tone> = {
  paid: 'green',
  completed: 'green',
  approved: 'green',
  present: 'green',
  active: 'green',
  sent: 'indigo',
  draft: 'slate',
  pending: 'amber',
  pending_approval: 'amber',
  partial: 'amber',
  late: 'amber',
  overdue: 'rose',
  rejected: 'rose',
  cancelled: 'slate',
  absent: 'rose',
  suspended: 'slate',
  leave: 'violet',
  mission: 'violet',
  holiday: 'slate',
};

type Props = { status: string; label?: string; tone?: Tone };

export const StatusBadge: React.FC<Props> = ({ status, label, tone }) => {
  const t = tone ?? STATUS_TONE[status] ?? 'slate';
  const palette = toneClass[t];
  const isPending = status === 'pending' || status === 'pending_approval';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${palette.bg}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${palette.dot} ${isPending ? 'animate-pulse' : ''}`} />
      {label ?? status}
    </span>
  );
};
