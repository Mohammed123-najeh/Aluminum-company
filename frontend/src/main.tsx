import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import { AppProvider, useApp } from './contexts/AppContext';
import { LoginPage } from './LoginPage';
import { AdminPage } from './pages/AdminPage';
import { SupervisorPage } from './pages/SupervisorPage';
import { EmployeePage } from './pages/EmployeePage';
import { auth } from './services/api';

function readAiShareParam(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('aiShare');
  } catch {
    return null;
  }
}

const App: React.FC = () => {
  const { token, setToken, setAdminProfile, setCurrentUser, currentUser } = useApp();
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pendingShareToken, setPendingShareToken] = useState<string | null>(() => readAiShareParam());

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
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginPage onLoginSuccess={() => setLoggedIn(true)} />;
  }

  if (currentUser?.role === 'supervisor') {
    return (
      <SupervisorPage
        onLogout={handleLogout}
        initialAiShareToken={pendingShareToken}
        onAiShareConsumed={clearAiShareParam}
      />
    );
  }
  if (currentUser?.role === 'employee') {
    return (
      <EmployeePage
        onLogout={handleLogout}
        initialAiShareToken={pendingShareToken}
        onAiShareConsumed={clearAiShareParam}
      />
    );
  }
  return (
    <AdminPage
      onLogout={handleLogout}
      initialAiShareToken={pendingShareToken}
      onAiShareConsumed={clearAiShareParam}
    />
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
