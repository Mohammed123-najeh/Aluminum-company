import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { auth } from '../services/api';

type Props = {
  onSuccess?: () => void;
};

export const LoginForm: React.FC<Props> = ({ onSuccess }) => {
  const { t, setToken, setAdminProfile, setCurrentUser } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!identifier || !password) {
      setError(t('invalidCredentials'));
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await auth.login(identifier, password);
      setToken(token);
      setAdminProfile({ name: user.name, email: user.email });
      setCurrentUser(user);
      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {t('welcomeBack')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('loginSubtitle')}</p>
      </div>

      <div className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
            {t('emailOrUsername')}
          </label>
          <div className="group flex items-center rounded-lg border border-slate-300/70 bg-white/80 px-3 py-2 text-sm shadow-sm transition hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800/80 dark:hover:border-slate-500 dark:focus-within:border-blue-400">
            <span className="me-2 text-slate-400 group-focus-within:text-blue-500">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </span>
            <input
              type="email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={t('emailPlaceholderLogin')}
              className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
            {t('password')}
          </label>
          <div className="group flex items-center rounded-lg border border-slate-300/70 bg-white/80 px-3 py-2 text-sm shadow-sm transition hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800/80 dark:hover:border-slate-500 dark:focus-within:border-blue-400">
            <span className="me-2 text-slate-400 group-focus-within:text-blue-500">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="ms-2 text-xs font-medium text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </div>

      {/* Remember + Forgot */}
      <div className="flex items-center justify-between text-xs">
        <label className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          {t('rememberMe')}
        </label>
        <button
          type="button"
          className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {t('forgotPassword')}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white">✓</span>
          {t('loginSuccess')}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || success}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {t('loggingIn')}
          </>
        ) : (
          t('loginButton')
        )}
      </button>

      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
        {t('systemVersion')}
      </p>
    </form>
  );
};
