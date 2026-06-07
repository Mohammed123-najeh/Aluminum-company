function resolveApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '').trim();
  // Empty string in .env is not null — treat as unset (otherwise BASE becomes "/api" and hits the Vite dev server by mistake).
  if (!raw) {
    return import.meta.env.DEV ? '/api' : 'http://localhost:8000/api';
  }
  const withoutApi = raw.replace(/\/api$/i, '');
  return `${withoutApi}/api`;
}

const BASE = resolveApiBase();

function parseJsonSafe(text: string): unknown {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      'Cannot reach the API server. Check that the backend is running and VITE_API_BASE_URL matches its URL.',
    );
  }

  if (res.status === 204) return null as T;

  const text = await res.text();
  const data = parseJsonSafe(text);

  if (!res.ok) {
    const msgFromBody =
      data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : null;
    const firstValidation =
      data && typeof data === 'object' && 'errors' in data && (data as { errors: Record<string, string[]> }).errors
        ? Object.values((data as { errors: Record<string, string[]> }).errors).flat()[0]
        : null;
    const baseMsg = (msgFromBody ?? firstValidation ?? text.slice(0, 120)) || 'Request failed';
    const hint =
      typeof msgFromBody === 'string' &&
      msgFromBody.includes('could not be found') &&
      import.meta.env.DEV
        ? ' Run Laravel on port 8001: `php artisan serve --port=8001` (see frontend/.env.development), then restart `npm run dev`. Free port 8000 if you still use it: `netstat -ano | findstr :8000`.'
        : '';
    throw new Error(baseMsg + hint);
  }

  if (data === null) {
    throw new Error(text.slice(0, 200) || 'Invalid JSON from server');
  }

  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'employee';
  employeeType?: 'accountant' | 'sales' | 'hr' | null;
  mainJob?: string | null;
  hourlyRate?: string | null;
  annualLeaveBalance?: string | null;
  supervisorId?: string | null;
  status: 'active' | 'suspended';
  lastLogin?: string | null;
  createdAt: string;
  employeeNumber?: string | null;
  nationality?: string | null;
  phone?: string | null;
  hireDate?: string | null;
  contractType?: string | null;
  contractDuration?: string | null;
  department?: string | null;
};

export type LoginResponse = { token: string; user: ApiUser };

export const auth = {
  login: (email: string, password: string) =>
    request<LoginResponse>('POST', '/login', { email, password }),

  logout: (token: string) =>
    request<{ message: string }>('POST', '/logout', undefined, token),

  me: (token: string) => request<ApiUser>('GET', '/me', undefined, token),

  /** Request a 6-digit reset code by email. Always resolves with a generic message. */
  forgotPassword: (email: string) =>
    request<{ message: string; expiresInMinutes: number }>('POST', '/password/forgot', { email }),

  /** Check whether a code is currently valid (without consuming it). */
  verifyPasswordCode: (email: string, code: string) =>
    request<{ ok: true }>('POST', '/password/verify', { email, code }),

  /** Consume the code and set a new password. */
  resetPassword: (email: string, code: string, password: string, passwordConfirmation: string) =>
    request<{ message: string }>('POST', '/password/reset', {
      email,
      code,
      password,
      password_confirmation: passwordConfirmation,
    }),
};

// ── In-app notifications ─────────────────────────────────────────────────────

export type ApiUserNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, string>;
  readAt: string | null;
  createdAt: string;
};

export const notificationsApi = {
  list: (token: string, opts?: { unreadOnly?: boolean }) => {
    const q = opts?.unreadOnly ? '?unread_only=1' : '';
    return request<ApiUserNotification[]>('GET', `/notifications${q}`, undefined, token);
  },

  unreadCount: (token: string) =>
    request<{ count: number }>('GET', '/notifications/unread-count', undefined, token),

  markRead: (id: string, token: string) =>
    request<ApiUserNotification>('PATCH', `/notifications/${id}/read`, {}, token),

  markAllRead: (token: string) =>
    request<{ ok: boolean }>('POST', '/notifications/read-all', {}, token),
};

// ── Users ─────────────────────────────────────────────────────────────────────

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role: 'supervisor' | 'employee';
  employee_type?: string | null;
  main_job?: string | null;
  supervisor_id?: string | null;
  hourly_rate?: number | null;
  annual_leave_balance?: number | null;
};

export type UpdateUserPayload = {
  name?: string;
  email?: string;
  role?: 'supervisor' | 'employee';
  employee_type?: string | null;
  main_job?: string | null;
  supervisor_id?: string | null;
  status?: 'active' | 'suspended';
  hourly_rate?: number | null;
  annual_leave_balance?: number | null;
};

export const usersApi = {
  list: (token: string) =>
    request<ApiUser[]>('GET', '/users', undefined, token),

  create: (payload: CreateUserPayload, token: string) =>
    request<ApiUser>('POST', '/users', payload, token),

  update: (id: string, payload: UpdateUserPayload, token: string) =>
    request<ApiUser>('PUT', `/users/${id}`, payload, token),

  delete: (id: string, token: string) =>
    request<null>('DELETE', `/users/${id}`, undefined, token),

  toggleStatus: (id: string, token: string) =>
    request<ApiUser>('PATCH', `/users/${id}/toggle-status`, undefined, token),

  assignSupervisor: (employeeId: string, supervisorId: string | null, token: string) =>
    request<ApiUser>('PATCH', `/users/${employeeId}/assign-supervisor`, { supervisor_id: supervisorId }, token),
};

// ── My employees (supervisor) ─────────────────────────────────────────────

export const myEmployeesApi = {
  list: (token: string) =>
    request<ApiUser[]>('GET', '/my-employees', undefined, token),
};

// ── Messages ───────────────────────────────────────────────────────────────

export type ApiMessage = {
  id: string;
  senderId: string;
  senderName?: string | null;
  receiverId: string;
  receiverName?: string | null;
  body: string;
  taskId?: string | null;
  taskTitle?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export type ApiMessageThreadSummary = {
  id: string;
  peerId: string;
  peerName: string | null;
  peerRole?: string | null;
  receiverId: string;
  receiverName: string | null;
  lastPreview: string;
  lastAt: string;
  unreadCount?: number;
};

/** Employee inbox: threads grouped by sender (supervisor) */
export type ApiMessageInboxSummary = {
  id: string;
  peerId: string;
  peerName: string | null;
  peerRole?: string | null;
  senderId: string;
  senderName: string | null;
  lastPreview: string;
  lastAt: string;
  unreadCount?: number;
};

export type CreateMessagePayload = { receiver_id?: string; receiver_ids?: string[]; body: string; task_id?: string | null };

export type ApiMessageContact = {
  id: string;
  name: string;
  role: 'admin' | 'supervisor' | 'employee';
  employeeType: string | null;
  mainJob: string | null;
  relation: 'admin' | 'supervisor' | 'teammate' | 'team' | 'hr' | 'finance' | 'staff';
};

export const messagesApi = {
  list: (token: string, receiverId?: string) =>
    request<ApiMessage[] | ApiMessageThreadSummary[]>(
      'GET',
      receiverId ? `/messages?receiver_id=${receiverId}` : '/messages',
      undefined,
      token,
    ),
  contacts: (token: string) =>
    request<ApiMessageContact[]>('GET', '/messages/contacts', undefined, token),
  send: (payload: CreateMessagePayload, token: string) => {
    const body: Record<string, unknown> = {
      body: payload.body,
    };
    if (payload.receiver_id) body.receiver_id = payload.receiver_id;
    if (payload.receiver_ids) body.receiver_ids = payload.receiver_ids;
    if (payload.task_id) {
      body.task_id = payload.task_id;
    }
    return request<ApiMessage | ApiMessage[]>('POST', '/messages', body, token);
  },
};

// ── Tasks ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type ApiTaskAssignee = { id: string; name: string; email: string };

export type ApiTaskOrderItem = {
  profileCode: string;
  profileName: string;
  categoryCode?: string | null;
  categoryName?: string | null;
  colorCode: string;
  colorName: string;
  quantity: number;
};

export type ApiTaskAttachment = {
  id: string;
  name: string;
  url: string;
};

export type ApiTask = {
  id: string;
  supervisorId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  /** Set when status becomes completed (ISO). */
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  dueDate: string | null;
  orderReference: string | null;
  /** End customer / client name (set by supervisor when creating the task). */
  customerName?: string | null;
  /** Ad-hoc phone when no registered client is linked. */
  customerPhone?: string | null;
  /** Linked registered client (supervisor’s client list). */
  clientId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  orderId: string | null;
  order?: {
    id: string;
    status: string;
    customerReference: string | null;
    totalAmount: number | null;
    amountPaid: number;
    balanceDue: number | null;
    paymentStatus: 'paid' | 'partial' | 'unpaid' | 'unknown';
    items: ApiTaskOrderItem[];
  } | null;
  attachments?: ApiTaskAttachment[];
  assignees: ApiTaskAssignee[];
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskPayload = {
  assignee_ids: string[];
  title: string;
  description?: string | null;
  due_date?: string | null;
  order_reference?: string | null;
  /** Customer / client this task is for (shown on receipts). */
  customer_name?: string | null;
  customer_phone?: string | null;
  client_id?: string | null;
  order_id?: string | null;
  /** Order total. When set without an order_id, the backend auto-creates an Order
   *  so the money side flows through the accountant's Orders + Receipts pipeline. */
  total_amount?: number | null;
  /** How much the customer has already paid against the order total. */
  amount_paid?: number | null;
};

export type UpdateTaskPayload = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  due_date?: string | null;
  order_reference?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  client_id?: string | null;
  order_id?: string | null;
  assignee_ids?: string[];
};

// ── Admin analytics ────────────────────────────────────────────────────────

export type ApiAdminAnalytics = {
  generatedAt: string;
  users: {
    totalNonAdmin: number;
    supervisors: number;
    employees: number;
    active: number;
    suspended: number;
    employeesWithoutSupervisor: number;
    employeeTypes: {
      accountant: number;
      sales: number;
      hr: number;
      unset: number;
    };
  };
  supervisorTeams: Array<{
    id: string;
    name: string;
    email: string;
    teamSize: number;
    activeEmployees: number;
  }>;
  tasks: {
    total: number;
    overdue: number;
    byStatus: Record<TaskStatus, number>;
  };
  tasksBySupervisor: Array<{
    supervisorId: string;
    supervisorName: string;
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  }>;
  orders: {
    total: number;
    byStatus: Record<string, number>;
  };
  messages: {
    total: number;
    last7Days: number;
  };
  storehouse: {
    inventoryRows: number;
    totalQuantityUnits: number;
  };
  ai: {
    conversations: number;
    aiMessages: number;
  };
  financeKpi:
    | {
        mode: 'fixed';
        revenueToday: { value: number; prev: number; deltaPct: number | null };
        revenueMonth: { value: number; prev: number; deltaPct: number | null };
        expenseToday: { value: number; prev: number; deltaPct: number | null };
        expenseMonth: { value: number; prev: number; deltaPct: number | null };
        netToday: { value: number; prev: number; deltaPct: number | null };
        netMonth: { value: number; prev: number; deltaPct: number | null };
        unpaidOrdersCount: number;
      }
    | {
        mode: 'range';
        range: {
          from: string;
          to: string;
          days: number;
          revenue: { value: number; prev: number; deltaPct: number | null };
          expense: { value: number; prev: number; deltaPct: number | null };
          net: { value: number; prev: number; deltaPct: number | null };
        };
        unpaidOrdersCount: number;
      };
  financial?: {
    receiptsAnalyzedAt: string;
    completedReceiptsCount: number;
    totalBilledAllTime: number;
    totalPaidAllTime: number;
    totalOutstandingAllTime: number;
    byPaymentStatus: Record<string, number>;
    overdueReceiptsCount: number;
    overdueOutstanding: number;
    customersWithOutstandingCount: number;
    today: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
    thisMonth: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
    thisYear: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
    dueNextMonth: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
    topOutstandingCustomers: Array<{ customerLabel: string; receiptCount: number; outstanding: number }>;
  };
};

export const adminAnalyticsApi = {
  get: (token: string, range?: { from: string; to: string }) => {
    const q = range ? `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : '';
    return request<ApiAdminAnalytics>('GET', `/admin/analytics${q}`, undefined, token);
  },
};

export type ApiReceiptPaymentAnalytics = {
  generatedAt: string;
  today: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
  thisMonth: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
  thisYear: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
  allTime: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
  byPaymentStatus: Record<string, number>;
  overdueCount: number;
  overdueOutstanding: number;
  dueNextMonth: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
  topOutstandingCustomers: Array<{ customerLabel: string; receiptCount: number; outstanding: number }>;
  customersWithOutstandingCount?: number;
};

export const receiptPaymentAnalyticsApi = {
  get: (token: string) =>
    request<ApiReceiptPaymentAnalytics>('GET', '/receipt-payment-analytics', undefined, token),
};

export const tasksApi = {
  list: (token: string, params?: { assignee_id?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.assignee_id) search.set('assignee_id', params.assignee_id);
    if (params?.status) search.set('status', params.status);
    const q = search.toString();
    return request<ApiTask[]>('GET', q ? `/tasks?${q}` : '/tasks', undefined, token);
  },
  create: (payload: CreateTaskPayload, token: string) =>
    request<ApiTask>('POST', '/tasks', payload, token),
  update: (id: string, payload: UpdateTaskPayload, token: string) => {
    const body: Record<string, unknown> = {};
    if (payload.title !== undefined) body.title = payload.title;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.status !== undefined) body.status = payload.status;
    if (payload.due_date !== undefined) body.due_date = payload.due_date;
    if (payload.order_reference !== undefined) body.order_reference = payload.order_reference;
    if (payload.customer_name !== undefined) body.customer_name = payload.customer_name;
    if (payload.customer_phone !== undefined) body.customer_phone = payload.customer_phone;
    if (payload.client_id !== undefined) body.client_id = payload.client_id;
    if (payload.order_id !== undefined) body.order_id = payload.order_id;
    if (payload.assignee_ids !== undefined) body.assignee_ids = payload.assignee_ids;
    return request<ApiTask>('PATCH', `/tasks/${id}`, body, token);
  },
  delete: (id: string, token: string) => request<null>('DELETE', `/tasks/${id}`, undefined, token),
  cancel: (id: string, reason: string | null, token: string) =>
    request<{ task: ApiTask; refundedAmount: number }>(
      'POST',
      `/tasks/${id}/cancel`,
      reason ? { reason } : {},
      token,
    ),
  uploadAttachment: async (taskId: string, file: File, token: string | null): Promise<ApiTask> => {
    if (!token) throw new Error('Not authenticated');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/tasks/${taskId}/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message ?? 'Upload failed');
    return data as ApiTask;
  },
  deleteAttachment: (taskId: string, attachmentId: string, token: string) =>
    request<ApiTask>('DELETE', `/tasks/${taskId}/attachments/${attachmentId}`, undefined, token),
};

// ── Storehouse ─────────────────────────────────────────────────────────────

export type ApiCategory = {
  id: number;
  categoryCode: string;
  categoryName: string;
  categoryNameAr: string | null;
  sortOrder: number;
};

export type ApiProfile = {
  id: number;
  profileId: string;
  categoryCode: string;
  categoryName?: string;
  name: string;
  thicknessMm: number | null;
  weightKgPerM: number | null;
  usage: string | null;
};

export type ApiColor = {
  id: number;
  colorCode: string;
  name: string;
  type: string | null;
};

export type ApiInventoryItem = {
  id: number;
  profileId: number;
  profileCode: string;
  profileName: string;
  categoryCode?: string | null;
  categoryName?: string | null;
  thicknessMm?: number | null;
  weightKgPerM?: number | null;
  usage?: string | null;
  colorCode: string;
  colorName: string;
  quantity: number;
  /** List price per unit (same formula as sales), when returned by API. */
  unitPrice?: number | null;
};

export type CreateInventoryPayload = {
  profile_id?: number | null;
  color_code?: string | null;
  quantity: number;
  unit_price?: number | null;
  product_code?: string | null;
  product_name?: string | null;
  category_code?: string | null;
  thickness_mm?: number | null;
  weight_kg_per_m?: number | null;
  usage?: string | null;
  color_name?: string | null;
  color_type?: string | null;
};

export const storehouseApi = {
  categories: (token: string) =>
    request<ApiCategory[]>('GET', '/storehouse/categories', undefined, token),
  profiles: (token: string, categoryCode?: string) =>
    request<ApiProfile[]>(
      'GET',
      categoryCode ? `/storehouse/profiles?category_code=${categoryCode}` : '/storehouse/profiles',
      undefined,
      token,
    ),
  profileUpdate: (id: number, payload: { name: string }, token: string) =>
    request<ApiProfile>('PATCH', `/storehouse/profiles/${id}`, payload, token),
  colors: (token: string) =>
    request<ApiColor[]>('GET', '/storehouse/colors', undefined, token),
  inventory: (token: string, params?: { profile_id?: number; color_code?: string }) => {
    const search = new URLSearchParams();
    if (params?.profile_id) search.set('profile_id', String(params.profile_id));
    if (params?.color_code) search.set('color_code', params.color_code);
    const q = search.toString();
    return request<ApiInventoryItem[]>('GET', q ? `/storehouse/inventory?${q}` : '/storehouse/inventory', undefined, token);
  },
  inventoryCreate: (payload: CreateInventoryPayload, token: string) =>
    request<ApiInventoryItem>('POST', '/storehouse/inventory', payload, token),
  inventoryUpdate: (
    id: number,
    payload: { profile_id: number; color_code: string; quantity: number; unit_price?: number | null },
    token: string,
  ) => request<ApiInventoryItem>('PATCH', `/storehouse/inventory/${id}`, payload, token),
  inventoryDelete: (id: number, token: string) =>
    request<null>('DELETE', `/storehouse/inventory/${id}`, undefined, token),
};

// ── Orders ─────────────────────────────────────────────────────────────────

export type ApiOrderItem = {
  id: string;
  profileId: string;
  profileCode: string;
  profileName: string;
  categoryCode?: string | null;
  categoryName?: string | null;
  colorCode: string;
  colorName: string;
  quantity: number;
  notes?: string | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  isCancelled?: boolean;
  cancelledAmount?: number;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
};

export type ApiChequeDetails = {
  bank: string | null;
  number: string | null;
  holder: string | null;
  amount: number | null;
  issueDate: string | null;
  dueDate: string | null;
  status: string | null;
};

export type ApiOrderPayment = {
  id: string;
  amount: number;
  paidAt: string;
  recordedById: string | null;
  recordedByName: string | null;
  note: string | null;
  method: string | null;
  cheque: ApiChequeDetails | null;
  createdAt: string;
};

export type ApiOrder = {
  id: string;
  creatorId: string;
  creatorName: string;
  supervisorId: string | null;
  supervisorName: string | null;
  status: string;
  customerReference: string | null;
  totalAmount?: number | null;
  amountPaid?: number | null;
  balanceDue?: number | null;
  currency?: string;
  receiptNumber?: string | null;
  cancellationType?: 'full' | 'partial' | null;
  cancelledAt?: string | null;
  cancelledById?: string | null;
  cancelledByName?: string | null;
  cancellationReason?: string | null;
  cancelledAmount?: number;
  refundedAmount?: number;
  clientId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  taskId?: string | null;
  taskTitle?: string | null;
  /** Customer name from the linked task (supervisor-entered). */
  taskCustomerName?: string | null;
  /** paid | partial | unpaid | unknown */
  paymentStatus?: string;
  paymentDueAt?: string | null;
  paymentNotes?: string | null;
  items: ApiOrderItem[];
  createdAt: string;
  updatedAt: string;
};

/** Sales catalog row with list price per unit (deterministic on server). */
export type ApiInventoryOffer = {
  inventoryId: number;
  profileId: number;
  profileCode: string;
  profileName: string;
  categoryCode?: string | null;
  categoryName?: string | null;
  usage: string | null;
  colorCode: string;
  colorName: string;
  quantity: number;
  unitPrice: number;
};

export type ApiFulfillTaskResponse = {
  orderId: string;
  receiptNumber: string;
  totalAmount: number;
  amountPaid?: number;
  balanceDue?: number;
  paymentStatus?: string;
  paymentDueAt?: string | null;
  currency: string;
  customerReference: string | null;
  taskId: string;
  lines: Array<{
    profileName: string;
    colorName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  issuedAt: string;
};

export const salesApi = {
  inventoryOffers: (token: string) =>
    request<ApiInventoryOffer[]>('GET', '/sales/inventory-offers', undefined, token),
  fulfillTask: (
    payload: {
      task_id: string;
      customer_reference?: string | null;
      items: Array<{ inventory_id: number; quantity: number }>;
      initial_amount_paid?: number;
      payment_due_at?: string | null;
      payment_notes?: string | null;
    },
    token: string,
  ) => request<ApiFulfillTaskResponse>('POST', '/sales/fulfill-task', payload, token),
};

export type CreateOrderPayload = {
  customer_reference?: string | null;
  /** When set, the order is linked to this task (assignee or owning supervisor only). */
  task_id?: string | null;
  items: Array<{
    profile_id: number;
    color_code: string;
    quantity: number;
    notes?: string | null;
  }>;
};

export type UpdateOrderPayload = {
  customer_reference?: string | null;
  status?: string;
  items?: CreateOrderPayload['items'];
};

export type CancelOrderPayload = {
  type: 'full' | 'partial';
  item_ids?: string[];
  reason?: string | null;
};

// ── AI (OpenAI via Laravel — key stays on server) ────────────────────────────

export type AiTaskTextField = 'title' | 'description';
export type AiTaskTextMode = 'improve' | 'shorten' | 'translate_en' | 'translate_ar';

export type ApiAiConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiAiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type ApiAiSharedConversation = {
  conversationId: string;
  title: string;
  ownerName: string;
  ownerId: string | null;
  messages: ApiAiMessage[];
};

export const aiApi = {
  taskText: (
    token: string,
    payload: { field: AiTaskTextField; text: string; mode: AiTaskTextMode },
  ) => request<{ text: string }>('POST', '/ai/task-text', payload, token),

  conversations: (token: string) =>
    request<ApiAiConversation[]>('GET', '/ai/conversations', undefined, token),

  conversationMessages: (conversationId: string, token: string) =>
    request<{ conversationId: string; messages: ApiAiMessage[] }>(
      'GET',
      `/ai/conversations/${conversationId}/messages`,
      undefined,
      token,
    ),

  deleteConversation: (conversationId: string, token: string) =>
    request<null>('DELETE', `/ai/conversations/${conversationId}`, undefined, token),

  shareConversation: (conversationId: string, token: string) =>
    request<{ shareToken: string }>('POST', `/ai/conversations/${conversationId}/share`, undefined, token),

  sharedConversation: (shareToken: string, token: string) =>
    request<ApiAiSharedConversation>('GET', `/ai/shared/${encodeURIComponent(shareToken)}`, undefined, token),

  importShared: (token: string, shareToken: string) =>
    request<{ conversationId: string }>('POST', '/ai/conversations/import-shared', { share_token: shareToken }, token),

  chat: (
    token: string,
    payload: { conversation_id?: string | null; message: string },
  ) => request<{ conversationId: string; reply: string }>('POST', '/ai/chat', payload, token),

  summarizeToday: (
    token: string,
    payload?: { conversation_id?: string | null },
  ) => request<{ conversationId: string; reply: string }>('POST', '/ai/summarize-today', payload ?? {}, token),
};

export const ordersApi = {
  list: (
    token: string,
    params?: { receipts_only?: boolean; payment_status?: 'paid' | 'partial' | 'unpaid' | 'unknown' },
  ) => {
    const search = new URLSearchParams();
    if (params?.receipts_only) search.set('receipts_only', '1');
    if (params?.payment_status) search.set('payment_status', params.payment_status);
    const q = search.toString();
    return request<ApiOrder[]>('GET', q ? `/orders?${q}` : '/orders', undefined, token);
  },
  create: (payload: CreateOrderPayload, token: string) =>
    request<ApiOrder>('POST', '/orders', payload, token),
  show: (id: string, token: string) =>
    request<ApiOrder>('GET', `/orders/${id}`, undefined, token),
  update: (id: string, payload: UpdateOrderPayload, token: string) =>
    request<ApiOrder>('PUT', `/orders/${id}`, payload, token),
  updatePayment: (
    id: string,
    token: string,
    body: {
      amount_paid: number;
      payment_due_at?: string | null;
      payment_notes?: string | null;
    },
  ) => request<ApiOrder>('PATCH', `/orders/${id}/payment`, body, token),
  listPayments: (id: string, token: string) =>
    request<ApiOrderPayment[]>('GET', `/orders/${id}/payments`, undefined, token),
  addPayment: (
    id: string,
    token: string,
    body: {
      amount: number;
      paid_at?: string | null;
      note?: string | null;
      method?: 'cash' | 'transfer' | 'check' | 'card' | null;
      cheque_bank?: string | null;
      cheque_number?: string | null;
      cheque_holder?: string | null;
      cheque_amount?: number | null;
      cheque_issue_date?: string | null;
      cheque_due_date?: string | null;
      cheque_status?: 'pending' | 'cleared' | 'bounced' | 'cancelled' | null;
    },
  ) => request<ApiOrder & { lastPayment?: ApiOrderPayment }>('POST', `/orders/${id}/payments`, body, token),
  updateReceiptMeta: (id: string, token: string, body: { customer_reference?: string | null }) =>
    request<ApiOrder>('PATCH', `/orders/${id}/receipt-meta`, body, token),
  cancel: (id: string, payload: CancelOrderPayload, token: string) =>
    request<ApiOrder>('POST', `/orders/${id}/cancel`, payload, token),
};

// ── Clients (supervisor) ────────────────────────────────────────────────────

export type ApiClientListAnalytics = {
  orderCount: number;
  totalPurchases: number;
  totalPaid: number;
  balanceDue: number;
  lastOrderAt: string | null;
};

export type ApiClient = {
  id: string;
  supervisorId: string | null;
  supervisorName?: string | null;
  source?: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on the list endpoint; absent on the detail endpoint's client object. */
  analytics?: ApiClientListAnalytics;
};

export type ApiClientOrderItem = {
  id: string;
  profileCode: string | null;
  profileName: string | null;
  categoryName: string | null;
  colorCode: string | null;
  colorName: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  notes: string | null;
};

export type ApiClientOrderPayment = {
  id: string;
  amount: number;
  paidAt: string;
  recordedById: string | null;
  recordedByName?: string | null;
  note: string | null;
  createdAt: string;
};

export type ApiClientOrder = {
  id: string;
  status: string;
  receiptNumber: string | null;
  customerReference: string | null;
  totalAmount: number | null;
  amountPaid: number;
  balanceDue: number | null;
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'unknown';
  paymentDueAt: string | null;
  paymentNotes: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  creatorName?: string | null;
  taskTitle?: string | null;
  items: ApiClientOrderItem[];
  payments: ApiClientOrderPayment[];
};

export type ApiClientTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  orderId: string | null;
  orderStatus: string | null;
  totalAmount: number | null;
  amountPaid: number;
  balanceDue: number | null;
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'unknown';
  assignees: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
};

export type ApiClientDetailResponse = {
  client: ApiClient;
  analytics: {
    orderCount: number;
    totalOrderCount: number;
    totalPurchases: number;
    totalPaid: number;
    balanceDue: number;
    unitsPurchased: number;
    lastOrderAt: string | null;
    lastPaymentAt: string | null;
  };
  orders: ApiClientOrder[];
  tasks: ApiClientTask[];
};

export const clientsApi = {
  list: (token: string, q?: string) => {
    const search = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return request<ApiClient[]>('GET', `/clients${search}`, undefined, token);
  },
  create: (
    payload: { name: string; phone?: string | null; email?: string | null; notes?: string | null },
    token: string,
  ) => request<ApiClient>('POST', '/clients', payload, token),
  get: (id: string, token: string) => request<ApiClientDetailResponse>('GET', `/clients/${id}`, undefined, token),
  update: (
    id: string,
    payload: { name?: string; phone?: string | null; email?: string | null; notes?: string | null },
    token: string,
  ) => request<ApiClient>('PATCH', `/clients/${id}`, payload, token),
  delete: (id: string, token: string) => request<null>('DELETE', `/clients/${id}`, undefined, token),
};

// ── HR: leave & salary requests ─────────────────────────────────────────────

export type ApiLeaveRequest = {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  supervisorId?: string | null;
  /** present while status is `pending` */
  workflowStep?: 'supervisor' | 'hr' | null;
  type: 'holiday' | 'sick';
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decidedById?: string | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  createdAt: string;
};

export type ApiSalaryRequest = {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  currentSalarySnapshot?: string | null;
  requestedMonthlySalary: string;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decidedById?: string | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  approvedMonthlySalary?: string | null;
  createdAt: string;
};

export type ApiHrDirectoryRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeType?: string | null;
  mainJob?: string | null;
  status: string;
  hourlyRate?: string | null;
  annualLeaveBalance?: string | null;
  supervisorId?: string | null;
  supervisorName?: string | null;
  approvedHolidayDaysYtd: number;
  approvedSickDaysYtd: number;
  pendingLeaveCount: number;
  pendingSalaryCount: number;
};

export type ApiHrAnalytics = {
  pendingLeaveRequests: number;
  pendingSalaryRequests: number;
  pendingDebitRequests?: number;
  approvedLeaveCountThisMonth: number;
  holidayDaysApprovedThisMonth: number;
  sickDaysApprovedThisMonth: number;
  leaveByTypeYear: Record<string, { days: number; count: number }>;
  activeEmployeesCount: number;
  averageBaseSalary: number | null;
  recentLeaveActivity: Array<{
    id: string;
    employeeName?: string | null;
    type: string;
    daysCount: number;
    status: string;
    createdAt: string;
  }>;
  recentDebitActivity?: Array<{
    id: string;
    employeeName?: string | null;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  directory: ApiHrDirectoryRow[];
};

export type ApiDebitRequest = {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  amount: string;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decidedById?: string | null;
  decidedByName?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  createdAt: string;
};

export type ApiHrEmployeeDetail = {
  user: ApiUser & { supervisorName?: string | null };
  leaveRequests: ApiLeaveRequest[];
  salaryRequests: ApiSalaryRequest[];
  approvedLeaveDaysYtd: { holiday: number; sick: number };
  approvedLeaveDaysAllTime: { holiday: number; sick: number };
};

export const leaveRequestsApi = {
  mine: (token: string) => request<ApiLeaveRequest[]>('GET', '/leave-requests/mine', undefined, token),

  listHr: (token: string, qs?: { status?: string; type?: string }) => {
    const p = new URLSearchParams();
    if (qs?.status) p.set('status', qs.status);
    if (qs?.type) p.set('type', qs.type);
    const q = p.toString() ? `?${p.toString()}` : '';
    return request<ApiLeaveRequest[]>('GET', `/leave-requests${q}`, undefined, token);
  },

  listSupervisorQueue: (token: string, type?: 'holiday' | 'sick') => {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    const qs = p.toString();
    return request<ApiLeaveRequest[]>('GET', `/leave-requests/supervisor-queue${qs ? `?${qs}` : ''}`, undefined, token);
  },

  create: (
    token: string,
    body: { type: 'holiday' | 'sick'; start_date: string; end_date: string; reason?: string | null },
  ) => request<ApiLeaveRequest>('POST', '/leave-requests', body, token),

  decide: (
    token: string,
    id: string,
    body: { status: 'approved' | 'rejected'; decision_note?: string | null },
  ) => request<ApiLeaveRequest>('PATCH', `/leave-requests/${id}/decide`, body, token),

  supervisorDecide: (
    token: string,
    id: string,
    body: { decision: 'approved' | 'rejected'; decision_note?: string | null },
  ) => request<ApiLeaveRequest>('PATCH', `/leave-requests/${id}/supervisor-decide`, body, token),

  cancel: (token: string, id: string) =>
    request<ApiLeaveRequest>('PATCH', `/leave-requests/${id}/cancel`, {}, token),
};

export const salaryRequestsApi = {
  mine: (token: string) => request<ApiSalaryRequest[]>('GET', '/salary-requests/mine', undefined, token),

  listHr: (token: string, qs?: { status?: string }) => {
    const p = new URLSearchParams();
    if (qs?.status) p.set('status', qs.status);
    const q = p.toString() ? `?${p.toString()}` : '';
    return request<ApiSalaryRequest[]>('GET', `/salary-requests${q}`, undefined, token);
  },

  create: (
    token: string,
    body: { requested_monthly_salary: number; reason?: string | null },
  ) => request<ApiSalaryRequest>('POST', '/salary-requests', body, token),

  decide: (
    token: string,
    id: string,
    body: {
      status: 'approved' | 'rejected';
      approved_monthly_salary?: number | null;
      decision_note?: string | null;
    },
  ) => request<ApiSalaryRequest>('PATCH', `/salary-requests/${id}/decide`, body, token),

  cancel: (token: string, id: string) =>
    request<ApiSalaryRequest>('PATCH', `/salary-requests/${id}/cancel`, {}, token),
};

export const debitRequestsApi = {
  mine: (token: string) => request<ApiDebitRequest[]>('GET', '/debit-requests/mine', undefined, token),

  listHr: (token: string, qs?: { status?: string }) => {
    const p = new URLSearchParams();
    if (qs?.status) p.set('status', qs.status);
    const q = p.toString() ? `?${p.toString()}` : '';
    return request<ApiDebitRequest[]>('GET', `/debit-requests${q}`, undefined, token);
  },

  create: (token: string, body: { amount: number; reason?: string | null }) =>
    request<ApiDebitRequest>('POST', '/debit-requests', body, token),

  decide: (
    token: string,
    id: string,
    body: { status: 'approved' | 'rejected'; decision_note?: string | null },
  ) => request<ApiDebitRequest>('PATCH', `/debit-requests/${id}/decide`, body, token),

  cancel: (token: string, id: string) =>
    request<ApiDebitRequest>('PATCH', `/debit-requests/${id}/cancel`, {}, token),
};

export const hrAnalyticsApi = {
  get: (token: string) => request<ApiHrAnalytics>('GET', '/hr/analytics', undefined, token),

  employeeDetail: (userId: string, token: string) =>
    request<ApiHrEmployeeDetail>('GET', `/hr/users/${userId}/hr-detail`, undefined, token),
};

// ── Accountant finance & admin approvals ─────────────────────────────────────

export type ApiAccountantCashFlow = {
  period: string;
  range: { from: string; to: string };
  totals: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
  byPaymentStatus: Record<string, number>;
  overdueCount: number;
  overdueOutstanding: number;
  dueNextMonth: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
  topOutstandingCustomers: Array<{ customerLabel: string; receiptCount: number; outstanding: number }>;
  customersWithOutstandingCount: number;
  generatedAt: string;
};

export type ApiAccountantOverview = {
  generatedAt: string;
  totals: { count: number; totalBilled: number; totalPaid: number; totalOutstanding: number };
  byPaymentStatus: Record<string, number>;
  overdueCount: number;
  overdueOutstanding: number;
  clientsCount: number;
  receiptsCount: number;
  topOutstandingCustomers: Array<{ customerLabel: string; receiptCount: number; outstanding: number }>;
};

export type ApiAccountantClient = {
  id: string;
  supervisorId?: string | null;
  supervisorName?: string | null;
  source?: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  orderCount: number;
  totalPurchases: number;
  totalPaid: number;
  balanceDue: number;
  lastPaymentAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ApiAccountantManualReceipt = {
  id: string;
  receiptNumber: string | null;
  clientId: string | null;
  clientName: string | null;
  customerReference: string | null;
  totalAmount: number | null;
  amountPaid: number | null;
  balanceDue: number | null;
  paymentStatus: string;
  paymentDueAt: string | null;
  paymentNotes: string | null;
  currency: string;
  items: Array<{ id: string; description: string | null; quantity: number; unitPrice: number | null; lineTotal: number | null }>;
  createdAt: string;
  updatedAt: string;
};

export type ApiAccountantAgingOrder = {
  id: string;
  receiptNumber: string | null;
  clientId: string | null;
  clientName: string | null;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentDueAt: string | null;
  daysOverdue: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'unknown';
  updatedAt: string;
};

export type ApiAccountantAgingBucket = {
  key: 'notDue' | 'd0_30' | 'd31_60' | 'd61_90' | 'd90_plus';
  label: string;
  min: number | null;
  max: number | null;
  count: number;
  outstanding: number;
  orders: ApiAccountantAgingOrder[];
};

export type ApiAccountantAging = {
  generatedAt: string;
  buckets: ApiAccountantAgingBucket[];
  totals: { count: number; outstanding: number };
};

export type ApiAccountantTrend = {
  generatedAt: string;
  months: number;
  series: Array<{ month: string; billed: number; collected: number }>;
};

export type ApiAccountantDebitRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  amount: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export type ApiAccountantDebits = {
  generatedAt: string;
  totals: Record<'pending' | 'approved' | 'rejected' | 'cancelled', { count: number; amount: number }>;
  rows: ApiAccountantDebitRow[];
};

export const accountantFinanceApi = {
  overview: (token: string) =>
    request<ApiAccountantOverview>('GET', '/accountant/overview', undefined, token),

  cashFlow: (token: string, period: 'day' | 'week' | 'month' | 'year') =>
    request<ApiAccountantCashFlow>('GET', `/accountant/cash-flow?period=${encodeURIComponent(period)}`, undefined, token),

  aging: (token: string) =>
    request<ApiAccountantAging>('GET', '/accountant/aging', undefined, token),

  trend: (token: string, months = 6) =>
    request<ApiAccountantTrend>('GET', `/accountant/trend?months=${months}`, undefined, token),

  debits: (token: string) =>
    request<ApiAccountantDebits>('GET', '/accountant/debits', undefined, token),

  clients: (token: string, q?: string) => {
    const search = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return request<ApiAccountantClient[]>('GET', `/accountant/clients${search}`, undefined, token);
  },

  createClient: (
    token: string,
    body: { name: string; phone?: string | null; email?: string | null; notes?: string | null },
  ) => request<ApiAccountantClient>('POST', '/accountant/clients', body, token),

  updateClient: (
    token: string,
    id: string,
    body: { name?: string; phone?: string | null; email?: string | null; notes?: string | null },
  ) => request<ApiAccountantClient>('PATCH', `/accountant/clients/${id}`, body, token),

  manualReceipt: (
    token: string,
    body: {
      client_id: string;
      customer_reference?: string | null;
      items: Array<{ description: string; quantity: number; unit_price: number }>;
      amount_paid?: number;
      payment_due_at?: string | null;
      payment_notes?: string | null;
    },
  ) => request<ApiAccountantManualReceipt>('POST', '/accountant/manual-receipts', body, token),

  publishReport: (token: string, body: { period: string; note?: string | null }) =>
    request<ApiAdminSubmission>('POST', '/accountant/publish-report', body, token),
};

async function downloadBlob(path: string, token: string, filename: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
    });
  } catch {
    throw new Error('Cannot reach the API server.');
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = text.slice(0, 200);
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg || 'Download failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const accountantFinanceDownloads = {
  receiptReportPdf: (token: string, period: string) =>
    downloadBlob(`/accountant/receipt-report.pdf?period=${encodeURIComponent(period)}`, token, `receipt-report-${period}.pdf`),
};

export type ApiAdminSubmission = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  hasAttachment: boolean;
  metadata: Record<string, unknown>;
  status: string;
  submittedBy: { id: string; name: string; email: string } | null;
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export type ApiAdminApprovalsSummary = {
  pendingSalaryRequests: number;
  pendingSubmissions: number;
};

export const adminApprovalsApi = {
  summary: (token: string) =>
    request<ApiAdminApprovalsSummary>('GET', '/admin/approvals/summary', undefined, token),

  listSubmissions: (token: string, qs?: { status?: string; type?: string }) => {
    const p = new URLSearchParams();
    if (qs?.status) p.set('status', qs.status);
    if (qs?.type) p.set('type', qs.type);
    const q = p.toString() ? `?${p.toString()}` : '';
    return request<ApiAdminSubmission[]>('GET', `/admin/submissions${q}`, undefined, token);
  },

  decideSubmission: (
    token: string,
    id: string,
    body: { status: 'approved' | 'rejected'; decision_note?: string | null },
  ) => request<ApiAdminSubmission>('PATCH', `/admin/submissions/${id}/decide`, body, token),
};

export const submissionsApi = {
  mine: (token: string) => request<ApiAdminSubmission[]>('GET', '/my-submissions', undefined, token),

  create: async (token: string, form: FormData) => {
    const res = await fetch(`${BASE}/submissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: form,
    });
    const text = await res.text();
    const data = parseJsonSafe(text);
    if (!res.ok) {
      const msg =
        data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
          ? (data as { message: string }).message
          : text.slice(0, 120);
      throw new Error(msg || 'Request failed');
    }
    return data as ApiAdminSubmission;
  },

  downloadAttachment: (token: string, submissionId: string) =>
    downloadBlob(`/submissions/${submissionId}/attachment`, token, `submission-${submissionId}.pdf`),
};

// ── Attendance / payroll ────────────────────────────────────────────────────

export type ApiAttendanceLog = {
  id: string;
  userId: string;
  userName?: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  minutesWorked: number | null;
  hoursWorked: number | null;
  ipAddress: string | null;
};

export type ApiPayrollRow = {
  userId: string;
  userName: string;
  role: 'admin' | 'supervisor' | 'employee';
  employeeType: string | null;
  supervisorId: string | null;
  hourlyRate: number | null;
  totalMinutes: number;
  totalHours: number;
  computedEarnings: number | null;
  sessionsCount: number;
  lastClockInAt: string | null;
  lastClockOutAt: string | null;
};

export type ApiPayrollSummary = {
  from: string;
  to: string;
  rows: ApiPayrollRow[];
};

export type ApiAttendanceHeartbeat = {
  active?: boolean;
  workdayLimitMinutes?: number;
  sessionId?: string;
  sessionStartedAt?: string;
  minutesInSession?: number;
  continued?: boolean;
  minutesWorked?: number;
  openSession?: null;
};

export type ApiAttendanceToday = {
  date: string;
  workdayLimitMinutes?: number;
  minutesWorked: number;
  openSession: {
    id: string;
    startedAt: string;
    lastHeartbeatAt: string | null;
    minutesInSession: number;
  } | null;
};

export const attendanceApi = {
  list: (token: string, opts?: { userId?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (opts?.userId) qs.set('user_id', opts.userId);
    if (opts?.from) qs.set('from', opts.from);
    if (opts?.to) qs.set('to', opts.to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<ApiAttendanceLog[]>('GET', `/attendance${suffix}`, undefined, token);
  },
  summary: (token: string, opts?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (opts?.from) qs.set('from', opts.from);
    if (opts?.to) qs.set('to', opts.to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<ApiPayrollSummary>('GET', `/attendance/summary${suffix}`, undefined, token);
  },
  heartbeat: (token: string, body: { intent?: 'start' | 'heartbeat' } = {}) =>
    request<ApiAttendanceHeartbeat>('POST', '/attendance/heartbeat', body, token),
  today: (token: string) =>
    request<ApiAttendanceToday>('GET', '/attendance/today', undefined, token),
};

// ── Finance Center ───────────────────────────────────────────────────────────

export type ApiFinanceKpi = { value: number; prev: number };
export type ApiFinanceDashboard = {
  kpi: {
    revenue: ApiFinanceKpi;
    revenueToday: ApiFinanceKpi;
    expenses: ApiFinanceKpi;
    expensesToday: ApiFinanceKpi;
    net: ApiFinanceKpi;
    netToday: ApiFinanceKpi;
    receivables: ApiFinanceKpi;
    incompletePaymentCount: number;
  };
  trend: Array<{ month: string; revenue: number; expenses: number }>;
  byCategory: Array<{ categoryId: string; nameAr: string | null; nameEn: string | null; total: number }>;
  recent: ApiFinanceTransaction[];
  alerts: { overdueInvoices: number; pendingAdvances: number; debtsOver30: number };
};

export type ApiFinanceTransaction = {
  id: string;
  type: 'revenue' | 'payment';
  source: string;
  refType: string | null;
  refId: string | null;
  partyType: string | null;
  partyId: string | null;
  partyName: string | null;
  amount: string;
  method: string | null;
  referenceNo: string | null;
  date: string | null;
  notes: string | null;
  status: string;
  createdById: string | null;
  createdAt: string | null;
};

export type ApiSupplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  vatNo: string | null;
  notes: string | null;
  archived: boolean;
  createdAt: string | null;
};

export type ApiExpenseCategory = { id: string; nameAr: string; nameEn: string; ordering: number; archived: boolean };

export type ApiExpense = {
  id: string;
  categoryId: string;
  categoryNameAr: string | null;
  categoryNameEn: string | null;
  description: string;
  amount: string;
  date: string | null;
  supplierName: string | null;
  supplierId: string | null;
  paymentMethod: string | null;
  referenceNo: string | null;
  attachmentPath: string | null;
  submittedById: string | null;
  submittedByName: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
};

export type ApiCustomerInvoiceItem = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  ordering: number;
};

export type ApiCustomerInvoice = {
  id: string;
  number: string;
  date: string | null;
  dueDate: string | null;
  clientId: string | null;
  clientName: string | null;
  orderId: string | null;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  total: string;
  paid: string;
  balance: string;
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  notes: string | null;
  items: ApiCustomerInvoiceItem[];
  createdAt: string | null;
};

export type ApiSupplierInvoice = {
  id: string;
  number: string;
  date: string | null;
  dueDate: string | null;
  supplierId: string;
  supplierName: string | null;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  total: string;
  paid: string;
  balance: string;
  status: 'pending_approval' | 'approved' | 'paid' | 'rejected';
  notes: string | null;
  attachmentPath: string | null;
  rejectionReason: string | null;
  items: ApiCustomerInvoiceItem[];
  createdAt: string | null;
};

export type ApiVoucherAllocation = { invoiceId: string; amount: string };

export type ApiReceiptVoucher = {
  id: string;
  number: string;
  date: string | null;
  clientId: string | null;
  clientName: string | null;
  amount: string;
  method: string | null;
  referenceNo: string | null;
  notes: string | null;
  allocations: ApiVoucherAllocation[];
  createdAt: string | null;
};

/** Order-payment receipt — one row per OrderPayment, shown in the
 * Invoices panel as a printable receipt. */
export type ApiOrderPaymentReceipt = {
  id: string;
  number: string;
  date: string | null;
  orderId: string | null;
  orderRef: string | null;
  clientName: string | null;
  amount: number;
  method: string | null;
  referenceNo: string | null;
  note: string | null;
  recordedByName: string | null;
  cheque: ApiChequeDetails | null;
};

export type ApiPaymentVoucher = {
  id: string;
  number: string;
  date: string | null;
  payeeType: 'supplier' | 'employee' | 'other';
  payeeId: string | null;
  payeeName: string | null;
  amount: string;
  method: string | null;
  referenceNo: string | null;
  purpose: string | null;
  notes: string | null;
  allocations: ApiVoucherAllocation[];
  createdAt: string | null;
};

export type ApiAging = {
  receivables: {
    buckets: { current_0_30: number; d31_60: number; d61_90: number; d90_plus: number };
    rows: ApiCustomerInvoice[];
  };
  payables: {
    buckets: { current_0_30: number; d31_60: number; d61_90: number; d90_plus: number };
    rows: ApiSupplierInvoice[];
  };
};

export type ApiWorkScheduleSettings = {
  id: string;
  workStart: string;
  workEnd: string;
  graceMinutes: number;
  workDays: string[];
  lateDeductionPerMinute: string;
  absenceDeductionFormula: string;
  vatRate: string;
  employeeInsurancePct: string;
  employerInsurancePct: string;
};

function qs(params: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

export const financeCenterApi = {
  dashboard: (token: string) => request<ApiFinanceDashboard>('GET', '/finance/dashboard', undefined, token),

  // Suppliers
  listSuppliers: (token: string) => request<ApiSupplier[]>('GET', '/finance/suppliers', undefined, token),
  createSupplier: (token: string, body: Partial<ApiSupplier>) => request<ApiSupplier>('POST', '/finance/suppliers', body, token),
  updateSupplier: (token: string, id: string, body: Partial<ApiSupplier>) => request<ApiSupplier>('PATCH', `/finance/suppliers/${id}`, body, token),
  deleteSupplier: (token: string, id: string) => request<{ message: string }>('DELETE', `/finance/suppliers/${id}`, undefined, token),

  // Transactions (revenue + payments)
  listTransactions: (token: string, params: { type?: 'revenue' | 'payment'; from?: string; to?: string; source?: string } = {}) =>
    request<ApiFinanceTransaction[]>('GET', `/finance/transactions${qs(params)}`, undefined, token),
  createTransaction: (token: string, body: {
    type: 'revenue' | 'payment'; source: string; amount: number | string; date: string;
    party_type?: string; party_id?: string | number; party_name?: string;
    method?: string; reference_no?: string; notes?: string;
  }) => request<ApiFinanceTransaction>('POST', '/finance/transactions', body, token),
  updateTransaction: (token: string, id: string, body: Partial<{
    source: string; party_type: string; party_id: string | number; party_name: string;
    amount: number | string; method: string; reference_no: string; date: string;
    notes: string; status: string;
  }>) => request<ApiFinanceTransaction>('PATCH', `/finance/transactions/${id}`, body, token),
  deleteTransaction: (token: string, id: string) => request<{ message: string }>('DELETE', `/finance/transactions/${id}`, undefined, token),

  // Expense categories
  listExpenseCategories: (token: string) => request<ApiExpenseCategory[]>('GET', '/finance/expense-categories', undefined, token),
  createExpenseCategory: (token: string, body: { name_ar: string; name_en: string; ordering?: number }) =>
    request<ApiExpenseCategory>('POST', '/finance/expense-categories', body, token),
  updateExpenseCategory: (token: string, id: string, body: Partial<{ name_ar: string; name_en: string; ordering: number; archived: boolean }>) =>
    request<ApiExpenseCategory>('PATCH', `/finance/expense-categories/${id}`, body, token),
  deleteExpenseCategory: (token: string, id: string) =>
    request<{ message: string }>('DELETE', `/finance/expense-categories/${id}`, undefined, token),

  // Expenses
  listExpenses: (token: string, params: { status?: string; category_id?: string; from?: string; to?: string } = {}) =>
    request<ApiExpense[]>('GET', `/finance/expenses${qs(params)}`, undefined, token),
  createExpense: (token: string, body: {
    category_id: string | number; description: string; amount: number; date: string;
    supplier_name?: string; supplier_id?: string | number; payment_method?: string;
    reference_no?: string; attachment_path?: string;
  }) => request<ApiExpense>('POST', '/finance/expenses', body, token),
  decideExpense: (token: string, id: string, body: { status: 'approved' | 'rejected' | 'paid'; rejection_reason?: string }) =>
    request<ApiExpense>('PATCH', `/finance/expenses/${id}/decide`, body, token),
  deleteExpense: (token: string, id: string) => request<{ message: string }>('DELETE', `/finance/expenses/${id}`, undefined, token),

  // Customer invoices
  listCustomerInvoices: (token: string, params: { status?: string; client_id?: string } = {}) =>
    request<ApiCustomerInvoice[]>('GET', `/finance/customer-invoices${qs(params)}`, undefined, token),
  showCustomerInvoice: (token: string, id: string) =>
    request<ApiCustomerInvoice>('GET', `/finance/customer-invoices/${id}`, undefined, token),
  createCustomerInvoice: (token: string, body: {
    date: string; due_date?: string; client_id?: string | number;
    client_name_snapshot?: string; order_id?: string | number; notes?: string;
    items: Array<{ description: string; quantity: number; unit_price: number }>;
  }) => request<ApiCustomerInvoice>('POST', '/finance/customer-invoices', body, token),
  updateCustomerInvoice: (token: string, id: string, body: Partial<Pick<ApiCustomerInvoice, 'date' | 'dueDate' | 'notes' | 'status'>>) =>
    request<ApiCustomerInvoice>('PATCH', `/finance/customer-invoices/${id}`, body, token),
  deleteCustomerInvoice: (token: string, id: string) =>
    request<{ message: string }>('DELETE', `/finance/customer-invoices/${id}`, undefined, token),

  // Supplier invoices
  listSupplierInvoices: (token: string, params: { status?: string; supplier_id?: string } = {}) =>
    request<ApiSupplierInvoice[]>('GET', `/finance/supplier-invoices${qs(params)}`, undefined, token),
  createSupplierInvoice: (token: string, body: {
    number: string; date: string; due_date?: string; supplier_id: string | number;
    notes?: string; attachment_path?: string;
    items: Array<{ description: string; quantity: number; unit_price: number }>;
  }) => request<ApiSupplierInvoice>('POST', '/finance/supplier-invoices', body, token),
  decideSupplierInvoice: (token: string, id: string, body: { status: 'approved' | 'rejected'; rejection_reason?: string }) =>
    request<ApiSupplierInvoice>('PATCH', `/finance/supplier-invoices/${id}/decide`, body, token),
  deleteSupplierInvoice: (token: string, id: string) =>
    request<{ message: string }>('DELETE', `/finance/supplier-invoices/${id}`, undefined, token),

  // Receipt + Payment vouchers
  listReceiptVouchers: (token: string, params: { client_id?: string } = {}) =>
    request<ApiReceiptVoucher[]>('GET', `/finance/receipt-vouchers${qs(params)}`, undefined, token),
  createReceiptVoucher: (token: string, body: {
    date: string; client_id?: string | number; payer_name?: string;
    amount: number; method?: string; reference_no?: string; notes?: string;
    allocations?: Array<{ invoice_id: string | number; amount: number }>;
  }) => request<ApiReceiptVoucher>('POST', '/finance/receipt-vouchers', body, token),

  listOrderPaymentReceipts: (token: string) =>
    request<ApiOrderPaymentReceipt[]>('GET', '/finance/order-payment-receipts', undefined, token),

  listPaymentVouchers: (token: string, params: { payee_type?: string } = {}) =>
    request<ApiPaymentVoucher[]>('GET', `/finance/payment-vouchers${qs(params)}`, undefined, token),
  createPaymentVoucher: (token: string, body: {
    date: string; payee_type: 'supplier' | 'employee' | 'other'; payee_id?: string | number;
    payee_name?: string; amount: number; method?: string; reference_no?: string;
    purpose?: string; notes?: string;
    allocations?: Array<{ invoice_id: string | number; amount: number }>;
  }) => request<ApiPaymentVoucher>('POST', '/finance/payment-vouchers', body, token),

  // Debts
  aging: (token: string) => request<ApiAging>('GET', '/finance/aging', undefined, token),

  // Advances (read-only view of employee salary-advance requests)
  advances: (token: string, params: { status?: string } = {}) =>
    request<ApiDebitRequest[]>('GET', `/finance/advances${qs(params)}`, undefined, token),

  // Reports
  reportPnl: (token: string, params: { from?: string; to?: string } = {}) =>
    request<{ from: string; to: string; totals: { revenue: number; expenses: number; net: number }; byMonth: Array<{ month: string; type: string; total: number }> }>(
      'GET', `/finance/reports/pnl${qs(params)}`, undefined, token
    ),
  reportExpenseBreakdown: (token: string, params: { from?: string; to?: string } = {}) =>
    request<{ from: string; to: string; rows: Array<{ categoryId: string; nameAr: string | null; nameEn: string | null; total: number; count: number }> }>(
      'GET', `/finance/reports/expense-breakdown${qs(params)}`, undefined, token
    ),

  // Settings
  workScheduleSettings: (token: string) =>
    request<ApiWorkScheduleSettings>('GET', '/finance/settings/work-schedule', undefined, token),
  updateWorkScheduleSettings: (token: string, body: Partial<{
    work_start: string; work_end: string; grace_minutes: number; work_days: string[];
    late_deduction_per_minute: number; absence_deduction_formula: string;
    vat_rate: number; employee_insurance_pct: number; employer_insurance_pct: number;
  }>) => request<ApiWorkScheduleSettings>('PATCH', '/finance/settings/work-schedule', body, token),
};

// ── HR Center ────────────────────────────────────────────────────────────────

export type ApiHrDashboard = {
  kpi: {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    pendingLeave: number;
    pendingLeaveRequests: number;
    workHoursToday: number;
    monthlyPayroll: number;
    dailyPayroll: number;
  };
  weekly: Array<{ date: string; present: number; late: number; absent: number }>;
  byDepartment: Array<{ label: string; count: number }>;
  liveAttendance: Array<{
    id: string;
    userId: string;
    userName: string | null;
    department: string | null;
    clockInAt: string | null;
    clockOutAt: string | null;
    status: string;
    lateMinutes: number;
  }>;
};

export type ApiEmployee = {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeType: string | null;
  mainJob: string | null;
  hourlyRate: string | null;
  annualLeaveBalance: string | null;
  supervisorId: string | null;
  status: string;
  lastLogin: string | null;
  createdAt: string | null;
  employeeNumber: string | null;
  allowances: Record<string, number | string> | null;
  nationalId: string | null;
  nationality: string | null;
  birthDate: string | null;
  gender: string | null;
  maritalStatus: string | null;
  childrenCount: number | null;
  address: string | null;
  phone: string | null;
  photoPath: string | null;
  hireDate: string | null;
  contractType: string | null;
  contractDuration: string | null;
  bankAccount: string | null;
  department: string | null;
};

export type ApiAttendanceLogRow = {
  id: string;
  userId: string;
  userName?: string | null;
  department?: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  minutesWorked: number | null;
  hoursWorked: number | null;
  status: string;
  lateMinutes: number;
  justified: boolean;
  excuseDocumentPath: string | null;
  justificationReason: string | null;
  decidedById: string | null;
  decidedAt: string | null;
  notes: string | null;
};

export type ApiAttendanceMonthly = {
  year: number;
  month: number;
  daysInMonth: number;
  rows: Array<{
    userId: string;
    name: string;
    department: string | null;
    days: Record<string, string | null>;
    totals: { present: number; absent: number; late: number; leave: number };
  }>;
};

export type ApiPublicHoliday = { id: string; date: string; nameAr: string; nameEn: string };

export type ApiPayrollRun = {
  id: string;
  year: number;
  month: number;
  status: 'draft' | 'approved' | 'paid';
  totalGross: string;
  totalDeductions: string;
  totalNet: string;
  employeeCount: number;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string | null;
  notes: string | null;
};

export type ApiPayslip = {
  id: string;
  runId: string;
  userId: string;
  userName?: string | null;
  department?: string | null;
  mainJob?: string | null;
  hourlyRate: string | null;
  earnedAmount: string;
  allowances: Record<string, number | string>;
  deductions: Record<string, number | string>;
  gross: string;
  totalDeductions: string;
  net: string;
  status: 'pending' | 'paid';
  paidAt: string | null;
  notes: string | null;
};

export type ApiSalaryIncrement = {
  id: string;
  userId: string;
  userName: string | null;
  department: string | null;
  type: 'annual' | 'promotion' | 'bonus' | 'adjustment';
  oldSalary: string;
  newSalary: string;
  amount: string;
  percentage: string | null;
  effectiveDate: string | null;
  reason: string | null;
  createdById: string | null;
  createdByName: string | null;
  applied: boolean;
  appliedAt: string | null;
  createdAt: string | null;
};

export type ApiLeaveBalanceRow = {
  userId: string;
  name: string;
  department: string | null;
  balance: number;
  used: number;
  remaining: number;
};

export type ApiEmployeeDocument = {
  id: string;
  userId: string;
  type: string;
  label: string;
  filePath: string;
  uploadedById: string | null;
  uploadedByName: string | null;
  uploadedAt: string | null;
};

export const hrCenterApi = {
  dashboard: (token: string) => request<ApiHrDashboard>('GET', '/hr-center/dashboard', undefined, token),

  // Employees
  listEmployees: (token: string, params: { status?: string; department?: string; q?: string } = {}) =>
    request<ApiEmployee[]>('GET', `/hr-center/employees${qs(params)}`, undefined, token),
  showEmployee: (token: string, id: string) =>
    request<{
      user: ApiEmployee;
      payslips: ApiPayslip[];
      leaveHistory: ApiLeaveRequest[];
      recentAttendance: ApiAttendanceLogRow[];
      documents: ApiEmployeeDocument[];
      increments: ApiSalaryIncrement[];
    }>('GET', `/hr-center/employees/${id}`, undefined, token),
  createEmployee: (token: string, body: Record<string, unknown>) =>
    request<ApiEmployee>('POST', '/hr-center/employees', body, token),
  updateEmployee: (token: string, id: string, body: Record<string, unknown>) =>
    request<ApiEmployee>('PATCH', `/hr-center/employees/${id}`, body, token),

  // Documents
  listDocuments: (token: string, userId: string) =>
    request<ApiEmployeeDocument[]>('GET', `/hr-center/employees/${userId}/documents`, undefined, token),
  uploadDocument: (token: string, userId: string, body: { type: string; label: string; file_path: string }) =>
    request<ApiEmployeeDocument>('POST', `/hr-center/employees/${userId}/documents`, body, token),
  deleteDocument: (token: string, id: string) =>
    request<{ message: string }>('DELETE', `/hr-center/documents/${id}`, undefined, token),

  // Attendance
  attendanceDaily: (token: string, params: { date?: string } = {}) =>
    request<{ date: string; logs: ApiAttendanceLogRow[] }>('GET', `/hr-center/attendance/daily${qs(params)}`, undefined, token),
  attendanceMonthly: (token: string, params: { year: number; month: number }) =>
    request<ApiAttendanceMonthly>('GET', `/hr-center/attendance/monthly${qs(params)}`, undefined, token),
  attendanceManual: (token: string, body: {
    user_id: string | number; clock_in_at: string; clock_out_at?: string;
    status: string; late_minutes?: number; notes?: string;
  }) => request<ApiAttendanceLogRow>('POST', '/hr-center/attendance/manual', body, token),
  attendanceUpdate: (token: string, id: string, body: Partial<{
    clock_in_at: string; clock_out_at: string; status: string; late_minutes: number; notes: string;
  }>) => request<ApiAttendanceLogRow>('PATCH', `/hr-center/attendance/${id}`, body, token),
  justifyAttendance: (token: string, id: string, body: {
    justified: boolean; justification_reason?: string; excuse_document_path?: string;
  }) => request<ApiAttendanceLogRow>('PATCH', `/hr-center/attendance/${id}/justify`, body, token),

  // Holidays
  listHolidays: (token: string) => request<ApiPublicHoliday[]>('GET', '/hr-center/holidays', undefined, token),
  createHoliday: (token: string, body: { date: string; name_ar: string; name_en: string }) =>
    request<ApiPublicHoliday>('POST', '/hr-center/holidays', body, token),
  deleteHoliday: (token: string, id: string) =>
    request<{ message: string }>('DELETE', `/hr-center/holidays/${id}`, undefined, token),

  // Payroll
  listPayrollRuns: (token: string) => request<ApiPayrollRun[]>('GET', '/hr-center/payroll/runs', undefined, token),
  showPayrollRun: (token: string, id: string) =>
    request<{ run: ApiPayrollRun; payslips: ApiPayslip[] }>('GET', `/hr-center/payroll/runs/${id}`, undefined, token),
  computePayroll: (token: string, body: { year: number; month: number }) =>
    request<{ run: ApiPayrollRun; payslips: ApiPayslip[] }>('POST', '/hr-center/payroll/compute', body, token),
  updatePayslip: (token: string, id: string, body: Partial<{ allowances: Record<string, number>; deductions: Record<string, number> }>) =>
    request<ApiPayslip>('PATCH', `/hr-center/payroll/payslips/${id}`, body, token),
  approvePayrollRun: (token: string, id: string) =>
    request<ApiPayrollRun>('POST', `/hr-center/payroll/runs/${id}/approve`, {}, token),
  payPayslip: (token: string, id: string) =>
    request<ApiPayslip>('POST', `/hr-center/payroll/payslips/${id}/pay`, {}, token),

  // Increments
  listIncrements: (token: string, params: { user_id?: string } = {}) =>
    request<ApiSalaryIncrement[]>('GET', `/hr-center/increments${qs(params)}`, undefined, token),
  createIncrement: (token: string, body: {
    user_id: string | number; type: 'annual' | 'promotion' | 'bonus' | 'adjustment';
    mode: 'amount' | 'percentage'; value: number;
    effective_date: string; reason?: string;
  }) => request<ApiSalaryIncrement>('POST', '/hr-center/increments', body, token),

  // Leave balances
  leaveBalances: (token: string) => request<ApiLeaveBalanceRow[]>('GET', '/hr-center/leave/balances', undefined, token),
  adjustLeaveBalance: (token: string, userId: string, body: { annual_leave_balance: number; note?: string }) =>
    request<ApiEmployee>('PATCH', `/hr-center/leave/balances/${userId}`, body, token),

  // Reports
  reportAbsenceTardiness: (token: string, params: { year: number; month: number }) =>
    request<{
      year: number; month: number;
      rows: Array<{ userId: string; name: string; department: string | null; absenceDays: number; lateCount: number; lateMinutes: number; unjustifiedAbsences: number }>;
    }>('GET', `/hr-center/reports/absence-tardiness${qs(params)}`, undefined, token),
  reportPayroll: (token: string, params: { year: number }) =>
    request<{ year: number; rows: ApiPayrollRun[] }>('GET', `/hr-center/reports/payroll${qs(params)}`, undefined, token),

  // Work schedule settings (HR-accessible)
  workScheduleSettings: (token: string) =>
    request<ApiWorkScheduleSettings>('GET', '/hr-center/settings/work-schedule', undefined, token),
  updateWorkScheduleSettings: (token: string, body: Partial<{
    work_start: string; work_end: string; grace_minutes: number; work_days: string[];
    late_deduction_per_minute: number; absence_deduction_formula: string;
    vat_rate: number; employee_insurance_pct: number; employer_insurance_pct: number;
  }>) => request<ApiWorkScheduleSettings>('PATCH', '/hr-center/settings/work-schedule', body, token),
};
