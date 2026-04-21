import { useState, useCallback, useEffect, useRef } from 'react';
import type { ApiMessage, ApiMessageThreadSummary, ApiMessageInboxSummary } from '../services/api';
import { messagesApi } from '../services/api';
import { useApp } from '../contexts/AppContext';

export type MessageThreadSummary = ApiMessageThreadSummary | ApiMessageInboxSummary;

export function useMessages(otherPartyId: string | null) {
  const { token } = useApp();
  const [thread, setThread] = useState<ApiMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [threadSummaries, setThreadSummaries] = useState<MessageThreadSummary[]>([]);
  const [summariesLoading, setSummariesLoading] = useState(true);
  const [summariesError, setSummariesError] = useState<string | null>(null);

  const fetchThread = useCallback(async () => {
    if (!token || !otherPartyId) return;
    try {
      setThreadLoading(true);
      setThreadError(null);
      const data = await messagesApi.list(token, otherPartyId);
      setThread(Array.isArray(data) ? (data as ApiMessage[]) : []);
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setThreadLoading(false);
    }
  }, [token, otherPartyId]);

  const summariesLoadedOnceRef = useRef(false);
  useEffect(() => {
    summariesLoadedOnceRef.current = false;
  }, [token]);

  const fetchSummaries = useCallback(async () => {
    if (!token) return;
    const showLoading = !summariesLoadedOnceRef.current;
    if (showLoading) setSummariesLoading(true);
    try {
      setSummariesError(null);
      const data = await messagesApi.list(token);
      setThreadSummaries(Array.isArray(data) ? (data as MessageThreadSummary[]) : []);
    } catch (err) {
      setSummariesError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setSummariesLoading(false);
      summariesLoadedOnceRef.current = true;
    }
  }, [token]);

  useEffect(() => {
    if (otherPartyId) fetchThread();
    else setThread([]);
  }, [otherPartyId, fetchThread]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const sendMessage = useCallback(
    async (body: string, taskId?: string | null) => {
      if (!token || !otherPartyId) return;
      await messagesApi.send(
        { receiver_id: otherPartyId, body, task_id: taskId || undefined },
        token,
      );
      await fetchThread();
      await fetchSummaries();
    },
    [token, otherPartyId, fetchThread, fetchSummaries],
  );

  return {
    thread,
    threadLoading,
    threadError,
    threadSummaries,
    summariesLoading,
    summariesError,
    sendMessage,
    refetchThread: fetchThread,
    refetchSummaries: fetchSummaries,
  };
}
