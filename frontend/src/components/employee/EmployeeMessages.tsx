import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { ApiMessage, ApiMessageThreadSummary, ApiMessageInboxSummary, ApiTask } from '../../services/api';
import type { MessageThreadSummary } from '../../hooks/useMessages';

function isInboxSummary(s: MessageThreadSummary): s is ApiMessageInboxSummary {
  return 'senderId' in s;
}

type Props = {
  tasks?: ApiTask[];
  currentUserId?: string | null;
  selectedSenderId: string | null;
  onSelectSender: (id: string | null) => void;
  thread: ApiMessage[];
  threadLoading: boolean;
  threadError: string | null;
  threadSummaries: MessageThreadSummary[];
  summariesLoading: boolean;
  sendMessage?: (body: string, taskId?: string | null) => Promise<void>;
};

export const EmployeeMessages: React.FC<Props> = ({
  tasks = [],
  currentUserId,
  selectedSenderId,
  onSelectSender,
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

  const myTasks = useMemo(
    () =>
      currentUserId ? tasks.filter((task) => task.assignees.some((a) => a.id === currentUserId)) : [],
    [tasks, currentUserId],
  );

  useEffect(() => {
    setReplyTaskId('');
    setBody('');
  }, [selectedSenderId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || !selectedSenderId || !sendMessage) return;
    setSending(true);
    try {
      await sendMessage(text, replyTaskId || undefined);
      setBody('');
    } finally {
      setSending(false);
    }
  };

  const selectedName =
    selectedSenderId && threadSummaries.length > 0
      ? (() => {
          const s = threadSummaries.find((x) => (isInboxSummary(x) ? x.senderId : x.receiverId) === selectedSenderId);
          return s ? (isInboxSummary(s!) ? s!.senderName : (s as ApiMessageThreadSummary).receiverName) : selectedSenderId;
        })()
      : null;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('inbox')}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {summariesLoading ? (
            <div className="flex justify-center py-4">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
            </div>
          ) : threadSummaries.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">{t('noMessagesYet')}</p>
          ) : (
            <div className="space-y-1">
              {threadSummaries.map((s) => {
                const id = isInboxSummary(s) ? s.senderId : s.receiverId;
                const name = isInboxSummary(s) ? s.senderName : (s as ApiMessageThreadSummary).receiverName;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectSender(id)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      selectedSenderId === id
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t('from')}</p>
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{name ?? id}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{s.lastPreview}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {!selectedSenderId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('selectMessageToView')}
          </div>
        ) : (
          <>
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{t('from')}</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{selectedName ?? selectedSenderId}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {threadLoading ? (
                <div className="flex justify-center py-8">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
                </div>
              ) : threadError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{threadError}</p>
              ) : thread.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">{t('noMessagesYet')}</p>
              ) : (
                <div className="space-y-3">
                  {thread.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.senderId === selectedSenderId ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                          m.senderId === selectedSenderId
                            ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        <p className="mb-0.5 text-[10px] font-medium opacity-80">
                          {m.senderId === selectedSenderId ? (selectedName ?? t('supervisor')) : t('you')}
                        </p>
                        {m.taskTitle && (
                          <p
                            className={`mb-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${
                              m.senderId === selectedSenderId
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
                  ))}
                </div>
              )}
            </div>
            {sendMessage && selectedSenderId && (
              <form onSubmit={handleSend} className="border-t border-slate-100 p-4 dark:border-slate-700">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{t('linkMessageToTask')}</label>
                <select
                  value={replyTaskId}
                  onChange={(e) => setReplyTaskId(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="">{t('selectTaskForMessage')}</option>
                  {myTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={t('replyPlaceholder')}
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
            )}
          </>
        )}
      </div>
    </div>
  );
};
