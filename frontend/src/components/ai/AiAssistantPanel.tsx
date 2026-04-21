import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { ApiAiConversation, ApiAiMessage } from '../../services/api';
import { aiApi } from '../../services/api';
import {
  filterSlashPrompts,
  parseSlashInput,
  slashPromptDefsForRole,
  type SlashPromptItem,
} from './slashPrompts';

function formatChatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function userInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

function buildShareUrl(shareToken: string): string {
  return `${window.location.origin}${window.location.pathname}?aiShare=${encodeURIComponent(shareToken)}`;
}

type ChatMessageRowProps = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  userBubbleName: string;
};

const ChatMessageRow = React.memo(function ChatMessageRow({
  role,
  content,
  createdAt,
  userBubbleName,
}: ChatMessageRowProps) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {isUser ? (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-900"
          aria-hidden
        >
          {userInitials(userBubbleName)}
        </div>
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-2 ring-white dark:bg-slate-800 dark:ring-slate-900"
          aria-hidden
        >
          <svg className="h-5 w-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
      )}
      <div className={`min-w-0 max-w-[min(100%,42rem)] ${isUser ? 'text-end' : ''}`}>
        <div
          className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
            isUser
              ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-violet-900/20'
              : 'border border-slate-200/90 bg-slate-50/95 text-slate-800 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100'
          }`}
        >
          <p className="whitespace-pre-wrap wrap-break-word text-start">{content}</p>
        </div>
        <time
          className={`mt-1 block text-[10px] text-slate-400 dark:text-slate-500 ${isUser ? 'text-end' : 'text-start'}`}
          dateTime={createdAt}
        >
          {formatChatTime(createdAt)}
        </time>
      </div>
    </div>
  );
});

export type AiAssistantPanelProps = {
  viewerRole?: 'admin' | 'supervisor' | 'employee' | null;
  initialShareToken?: string | null;
  onShareConsumed?: () => void;
};

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  viewerRole,
  initialShareToken,
  onShareConsumed,
}) => {
  const { t, token, currentUser } = useApp();
  const roleForPrompts = viewerRole ?? currentUser?.role ?? null;

  const [conversations, setConversations] = useState<ApiAiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiAiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingShared, setLoadingShared] = useState(false);
  const [shareLinkBusy, setShareLinkBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [importingShared, setImportingShared] = useState(false);
  const [sharedView, setSharedView] = useState<{
    token: string;
    ownerName: string;
    title: string;
  } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Avoid repeat POST /share for the same conversation — instant re-copy. */
  const shareTokenByConversationRef = useRef<Map<string, string>>(new Map());

  const slashPrompts: SlashPromptItem[] = useMemo(
    () =>
      slashPromptDefsForRole(roleForPrompts).map((d) => ({
        id: d.id,
        label: t(d.labelKey),
        text: t(d.textKey),
      })),
    [t, roleForPrompts],
  );

  const slashMatch = useMemo(() => parseSlashInput(input, caret), [input, caret]);
  const filteredSlash = useMemo(
    () => filterSlashPrompts(slashPrompts, slashMatch),
    [slashPrompts, slashMatch],
  );
  const slashMenuOpen = Boolean(!sharedView && slashMatch && filteredSlash.length > 0);

  useEffect(() => {
    setSlashMenuIndex(0);
  }, [slashMatch?.slashStart, slashMatch?.filter]);

  useEffect(() => {
    setSlashMenuIndex((i) => Math.min(i, Math.max(0, filteredSlash.length - 1)));
  }, [filteredSlash.length]);

  useEffect(() => {
    if (!slashMenuOpen) return;
    const el = document.getElementById(`slash-menu-item-${slashMenuIndex}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [slashMenuIndex, slashMenuOpen]);

  const clearShared = useCallback(() => {
    setSharedView(null);
    onShareConsumed?.();
  }, [onShareConsumed]);

  const applySlashPrompt = useCallback(
    (insertText: string) => {
      const el = textareaRef.current;
      const pos = el?.selectionStart ?? input.length;
      const match = parseSlashInput(input, pos);
      if (!match) return;
      const newVal = input.slice(0, match.slashStart) + insertText + input.slice(pos);
      setInput(newVal);
      const newPos = match.slashStart + insertText.length;
      setCaret(newPos);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(newPos, newPos);
      });
    },
    [input],
  );

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const list = await aiApi.conversations(token);
      setConversations(list);
    } catch {
      setError(t('aiError'));
    } finally {
      setLoadingList(false);
    }
  }, [token, t]);

  const loadMessages = useCallback(
    async (cid: string, opts?: { quiet?: boolean }) => {
      if (!token) return;
      if (!opts?.quiet) {
        setMessages([]);
        setLoadingMessages(true);
      }
      setError(null);
      try {
        const data = await aiApi.conversationMessages(cid, token);
        setMessages(data.messages);
        setActiveId(data.conversationId);
      } catch {
        setError(t('aiError'));
        setMessages([]);
      } finally {
        if (!opts?.quiet) setLoadingMessages(false);
      }
    },
    [token, t],
  );

  useEffect(() => {
    if (!token) return;
    if (initialShareToken) {
      const t = window.setTimeout(() => {
        loadConversations();
      }, 48);
      return () => clearTimeout(t);
    }
    loadConversations();
  }, [token, initialShareToken, loadConversations]);

  useEffect(() => {
    if (!token || !initialShareToken) return;
    let cancelled = false;
    setLoadingShared(true);
    setError(null);
    (async () => {
      try {
        const data = await aiApi.sharedConversation(initialShareToken, token);
        if (cancelled) return;
        setSharedView({
          token: initialShareToken,
          ownerName: data.ownerName,
          title: data.title,
        });
        setMessages(data.messages);
        setActiveId(null);
      } catch {
        if (!cancelled) {
          setError(t('aiError'));
          onShareConsumed?.();
        }
      } finally {
        if (!cancelled) setLoadingShared(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, initialShareToken, t, onShareConsumed]);

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [messages, sending, summarizing]);

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const handleNewChat = () => {
    if (sharedView) clearShared();
    setActiveId(null);
    setMessages([]);
    setInput('');
    setCaret(0);
    setError(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleSelect = (id: string) => {
    if (sharedView) clearShared();
    if (id === activeId) return;
    loadMessages(id);
  };

  const handleCloseShared = () => {
    clearShared();
    setMessages([]);
    setActiveId(null);
  };

  const handleImportShared = async () => {
    if (!token || !sharedView) return;
    setImportingShared(true);
    setError(null);
    try {
      const { conversationId } = await aiApi.importShared(token, sharedView.token);
      clearShared();
      await loadMessages(conversationId, { quiet: true });
      void loadConversations();
    } catch {
      setError(t('aiError'));
    } finally {
      setImportingShared(false);
    }
  };

  const handleShareLink = async () => {
    if (!token || !activeId || sharedView) return;
    setError(null);
    const cached = shareTokenByConversationRef.current.get(activeId);
    if (cached) {
      try {
        await navigator.clipboard.writeText(buildShareUrl(cached));
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 2500);
      } catch {
        setError(t('aiShareFailed'));
      }
      return;
    }
    setShareLinkBusy(true);
    try {
      const { shareToken } = await aiApi.shareConversation(activeId, token);
      shareTokenByConversationRef.current.set(activeId, shareToken);
      await navigator.clipboard.writeText(buildShareUrl(shareToken));
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2500);
    } catch {
      setError(t('aiShareFailed'));
    } finally {
      setShareLinkBusy(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (sharedView) return;
    const text = input.trim();
    if (!token || !text || sending) return;
    setSending(true);
    setError(null);
    setInput('');
    try {
      const payload: { conversation_id?: string; message: string } = { message: text };
      if (activeId) payload.conversation_id = activeId;
      const res = await aiApi.chat(token, payload);
      setActiveId(res.conversationId);
      await loadMessages(res.conversationId, { quiet: true });
      await loadConversations();
    } catch {
      setError(t('aiError'));
    } finally {
      setSending(false);
    }
  };

  const handleSummarize = async () => {
    if (!token || summarizing || sending || sharedView) return;
    setSummarizing(true);
    setError(null);
    try {
      const payload = activeId ? { conversation_id: activeId } : {};
      const res = await aiApi.summarizeToday(token, payload);
      setActiveId(res.conversationId);
      await loadMessages(res.conversationId, { quiet: true });
      await loadConversations();
    } catch {
      setError(t('aiError'));
    } finally {
      setSummarizing(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    try {
      await aiApi.deleteConversation(id, token);
      shareTokenByConversationRef.current.delete(id);
      if (activeId === id) handleNewChat();
      await loadConversations();
    } catch {
      setError(t('aiError'));
    }
  };

  const busy = sending || summarizing;
  const displayName = currentUser?.name ?? 'You';
  const introText = roleForPrompts === 'employee' ? t('aiAssistantIntroEmployee') : t('aiAssistantIntro');

  if (!token) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('aiNotConfigured')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[min(72vh,680px)] flex-col gap-5 lg:flex-row lg:gap-6">
      {/* Sidebar */}
      <aside className="flex max-h-[min(72vh,680px)] w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/90 dark:bg-slate-900/50 lg:w-64">
        <div className="border-b border-slate-100 bg-gradient-to-br from-violet-50/90 to-indigo-50/50 px-4 py-4 dark:border-slate-700/80 dark:from-violet-950/40 dark:to-slate-900">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600/90 dark:text-violet-400/90">
            {t('aiChatsLabel')}
          </p>
          <button
            type="button"
            onClick={handleNewChat}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-md shadow-violet-900/20 transition hover:from-violet-500 hover:to-indigo-500"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t('aiNewChat')}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loadingList ? (
            <div className="space-y-2 px-1 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {t('aiNoConversations')}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((c) => (
                <li key={c.id}>
                  <div
                    className={`group flex items-center gap-1 rounded-xl px-2 py-1.5 transition ${
                      !sharedView && activeId === c.id
                        ? 'bg-violet-100/90 ring-1 ring-violet-300/60 dark:bg-violet-950/60 dark:ring-violet-800/50'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(c.id)}
                      className="min-w-0 flex-1 rounded-lg px-1.5 py-1.5 text-start"
                      title={c.title}
                    >
                      <span className="line-clamp-2 text-xs font-medium leading-snug text-slate-800 dark:text-slate-100">
                        {c.title || 'Chat'}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">
                        {formatChatTime(c.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(c.id, e)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 opacity-70 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      aria-label={t('delete')}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex min-h-[min(60vh,560px)] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md shadow-slate-200/40 dark:border-slate-700/90 dark:bg-slate-900/40 dark:shadow-none">
        <header className="shrink-0 border-b border-slate-100 bg-gradient-to-br from-white via-violet-50/30 to-indigo-50/20 px-5 py-4 dark:border-slate-700/80 dark:from-slate-900 dark:via-violet-950/20 dark:to-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-900/25">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{t('aiAssistantNav')}</h2>
                <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">{introText}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy || !activeId || Boolean(sharedView) || shareLinkBusy}
                onClick={() => void handleShareLink()}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {shareLinkBusy ? (
                  <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 5.314l9.566 5.314m0 0l-9.566 5.314m9.566-5.314l-9.566-5.314" />
                  </svg>
                )}
                {shareCopied ? t('aiShareCopied') : t('aiShareCopyLink')}
              </button>
              <button
                type="button"
                disabled={busy || Boolean(sharedView)}
                onClick={handleSummarize}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 bg-white/90 px-3.5 py-2 text-xs font-semibold text-violet-900 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/50"
              >
                {summarizing ? (
                  <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                  </svg>
                )}
                {t('aiSummarizeToday')}
              </button>
            </div>
          </div>
        </header>

        {sharedView && (
          <div className="mx-4 mt-3 flex flex-col gap-2 rounded-xl border border-violet-200/90 bg-violet-50/90 px-3 py-2.5 text-xs text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{sharedView.title}</p>
              <p className="mt-0.5 text-violet-800/90 dark:text-violet-200/90">
                {t('aiSharedFrom').replace('{name}', sharedView.ownerName)} · {t('aiSharedReadOnly')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={importingShared}
                onClick={handleImportShared}
                className="rounded-lg bg-violet-600 px-3 py-1.5 font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {importingShared ? t('aiShareImporting') : t('aiShareSaveCopy')}
              </button>
              <button
                type="button"
                onClick={handleCloseShared}
                className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 font-semibold text-violet-900 transition hover:bg-violet-100 dark:border-violet-700 dark:bg-slate-900 dark:text-violet-100 dark:hover:bg-violet-950/80"
              >
                {t('aiShareCloseView')}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
          {loadingShared && messages.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-violet-200/60 bg-violet-50/50 px-4 py-3 dark:border-violet-900/40 dark:bg-violet-950/30">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              <p className="text-sm text-violet-900 dark:text-violet-100">{t('aiLoadingShared')}</p>
            </div>
          ) : loadingMessages && messages.length === 0 ? (
            <div className="flex flex-col gap-4 px-1">
              <div className="flex gap-3">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-20 flex-1 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="flex justify-end gap-3">
                <div className="h-14 w-[70%] animate-pulse rounded-2xl bg-violet-100 dark:bg-violet-950/40" />
              </div>
            </div>
          ) : messages.length === 0 && !busy ? (
            <div className="mx-auto flex max-w-md flex-col items-center px-4 py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/60 dark:to-indigo-950/40">
                <svg className="h-8 w-8 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m9 3a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M9.75 21h-4.5a2.25 2.25 0 01-2.25-2.25v-12a2.25 2.25 0 012.25-2.25h4.5a2.25 2.25 0 012.25 2.25v12a2.25 2.25 0 01-2.25 2.25zm3.75-9v-.75a2.25 2.25 0 00-2.25-2.25H15" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t('aiWelcomeTitle')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t('aiWelcomeSubtitle')}</p>
              <ul className="mt-6 w-full space-y-2 text-start text-sm text-slate-600 dark:text-slate-400">
                <li className="flex gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                  <span className="text-violet-500">→</span>
                  {t('aiTipBullet1')}
                </li>
                <li className="flex gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                  <span className="text-violet-500">→</span>
                  {t('aiTipBullet2')}
                </li>
                <li className="flex gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                  <span className="text-violet-500">→</span>
                  {t('aiTipBullet3')}
                </li>
              </ul>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <ChatMessageRow
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  createdAt={m.createdAt}
                  userBubbleName={sharedView ? sharedView.ownerName : displayName}
                />
              ))}
              {busy && (
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <svg className="h-5 w-5 animate-pulse text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400" />
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{t('aiThinking')}</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/60 sm:p-4">
          <form onSubmit={handleSend} className="mx-auto max-w-4xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
              <div className="relative min-w-0 flex-1">
                {slashMenuOpen && (
                  <div
                    className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-[min(280px,40vh)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/40"
                    aria-label={t('aiSlashMenuTitle')}
                  >
                    <div className="border-b border-slate-100 bg-gradient-to-r from-violet-50/90 to-indigo-50/50 px-3 py-2 dark:border-slate-700 dark:from-violet-950/50 dark:to-slate-900">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                        {t('aiSlashMenuTitle')}
                      </p>
                    </div>
                    <ul
                      id="slash-command-listbox"
                      role="listbox"
                      className="max-h-[min(240px,35vh)] overflow-y-auto py-1"
                    >
                      {filteredSlash.map((p, i) => (
                        <li key={p.id} id={`slash-menu-item-${i}`} role="option" aria-selected={i === slashMenuIndex}>
                          <button
                            type="button"
                            className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-start text-sm transition ${
                              i === slashMenuIndex
                                ? 'bg-violet-100 dark:bg-violet-950/60'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                            }`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applySlashPrompt(p.text)}
                          >
                            <span className="font-medium text-slate-900 dark:text-slate-50">{p.label}</span>
                            <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{p.text}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setCaret(e.target.selectionStart ?? e.target.value.length);
                  }}
                  onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
                  onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
                  onKeyDown={(e) => {
                    const el = textareaRef.current;
                    const pos = el?.selectionStart ?? input.length;
                    const match = parseSlashInput(input, pos);
                    const filtered = filterSlashPrompts(slashPrompts, match);
                    const menu = Boolean(!sharedView && match && filtered.length > 0);

                    if (menu) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSlashMenuIndex((idx) => Math.min(idx + 1, filtered.length - 1));
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSlashMenuIndex((idx) => Math.max(0, idx - 1));
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const idx = Math.min(slashMenuIndex, filtered.length - 1);
                        const item = filtered[idx];
                        if (item) applySlashPrompt(item.text);
                        return;
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        if (match) {
                          const newVal = input.slice(0, match.slashStart) + input.slice(pos);
                          setInput(newVal);
                          const np = match.slashStart;
                          setCaret(np);
                          requestAnimationFrame(() => {
                            el?.focus();
                            el?.setSelectionRange(np, np);
                          });
                        }
                        return;
                      }
                    }

                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!sharedView && !sending && input.trim()) void handleSend();
                    }
                  }}
                  placeholder={sharedView ? t('aiSharedReadOnly') : t('aiAssistantPlaceholder')}
                  disabled={sending || Boolean(sharedView)}
                  rows={1}
                  className="max-h-40 min-h-[48px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-violet-500 dark:focus:ring-violet-500/20"
                  aria-label={t('aiAssistantPlaceholder')}
                  aria-expanded={slashMenuOpen}
                  aria-controls={slashMenuOpen ? 'slash-command-listbox' : undefined}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim() || Boolean(sharedView)}
                  className="absolute bottom-2 end-2 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-40 sm:bottom-2.5 sm:end-2.5"
                  title={t('sendMessage')}
                >
                  {sending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <svg className="h-5 w-5 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500 sm:text-start">
              {sharedView ? t('aiSharedReadOnly') : t('aiInputHint')}
            </p>
          </form>
        </footer>
      </div>
    </div>
  );
};
