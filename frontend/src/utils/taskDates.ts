import type { TaskStatus } from '../services/api';

function dayStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function taskDueBucket(
  dueDate: string | null,
  status: TaskStatus,
): 'overdue' | 'today' | null {
  if (!dueDate || status === 'completed' || status === 'cancelled') return null;
  const due = dayStart(new Date(dueDate).getTime());
  const today = dayStart(Date.now());
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return null;
}
