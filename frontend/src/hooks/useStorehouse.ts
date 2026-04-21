import { useState, useCallback, useEffect, useRef } from 'react';
import type { ApiCategory, ApiProfile, ApiColor, ApiInventoryItem } from '../services/api';
import { storehouseApi } from '../services/api';
import { useApp } from '../contexts/AppContext';

export function useStorehouse(categoryCode?: string) {
  const { token } = useApp();
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [colors, setColors] = useState<ApiColor[]>([]);
  const [inventory, setInventory] = useState<ApiInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadedOnceRef = useRef(false);
  useEffect(() => {
    loadedOnceRef.current = false;
  }, [token, categoryCode]);

  const fetch = useCallback(async () => {
    if (!token) return;
    const showLoading = !loadedOnceRef.current;
    if (showLoading) setLoading(true);
    try {
      setError(null);
      const [cats, profs, cols, inv] = await Promise.all([
        storehouseApi.categories(token),
        storehouseApi.profiles(token, categoryCode),
        storehouseApi.colors(token),
        storehouseApi.inventory(token),
      ]);
      setCategories(cats);
      setProfiles(profs);
      setColors(cols);
      setInventory(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storehouse');
    } finally {
      setLoading(false);
      loadedOnceRef.current = true;
    }
  }, [token, categoryCode]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const createInventoryItem = useCallback(
    async (payload: { profile_id: number; color_code: string; quantity_m: number }) => {
      if (!token) return undefined;
      const created = await storehouseApi.inventoryCreate(payload, token);
      setInventory((prev) =>
        [...prev, created].sort((a, b) => a.profileCode.localeCompare(b.profileCode) || a.colorCode.localeCompare(b.colorCode)),
      );
      return created;
    },
    [token],
  );

  const updateInventoryItem = useCallback(
    async (id: number, payload: { profile_id: number; color_code: string; quantity_m: number }) => {
      if (!token) return undefined;
      const updated = await storehouseApi.inventoryUpdate(id, payload, token);
      setInventory((prev) => prev.map((i) => (i.id === id ? updated : i)));
      return updated;
    },
    [token],
  );

  const updateProfileName = useCallback(
    async (profileId: number, name: string) => {
      if (!token) return undefined;
      const updated = await storehouseApi.profileUpdate(profileId, { name }, token);
      setProfiles((prev) => prev.map((p) => (p.id === profileId ? updated : p)));
      setInventory((prev) =>
        prev.map((i) => (i.profileId === profileId ? { ...i, profileName: updated.name } : i)),
      );
      return updated;
    },
    [token],
  );

  const deleteInventoryItem = useCallback(
    async (id: number) => {
      if (!token) return;
      await storehouseApi.inventoryDelete(id, token);
      setInventory((prev) => prev.filter((i) => i.id !== id));
    },
    [token],
  );

  return {
    categories,
    profiles,
    colors,
    inventory,
    loading,
    error,
    refetch: fetch,
    createInventoryItem,
    updateInventoryItem,
    updateProfileName,
    deleteInventoryItem,
  };
}
