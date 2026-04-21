import { useState, useCallback, useEffect, useRef } from 'react';
import type { ApiOrder, CreateOrderPayload, UpdateOrderPayload } from '../services/api';
import { ordersApi } from '../services/api';
import { useApp } from '../contexts/AppContext';

export function useOrders() {
  const { token } = useApp();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadedOnceRef = useRef(false);
  useEffect(() => {
    loadedOnceRef.current = false;
  }, [token]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    const showLoading = !loadedOnceRef.current;
    if (showLoading) setLoading(true);
    try {
      setError(null);
      const data = await ordersApi.list(token);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
      loadedOnceRef.current = true;
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const createOrder = useCallback(
    async (payload: CreateOrderPayload) => {
      if (!token) return undefined;
      const created = await ordersApi.create(payload, token);
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === created.id);
        if (exists) {
          return prev.map((o) => (o.id === created.id ? created : o));
        }
        return [created, ...prev];
      });
      return created;
    },
    [token],
  );

  const updateOrder = useCallback(
    async (id: string, payload: UpdateOrderPayload) => {
      if (!token) return undefined;
      const updated = await ordersApi.update(id, payload, token);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      return updated;
    },
    [token],
  );

  const updatePayment = useCallback(
    async (
      id: string,
      body: { amount_paid: number; payment_due_at?: string | null; payment_notes?: string | null },
    ) => {
      if (!token) return undefined;
      const updated = await ordersApi.updatePayment(id, token, body);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      return updated;
    },
    [token],
  );

  return { orders, loading, error, createOrder, updateOrder, updatePayment, refetch: fetchOrders };
}
