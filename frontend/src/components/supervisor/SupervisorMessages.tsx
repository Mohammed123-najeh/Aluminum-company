import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { User } from '../../types/user';
import type { ApiMessage, ApiTask, ApiMessageContact } from '../../services/api';
import { usersApi, messagesApi } from '../../services/api';
import type { MessageThreadSummary } from '../../hooks/useMessages';
import { onFocusFlash, flashElement } from '../../utils/focusFlash';

type Props = {
  employees: User[];
  tasks: ApiTask[];
  selectedReceiverId: string | null;
  onSelectReceiver: (id: string | null) => void;
  thread: ApiMessage[];
  threadLoading: boolean;
  threadError: string | null;
  threadSummaries: MessageThreadSummary[];
  summariesLoading: boolean;
  sendMessage: (body: string, taskId?: string | null) => Promise<void>;
  sendMessageToMany?: (receiverIds: string[], body: string) => Promise<void>;
};

export const SupervisorMessages: React.FC<Props> = ({
  employees,
  tasks,
  selectedReceiverId,
  onSelectReceiver,
  thread,
  threadLoading,
  threadError,
  threadSummaries,
  summariesLoading,
  sendMessage,
  sendMessageToMany,
}) => {
  const { t, token } = useApp();
  const [body, setBody] = useState('');
  const [replyTaskId, setReplyTaskId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [primaryAdmin, setPrimaryAdmin] = useState<User | null>(null);
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [contactsApi, setContactsApi] = useState<ApiMessageContact[]>([]);

  useEffect(() => {
    if (!token) return;
    usersApi
      .list(token)
      .then((rows) => setPrimaryAdmin((rows.find((u) => u.role === 'admin' && u.status === 'active') as User | undefined) ?? null))
      .catch(() => setPrimaryAdmin(null));
    messagesApi
      .contacts(token)
      .then((rows) => setContactsApi(rows))
      .catch(() => setContactsApi([]));
  }, [token]);

  // Recipient roster shown in the left pane: HR + Finance + own team (delivered by
  // /messages/contacts). Falls back to the supervisor's `employees` prop until the
  // contacts request completes, so the UI is never empty during load.
  const recipientRoster = useMemo<User[]>(() => {
    if (contactsApi.length === 0) return employees;
    return contactsApi
      .filter((c) => c.relation !== 'admin') // primaryAdmin is rendered separately above
      .map<User>((c) => ({
        id: c.id,
        name: c.name,
        email: '',
        role: c.role,
        status: 'active',
        createdAt: new Date().toISOString(),
        employeeType: (c.employeeType as User['employeeType']) ?? undefined,
        mainJob: c.mainJob ?? undefined,
      }));
  }, [contactsApi, employees]);

  const summaryFor = (peerId: string) => threadSummaries.find((x) => x.peerId === peerId || ('receiverId' in x && x.receiverId === peerId));

  const sortedEmployees = useMemo(() => {
    return [...recipientRoster].sort((a, b) => {
      const atA = summaryFor(a.id)?.lastAt ?? '';
      const atB = summaryFor(b.id)?.lastAt ?? '';
      if (atA || atB) return atB.localeCompare(atA);
      return a.name.localeCompare(b.name);
    });
  }, [recipientRoster, threadSummaries]);

  const employeeTasks = useMemo(
    () =>
      selectedReceiverId && !broadcastMode
        ? tasks.filter((task) => task.assignees.some((a) => a.id === selectedReceiverId))
        : [],
    [tasks, selectedReceiverId, broadcastMode],
  );

  const selectedEmployee = selectedReceiverId
    ? (employees.find((e) => e.id === selectedReceiverId)
        ?? recipientRoster.find((e) => e.id === selectedReceiverId)
        ?? null)
    : null;
  const selectedAdmin = selectedReceiverId && primaryAdmin?.id === selectedReceiverId ? primaryAdmin : null;

  const previewFor = (empId: string) => {
    const s = summaryFor(empId);
    return s?.lastPreview ?? null;
  };
  const unreadFor = (peerId: string) => summaryFor(peerId)?.unreadCount ?? 0;

  const roleLabel = (u: User) => {
    if (u.role === 'admin') return t('admin');
    if (u.role === 'supervisor') return t('supervisor');
    if (u.employeeType === 'hr') return t('hr');
    if (u.employeeType === 'accountant') return t('accountant');
    if (u.employeeType === 'sales') return t('sales');
    return t('employeeRole');
  };

  useEffect(() => {
    setReplyTaskId('');
    setBody('');
  }, [selectedReceiverId, broadcastMode]);

  useEffect(() => {
    return onFocusFlash('message', (messageId) => {
      window.requestAnimationFrame(() => {
        const node = document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(messageId)}"]`);
        flashElement(node);
      });
    });
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || (!selectedReceiverId && !broadcastMode)) return;
    setSending(true);
    try {
      if (broadcastMode) {
        await sendMessageToMany?.(employees.map((e) => e.id), text);
      } else {
        await sendMessage(text, replyTaskId || undefined);
      }
      setBody('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('myTeam')}</p>
        </div>
        <div className="border-b border-slate-100 p-2 dark:border-slate-700">
          {primaryAdmin && (
            <button
              type="button"
              onClick={() => { setBroadcastMode(false); onSelectReceiver(primaryAdmin.id); }}
              className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                selectedReceiverId === primaryAdmin.id && !broadcastMode
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">{primaryAdmin.name}</p>
                {unreadFor(primaryAdmin.id) > 0 && <span className="rounded-full bg-indigo-600 px-1.5 py-px text-[10px] font-bold text-white">{unreadFor(primaryAdmin.id)}</span>}
              </div>
              <p className="truncate text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{roleLabel(primaryAdmin)}</p>
              {previewFor(primaryAdmin.id) && <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{previewFor(primaryAdmin.id)}</p>}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setBroadcastMode(true); onSelectReceiver(null); }}
            className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
              broadcastMode ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <p className="truncate font-medium text-slate-900 dark:text-slate-100">All team</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">Broadcast to every employee</p>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {summariesLoading ? (
            <div className="flex justify-center py-4">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
            </div>
          ) : sortedEmployees.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">{t('noEmployeesYetTeam')}</p>
          ) : (
            <div className="space-y-1">
              {sortedEmployees.map((e) => {
                const prev = previewFor(e.id);
                const unread = unreadFor(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => { setBroadcastMode(false); onSelectReceiver(e.id); }}
                    className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      selectedReceiverId === e.id
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{e.name}</p>
                      {unread > 0 && <span className="rounded-full bg-indigo-600 px-1.5 py-px text-[10px] font-bold text-white">{unread}</span>}
                    </div>
                    <p className="truncate text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{roleLabel(e)}</p>
                    {prev && <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{prev}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {!selectedReceiverId && !broadcastMode ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('selectEmployeeToMessage')}
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {broadcastMode ? 'All team' : selectedEmployee?.name ?? selectedAdmin?.name ?? selectedReceiverId}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {broadcastMode ? 'Broadcast message' : selectedEmployee?.email ?? selectedAdmin?.email}
              </p>
            </div>

            {!broadcastMode && selectedEmployee && <div className="shrink-0 border-b border-slate-100 px-4 py-2 dark:border-slate-700">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('tasks')}</p>
              {employeeTasks.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">{t('noTasksAssignedToEmployee')}</p>
              ) : (
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
                  {employeeTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-900/50"
                    >
                      <span className="min-w-0 font-medium text-slate-800 dark:text-slate-200">{task.title}</span>
                      <span className="shrink-0 text-slate-500 dark:text-slate-400">{task.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>}

            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
              {broadcastMode ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">This will send one private message to each employee in your team.</p>
              ) : (
              <>
              {threadLoading ? (
                <div className="flex justify-center py-8">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
                </div>
              ) : threadError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{threadError}</p>
              ) : thread.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">{t('noMessagesYet')}</p>
              ) : (
                thread.map((m) => (
                  <div
                    key={m.id}
                    data-message-id={m.id}
                    className={`flex ${m.senderId === selectedReceiverId ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                        m.senderId === selectedReceiverId
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      <p className="mb-0.5 text-[10px] font-medium opacity-80">
                        {m.senderId === selectedReceiverId ? (selectedEmployee?.name ?? 'Employee') : t('you')}
                      </p>
                      {m.taskTitle && (
                        <p
                          className={`mb-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${
                            m.senderId === selectedReceiverId
                              ? 'bg-white/60 text-indigo-900 dark:bg-slate-600 dark:text-indigo-200'
                              : 'bg-white/20 text-white'
                          }`}
                        >
                          {t('messageAboutTask')}: {m.taskTitle}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className="mt-1 text-[10px] opacity-70">{new Date(m.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
              </>
              )}
            </div>

            <form onSubmit={handleSend} className="shrink-0 border-t border-slate-100 p-4 dark:border-slate-700">
              {!broadcastMode && selectedEmployee && <>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('linkMessageToTask')}</label>
                <select
                value={replyTaskId}
                onChange={(e) => setReplyTaskId(e.target.value)}
                className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                <option value="">{t('selectTaskForMessage')}</option>
                {employeeTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
                </select>
              </>}
              <div className="flex gap-2">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t('sendMessage')}
                  rows={2}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={sending || !body.trim()}
                  className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    t('sendMessage')
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
