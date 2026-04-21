import React, { useEffect } from 'react';
import type { ApiUserNotification } from '../../services/api';
import type { NotificationsHookReturn } from '../../hooks/useNotifications';
import { useApp } from '../../contexts/AppContext';

function formatShortTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

type Props = {
  state: NotificationsHookReturn;
  onOpenMessagesWithPeer?: (peerUserId: string) => void;
  onOpenTasks?: (taskId?: string) => void;
};

export const NotificationsPanel: React.FC<Props> = ({ state, onOpenMessagesWithPeer, onOpenTasks }) => {
  const { t } = useApp();
  const { list, loadingList, refreshList, markRead, markAllRead, unreadCount } = state;

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const handleItem = async (n: ApiUserNotification) => {
    if (!n.readAt) await markRead(n.id);
    if (n.type === 'message' && n.data.peerId && onOpenMessagesWithPeer) {
      onOpenMessagesWithPeer(n.data.peerId);
      return;
    }
    if ((n.type === 'task_assigned' || n.type === 'task_status') && onOpenTasks) {
      onOpenTasks(n.data.taskId);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t('notificationsTitle')}</h2>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-950"
          >
            {t('notificationsMarkAllRead')}
          </button>
        )}
      </div>

      {loadingList && list.length === 0 ? (
        <div className="flex justify-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('notificationsEmpty')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => void handleItem(n)}
                className={`w-full rounded-xl border px-4 py-3 text-start transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20 ${
                  !n.readAt
                    ? 'border-indigo-200 bg-indigo-50/30 dark:border-indigo-900/60 dark:bg-indigo-950/25'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{n.title}</span>
                  {!n.readAt && (
                    <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-px text-[9px] font-bold uppercase text-white">
                      {t('notificationsNew')}
                    </span>
                  )}
                </div>
                {n.body && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{n.body}</p>}
                <p className="mt-2 text-[10px] text-slate-400">{formatShortTime(n.createdAt)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
