import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import { AppProvider, useApp } from './contexts/AppContext';
import { LoginPage } from './LoginPage';
import { auth } from './services/api';
import { navigate } from './utils/navigation';

// Role dashboards are large (each pulls in dozens of panels). Load them on demand
// so the initial bundle only ships login + shell. A logged-in user downloads just
// their own role's dashboard, not all three.
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const SupervisorPage = lazy(() => import('./pages/SupervisorPage').then((m) => ({ default: m.SupervisorPage })));
const EmployeePage = lazy(() => import('./pages/EmployeePage').then((m) => ({ default: m.EmployeePage })));
// Public deep-link route — only ever needed by visitors following a reset email.
const ResetPasswordPage = lazy(() => import('./ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));

/** Full-screen spinner reused for both auth-check and lazy-route fallbacks. */
const FullScreenSpinner: React.FC = () => (
  <div className="flex h-screen items-center justify-center bg-slate-950">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
  </div>
);

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

  // Plain logout — ends the auth session only. Work-time tracking is fully
  // decoupled (Start/End work in the top bar handles that), so signing out
  // never closes or "saves" a working session or shows a time prompt.
  const handleLogout = async () => {
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
  };

  if (checking) {
    return <FullScreenSpinner />;
  }

  // Public /reset-password route. Available to any visitor (logged in or not)
  // since password recovery may be initiated from an authenticated session too.
  if (path === '/reset-password') {
    return (
      <Suspense fallback={<FullScreenSpinner />}>
        <ResetPasswordPage onBackToLogin={() => navigate('/')} />
      </Suspense>
    );
  }

  if (!loggedIn) {
    return <LoginPage onLoginSuccess={() => setLoggedIn(true)} />;
  }

  const RolePage =
    currentUser?.role === 'supervisor' ? SupervisorPage : currentUser?.role === 'employee' ? EmployeePage : AdminPage;

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <RolePage onLogout={handleLogout} initialAiShareToken={pendingShareToken} onAiShareConsumed={clearAiShareParam} />
    </Suspense>
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
