import { useState, useCallback, useEffect, useRef } from 'react';
import type { User } from '../types/user';
import type { UpdateUserInput } from '../types/user';
import { myEmployeesApi, usersApi } from '../services/api';
import type { ApiUser } from '../services/api';
import { useApp } from '../contexts/AppContext';

function apiUserToUser(u: ApiUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    employeeType: u.employeeType ?? undefined,
    mainJob: u.mainJob ?? null,
    supervisorId: u.supervisorId ?? null,
    status: u.status,
    lastLogin: u.lastLogin ?? null,
    createdAt: u.createdAt,
  };
}

export function useMyEmployees() {
  const { token } = useApp();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadedOnceRef = useRef(false);
  useEffect(() => {
    loadedOnceRef.current = false;
  }, [token]);

  const fetchEmployees = useCallback(async () => {
    if (!token) return;
    const showLoading = !loadedOnceRef.current;
    if (showLoading) setLoading(true);
    try {
      setError(null);
      const data = await myEmployeesApi.list(token);
      setEmployees(data.map(apiUserToUser));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
      loadedOnceRef.current = true;
    }
  }, [token]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const updateEmployee = useCallback(
    async (id: string, input: UpdateUserInput) => {
      if (!token) return;
      const updated = await usersApi.update(
        id,
        {
          name: input.name,
          email: input.email,
          main_job: input.mainJob ?? null,
          status: input.status,
        },
        token,
      );
      setEmployees((prev) => prev.map((u) => (u.id === id ? apiUserToUser(updated) : u)));
    },
    [token],
  );

  const toggleStatus = useCallback(
    async (id: string) => {
      if (!token) return;
      const updated = await usersApi.toggleStatus(id, token);
      setEmployees((prev) => prev.map((u) => (u.id === id ? apiUserToUser(updated) : u)));
    },
    [token],
  );

  return {
    employees,
    loading,
    error,
    refetch: fetchEmployees,
    updateEmployee,
    toggleStatus,
  };
}
