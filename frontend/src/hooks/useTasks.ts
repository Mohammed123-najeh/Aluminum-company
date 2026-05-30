import { useState, useCallback, useEffect, useRef } from 'react';
import type { ApiTask, CreateTaskPayload, UpdateTaskPayload } from '../services/api';
import { tasksApi } from '../services/api';
import { useApp } from '../contexts/AppContext';

type TaskFilters = { assignee_id?: string; status?: string };

export function useTasks(filters?: TaskFilters) {
  const { token } = useApp();
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadedOnceRef = useRef(false);
  useEffect(() => {
    loadedOnceRef.current = false;
  }, [token, filters?.assignee_id, filters?.status]);

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    const showLoading = !loadedOnceRef.current;
    if (showLoading) setLoading(true);
    try {
      setError(null);
      const data = await tasksApi.list(token, filters);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
      loadedOnceRef.current = true;
    }
  }, [token, filters?.assignee_id, filters?.status]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Refetch on window focus so supervisor sees employee status changes
  useEffect(() => {
    const onFocus = () => fetchTasks();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchTasks]);

  // Optional: poll every 45s when tab is visible
  useEffect(() => {
    if (!token) return;
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchTasks();
    }, 45000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [token, fetchTasks]);

  const createTask = useCallback(
    async (payload: CreateTaskPayload) => {
      if (!token) return;
      const created = await tasksApi.create(
        {
          assignee_ids: payload.assignee_ids,
          title: payload.title,
          description: payload.description ?? null,
          due_date: payload.due_date ?? null,
          order_reference: payload.order_reference ?? null,
          customer_name: payload.customer_name ?? null,
          customer_phone: payload.customer_phone ?? null,
          client_id: payload.client_id ?? null,
          order_id: payload.order_id ?? null,
          total_amount: payload.total_amount ?? null,
          amount_paid: payload.amount_paid ?? null,
        },
        token,
      );
      setTasks((prev) => [created, ...prev]);
      return created;
    },
    [token],
  );

  const updateTask = useCallback(
    async (id: string, payload: UpdateTaskPayload) => {
      if (!token) return;
      const updated = await tasksApi.update(id, payload, token);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    },
    [token],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!token) return;
      await tasksApi.delete(id, token);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [token],
  );

  const uploadTaskAttachment = useCallback(
    async (taskId: string, file: File) => {
      if (!token) return undefined;
      const updated = await tasksApi.uploadAttachment(taskId, file, token);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      return updated;
    },
    [token],
  );

  const deleteTaskAttachment = useCallback(
    async (taskId: string, attachmentId: string) => {
      if (!token) return undefined;
      const updated = await tasksApi.deleteAttachment(taskId, attachmentId, token);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      return updated;
    },
    [token],
  );

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    uploadTaskAttachment,
    deleteTaskAttachment,
    refetch: fetchTasks,
  };
}
