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
  baseSalary?: string | null;
  annualLeaveBalance?: string | null;
  supervisorId?: string | null;
  status: 'active' | 'suspended';
  lastLogin?: string | null;
  createdAt: string;
};

export type LoginResponse = { token: string; user: ApiUser };

export const auth = {
  login: (email: string, password: string) =>
    request<LoginResponse>('POST', '/login', { email, password }),

  logout: (token: string) =>
    request<{ message: string }>('POST', '/logout', undefined, token),

  me: (token: string) => request<ApiUser>('GET', '/me', undefined, token),
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
  base_salary?: number | null;
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
  base_salary?: number | null;
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
  receiverId: string;
  receiverName: string | null;
  lastPreview: string;
  lastAt: string;
};

/** Employee inbox: threads grouped by sender (supervisor) */
export type ApiMessageInboxSummary = {
  id: string;
  senderId: string;
  senderName: string | null;
  lastPreview: string;
  lastAt: string;
};

export type CreateMessagePayload = { receiver_id: string; body: string; task_id?: string | null };

export const messagesApi = {
  list: (token: string, receiverId?: string) =>
    request<ApiMessage[] | ApiMessageThreadSummary[]>(
      'GET',
      receiverId ? `/messages?receiver_id=${receiverId}` : '/messages',
      undefined,
      token,
    ),
  send: (payload: CreateMessagePayload, token: string) => {
    const body: Record<string, unknown> = {
      receiver_id: payload.receiver_id,
      body: payload.body,
    };
    if (payload.task_id) {
      body.task_id = payload.task_id;
    }
    return request<ApiMessage>('POST', '/messages', body, token);
  },
};

// ── Tasks ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type ApiTaskAssignee = { id: string; name: string; email: string };

export type ApiTaskOrderItem = {
  profileCode: string;
  profileName: string;
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
  get: (token: string) => request<ApiAdminAnalytics>('GET', '/admin/analytics', undefined, token),
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
  inventoryCreate: (
    payload: { profile_id: number; color_code: string; quantity: number },
    token: string,
  ) => request<ApiInventoryItem>('POST', '/storehouse/inventory', payload, token),
  inventoryUpdate: (
    id: number,
    payload: { profile_id: number; color_code: string; quantity: number },
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
  categoryName?: string | null;
  colorCode: string;
  colorName: string;
  quantity: number;
  notes?: string | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
};

export type ApiOrderPayment = {
  id: string;
  amount: number;
  paidAt: string;
  recordedById: string | null;
  recordedByName: string | null;
  note: string | null;
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
    body: { amount: number; paid_at?: string | null; note?: string | null },
  ) => request<ApiOrder>('POST', `/orders/${id}/payments`, body, token),
  updateReceiptMeta: (id: string, token: string, body: { customer_reference?: string | null }) =>
    request<ApiOrder>('PATCH', `/orders/${id}/receipt-meta`, body, token),
};

// ── Clients (supervisor) ────────────────────────────────────────────────────

export type ApiClient = {
  id: string;
  supervisorId: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiClientDetailResponse = {
  client: ApiClient;
  analytics: {
    orderCount: number;
    totalPurchases: number;
    totalPaid: number;
    balanceDue: number;
  };
  orders: Array<{
    id: string;
    receiptNumber: string | null;
    totalAmount: number | null;
    amountPaid: number;
    currency: string;
    updatedAt: string;
  }>;
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
  baseSalary?: string | null;
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
  directory: ApiHrDirectoryRow[];
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

export const accountantFinanceApi = {
  cashFlow: (token: string, period: 'day' | 'week' | 'month' | 'year') =>
    request<ApiAccountantCashFlow>('GET', `/accountant/cash-flow?period=${encodeURIComponent(period)}`, undefined, token),

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
