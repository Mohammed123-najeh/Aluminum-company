import { useState, useCallback, useEffect } from 'react';
import type { ApiAdminAnalytics } from '../services/api';
import { adminAnalyticsApi } from '../services/api';
import { useApp } from '../contexts/AppContext';

export function useAdminAnalytics(range?: { from: string; to: string } | null) {
  const { token } = useApp();
  const [data, setData] = useState<ApiAdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rangeKey = range ? `${range.from}|${range.to}` : '';

  const refresh = useCallback(async () => {
    if (!token) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await adminAnalyticsApi.get(token, range ?? undefined);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, rangeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
