import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiUserNotification } from '../services/api';
import { notificationsApi } from '../services/api';

const POLL_MS = 45_000;

export type NotificationsHookReturn = {
  unreadCount: number;
  list: ApiUserNotification[];
  loadingList: boolean;
  refreshCount: () => Promise<void>;
  refreshList: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

export function useNotifications(token: string | null): NotificationsHookReturn {
  const [unreadCount, setUnreadCount] = useState(0);
  const [list, setList] = useState<ApiUserNotification[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshCount = useCallback(async () => {
    if (!token) return;
    try {
      const { count } = await notificationsApi.unreadCount(token);
      if (mounted.current) setUnreadCount(count);
    } catch {
      /* ignore */
    }
  }, [token]);

  const refreshList = useCallback(async () => {
    if (!token) return;
    setLoadingList(true);
    try {
      const rows = await notificationsApi.list(token);
      if (mounted.current) setList(rows);
    } catch {
      if (mounted.current) setList([]);
    } finally {
      if (mounted.current) setLoadingList(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      setList([]);
      return;
    }
    refreshCount();
    const id = window.setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [token, refreshCount]);

  const markRead = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        const updated = await notificationsApi.markRead(id, token);
        setList((prev) => prev.map((n) => (n.id === id ? updated : n)));
        await refreshCount();
      } catch {
        await refreshCount();
      }
    },
    [token, refreshCount],
  );

  const markAllRead = useCallback(async () => {
    if (!token) return;
    try {
      await notificationsApi.markAllRead(token);
      setUnreadCount(0);
      await refreshList();
    } catch {
      await refreshCount();
    }
  }, [token, refreshCount, refreshList]);

  return {
    unreadCount,
    list,
    loadingList,
    refreshCount,
    refreshList,
    markRead,
    markAllRead,
  };
}
