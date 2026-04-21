export type Role = 'admin' | 'supervisor' | 'employee';
export type EmployeeType = 'accountant' | 'sales' | 'hr';
export type UserStatus = 'active' | 'suspended';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeType?: EmployeeType;
  mainJob?: string | null;
  baseSalary?: string | null;
  annualLeaveBalance?: string | null;
  supervisorId?: string | null;
  status: UserStatus;
  lastLogin?: string | null;
  createdAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: 'supervisor' | 'employee';
  employeeType?: EmployeeType;
  mainJob?: string | null;
  supervisorId?: string | null;
  baseSalary?: number | null;
  annualLeaveBalance?: number | null;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: 'supervisor' | 'employee';
  employeeType?: EmployeeType;
  mainJob?: string | null;
  supervisorId?: string | null;
  status?: UserStatus;
  baseSalary?: number | null;
  annualLeaveBalance?: number | null;
}
