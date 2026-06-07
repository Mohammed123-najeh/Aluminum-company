import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import { AppProvider, useApp } from './contexts/AppContext';
import { LoginPage } from './LoginPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { AdminPage } from './pages/AdminPage';
import { SupervisorPage } from './pages/SupervisorPage';
import { EmployeePage } from './pages/EmployeePage';
import { attendanceApi, auth } from './services/api';
import { navigate } from './utils/navigation';
import { formatAmPm, formatWorkDuration } from './utils/workTime';

function readAiShareParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('aiShare');
  } catch {
    return null;
  }
}

/** Subscribes to pushstate/popstate so the password-reset deep-link works
 *  without a full router dependency. Browsers don't fire `popstate` on
 *  pushState — only on back/forward — so we also listen on a custom event
 *  fired by our `navigate()` helper in utils/navigation.ts. */
function useUrlPath(): string {
  const [path, setPath] = useState<string>(() => window.location.pathname);
  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handler);
    window.addEventListener('app:navigate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('app:navigate', handler);
    };
  }, []);
  return path;
}

const App: React.FC = () => {
  const { token, setToken, setAdminProfile, setCurrentUser, currentUser } = useApp();
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pendingShareToken, setPendingShareToken] = useState<string | null>(() => readAiShareParam());
  const [logoutPrompt, setLogoutPrompt] = useState<{ minutesToday: number; open: boolean; startedAt?: string | null; endingAt: string } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const path = useUrlPath();

  const clearAiShareParam = useCallback(() => {
    setPendingShareToken(null);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('aiShare');
      window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`);
    } catch {
      /* ignore */
    }
  }, []);

  // Validate session whenever the stored token changes (login, refresh, logout).
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoggedIn(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    auth
      .me(token)
      .then((user) => {
        if (cancelled) return;
        setAdminProfile({ name: user.name, email: user.email });
        setCurrentUser(user);
        setLoggedIn(true);
      })
      .catch(() => {
        if (cancelled) return;
        setToken(null);
        setCurrentUser(null);
        setLoggedIn(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, setToken, setAdminProfile, setCurrentUser]); // setters from context are stable (useCallback / useState)

  const performLogout = async () => {
    setLoggingOut(true);
    if (token) {
      try {
        await auth.logout(token);
      } catch {
        // ignore network errors on logout
      }
    }
    setToken(null);
    setCurrentUser(null);
    setLoggedIn(false);
    setLogoutPrompt(null);
    setLoggingOut(false);
  };

  const handleLogout = async () => {
    if (!token) {
      await performLogout();
      return;
    }

    try {
      const today = await attendanceApi.today(token);
      setLogoutPrompt({
        minutesToday: today.minutesWorked,
        open: Boolean(today.openSession),
        startedAt: today.openSession?.startedAt ?? null,
        endingAt: new Date().toISOString(),
      });
    } catch {
      setLogoutPrompt({ minutesToday: 0, open: false, startedAt: null, endingAt: new Date().toISOString() });
    }
  };

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
      </div>
    );
  }

  // Public /reset-password route. Available to any visitor (logged in or not)
  // since password recovery may be initiated from an authenticated session too.
  if (path === '/reset-password') {
    return <ResetPasswordPage onBackToLogin={() => navigate('/')} />;
  }

  if (!loggedIn) {
    return <LoginPage onLoginSuccess={() => setLoggedIn(true)} />;
  }

  if (currentUser?.role === 'supervisor') {
    return (
      <>
        <SupervisorPage
          onLogout={handleLogout}
          initialAiShareToken={pendingShareToken}
          onAiShareConsumed={clearAiShareParam}
        />
        <LogoutPrompt prompt={logoutPrompt} loggingOut={loggingOut} onCancel={() => setLogoutPrompt(null)} onConfirm={() => void performLogout()} />
      </>
    );
  }
  if (currentUser?.role === 'employee') {
    return (
      <>
        <EmployeePage
          onLogout={handleLogout}
          initialAiShareToken={pendingShareToken}
          onAiShareConsumed={clearAiShareParam}
        />
        <LogoutPrompt prompt={logoutPrompt} loggingOut={loggingOut} onCancel={() => setLogoutPrompt(null)} onConfirm={() => void performLogout()} />
      </>
    );
  }
  return (
    <>
      <AdminPage
        onLogout={handleLogout}
        initialAiShareToken={pendingShareToken}
        onAiShareConsumed={clearAiShareParam}
      />
      <LogoutPrompt prompt={logoutPrompt} loggingOut={loggingOut} onCancel={() => setLogoutPrompt(null)} onConfirm={() => void performLogout()} />
    </>
  );
};

const LogoutPrompt: React.FC<{
  prompt: { minutesToday: number; open: boolean; startedAt?: string | null; endingAt: string } | null;
  loggingOut: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ prompt, loggingOut, onCancel, onConfirm }) => {
  const { t } = useApp();
  if (!prompt) return null;
  const time = formatWorkDuration(prompt.minutesToday);
  const started = formatAmPm(prompt.startedAt);
  const ending = formatAmPm(prompt.endingAt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-blue-600 px-5 py-5 text-white">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <h3 className="text-lg font-bold">{t('workClock.logoutTitle')}</h3>
          <p className="mt-1 text-sm text-white/85">{t('workClock.logoutPrompt').replace('{time}', time)}</p>
        </div>
        <div className="p-5">
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('workClock.today')}</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-slate-900 dark:text-slate-100">{time}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white px-3 py-2 dark:bg-slate-900/50">
                <p className="font-semibold uppercase tracking-wide text-slate-400">{t('workClock.startedAt')}</p>
                <p className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{started}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2 dark:bg-slate-900/50">
                <p className="font-semibold uppercase tracking-wide text-slate-400">{t('workClock.endingAt')}</p>
                <p className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{ending}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loggingOut}
              className="flex-1 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:from-red-400 hover:to-orange-400 disabled:opacity-60"
            >
              {t('workClock.logoutConfirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const root = document.getElementById('app') as HTMLElement;
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
