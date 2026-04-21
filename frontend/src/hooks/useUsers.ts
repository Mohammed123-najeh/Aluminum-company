import { useState, useCallback, useEffect, useRef } from 'react';
import type { User, CreateUserInput, UpdateUserInput } from '../types/user';
import { usersApi } from '../services/api';
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
    baseSalary: u.baseSalary ?? null,
    annualLeaveBalance: u.annualLeaveBalance ?? null,
    supervisorId: u.supervisorId ?? null,
    status: u.status,
    lastLogin: u.lastLogin ?? null,
    createdAt: u.createdAt,
  };
}

export function useUsers() {
  const { token } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadedOnceRef = useRef(false);
  useEffect(() => {
    loadedOnceRef.current = false;
  }, [token]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    const showLoading = !loadedOnceRef.current;
    if (showLoading) setLoading(true);
    try {
      setError(null);
      const data = await usersApi.list(token);
      setUsers(data.map(apiUserToUser));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
      loadedOnceRef.current = true;
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createUser = useCallback(
    async (input: CreateUserInput) => {
      if (!token) return;
      const newUser = await usersApi.create(
        {
          name: input.name,
          email: input.email,
          password: input.password,
          role: input.role,
          employee_type: input.employeeType ?? null,
          main_job: input.mainJob ?? null,
          supervisor_id: input.supervisorId ?? null,
          base_salary: input.baseSalary ?? null,
          annual_leave_balance: input.annualLeaveBalance ?? null,
        },
        token,
      );
      setUsers((prev) => [...prev, apiUserToUser(newUser)]);
      return apiUserToUser(newUser);
    },
    [token],
  );

  const updateUser = useCallback(
    async (id: string, input: UpdateUserInput) => {
      if (!token) return;
      const updated = await usersApi.update(
        id,
        {
          name: input.name,
          email: input.email,
          role: input.role,
          employee_type: input.employeeType ?? null,
          main_job: input.mainJob ?? null,
          supervisor_id: input.supervisorId ?? null,
          status: input.status,
          base_salary: input.baseSalary,
          annual_leave_balance: input.annualLeaveBalance,
        },
        token,
      );
      setUsers((prev) => prev.map((u) => (u.id === id ? apiUserToUser(updated) : u)));
    },
    [token],
  );

  const deleteUser = useCallback(
    async (id: string) => {
      if (!token) return;
      await usersApi.delete(id, token);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    },
    [token],
  );

  const toggleStatus = useCallback(
    async (id: string) => {
      if (!token) return;
      const updated = await usersApi.toggleStatus(id, token);
      setUsers((prev) => prev.map((u) => (u.id === id ? apiUserToUser(updated) : u)));
    },
    [token],
  );

  const assignSupervisor = useCallback(
    async (employeeId: string, supervisorId: string | null) => {
      if (!token) return;
      const updated = await usersApi.assignSupervisor(employeeId, supervisorId, token);
      setUsers((prev) =>
        prev.map((u) => (u.id === employeeId ? apiUserToUser(updated) : u)),
      );
    },
    [token],
  );

  return {
    users,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
    toggleStatus,
    assignSupervisor,
    refetch: fetchUsers,
  };
}
