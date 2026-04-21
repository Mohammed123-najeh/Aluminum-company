import React, { useEffect, useRef, useState } from 'react';
import type { ApiUserNotification } from '../../services/api';
import type { NotificationsHookReturn } from '../../hooks/useNotifications';
import { useApp } from '../../contexts/AppContext';

function formatShortTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

type Props = {
  state: NotificationsHookReturn;
  onOpenMessagesWithPeer?: (peerUserId: string) => void;
  onOpenTasks?: (taskId?: string) => void;
  onViewAll?: () => void;
};

export const NotificationBell: React.FC<Props> = ({
  state,
  onOpenMessagesWithPeer,
  onOpenTasks,
  onViewAll,
}) => {
  const { t } = useApp();
  const { unreadCount, refreshCount, refreshList, list, loadingList, markRead, markAllRead } = state;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    refreshList();
    refreshCount();
  }, [open, refreshList, refreshCount]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleItem = async (n: ApiUserNotification) => {
    if (!n.readAt) await markRead(n.id);
    setOpen(false);
    if (n.type === 'message' && n.data.peerId && onOpenMessagesWithPeer) {
      onOpenMessagesWithPeer(n.data.peerId);
      return;
    }
    if ((n.type === 'task_assigned' || n.type === 'task_status') && onOpenTasks) {
      const tid = n.data.taskId;
      onOpenTasks(tid);
      return;
    }
  };

  const badge = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={t('notificationsNav')}
        className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.109V8.25c0-2.485-1.008-4.736-2.64-6.364M15.75 14.25a3 3 0 11-6 0m6 0a3 3 0 10-6 0m6 0h.008v.008H15.75V14.25z"
          />
        </svg>
        {badge && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-[100] mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{t('notificationsNav')}</p>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="rounded-md px-2 py-1 text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                >
                  {t('notificationsMarkAllRead')}
                </button>
              )}
              {onViewAll && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onViewAll();
                  }}
                  className="rounded-md px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  {t('notificationsViewAll')}
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[min(60vh,320px)] overflow-y-auto">
            {loadingList && list.length === 0 ? (
              <div className="flex justify-center py-8">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
              </div>
            ) : list.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">{t('notificationsEmpty')}</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.slice(0, 12).map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void handleItem(n)}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-start transition hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                        !n.readAt ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-50">{n.title}</span>
                      {n.body && <span className="line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400">{n.body}</span>}
                      <span className="text-[10px] text-slate-400">{formatShortTime(n.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
