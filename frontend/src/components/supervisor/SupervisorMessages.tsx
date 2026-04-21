import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { User } from '../../types/user';
import type { ApiMessage, ApiTask } from '../../services/api';
import type { MessageThreadSummary } from '../../hooks/useMessages';

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
}) => {
  const { t } = useApp();
  const [body, setBody] = useState('');
  const [replyTaskId, setReplyTaskId] = useState<string>('');
  const [sending, setSending] = useState(false);

  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  const employeeTasks = useMemo(
    () =>
      selectedReceiverId
        ? tasks.filter((task) => task.assignees.some((a) => a.id === selectedReceiverId))
        : [],
    [tasks, selectedReceiverId],
  );

  const selectedEmployee = selectedReceiverId ? employees.find((e) => e.id === selectedReceiverId) : null;

  const previewFor = (empId: string) => {
    const s = threadSummaries.find((x) => 'receiverId' in x && x.receiverId === empId);
    return s?.lastPreview ?? null;
  };

  useEffect(() => {
    setReplyTaskId('');
    setBody('');
  }, [selectedReceiverId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || !selectedReceiverId) return;
    setSending(true);
    try {
      await sendMessage(text, replyTaskId || undefined);
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
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelectReceiver(e.id)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      selectedReceiverId === e.id
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{e.name}</p>
                    {prev && <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{prev}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {!selectedReceiverId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('selectEmployeeToMessage')}
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <p className="font-medium text-slate-900 dark:text-slate-100">{selectedEmployee?.name ?? selectedReceiverId}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{selectedEmployee?.email}</p>
            </div>

            <div className="shrink-0 border-b border-slate-100 px-4 py-2 dark:border-slate-700">
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
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
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
            </div>

            <form onSubmit={handleSend} className="shrink-0 border-t border-slate-100 p-4 dark:border-slate-700">
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
