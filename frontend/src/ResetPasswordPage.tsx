import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './contexts/AppContext';
import { auth } from './services/api';

type Step = 'request' | 'verify' | 'reset' | 'done';

type Props = {
  /** Called when the user wants to leave the reset flow and go back to login. */
  onBackToLogin: () => void;
  /** Optional email pre-fill if the user clicked from the login screen. */
  initialEmail?: string;
};

/**
 * Dedicated password-reset page. Three explicit stages:
 *   1. Request   — user types their email; we email them a 6-digit code.
 *   2. Verify    — user enters the code; we check it without consuming it
 *                  (so the next step can be re-rendered if the user reloads).
 *   3. Reset     — user picks a new password; we consume the code and update.
 * The final "done" stage shows confirmation and a CTA back to login.
 *
 * The flow lives on its own URL (/reset-password) instead of in a modal so it
 * feels like a deliberate, single-purpose screen — no overlapping with the
 * login form, and we get a stable URL to link to from emails later if needed.
 */
export const ResetPasswordPage: React.FC<Props> = ({ onBackToLogin, initialEmail }) => {
  const { t, lang, setLang, theme, toggleTheme } = useApp();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number>(15);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const code = useMemo(() => codeDigits.join(''), [codeDigits]);

  // Refs for the 6 OTP inputs so we can auto-advance focus.
  const codeInputsRef = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  // Focus the first OTP box when arriving at the verify step.
  useEffect(() => {
    if (step === 'verify') {
      codeInputsRef.current[0]?.focus();
    }
  }, [step]);

  const setDigit = (i: number, raw: string) => {
    const cleaned = raw.replace(/\D+/g, '');
    if (cleaned.length === 0) {
      setCodeDigits((prev) => prev.map((d, idx) => (idx === i ? '' : d)));
      return;
    }
    // Support paste of the full code into any single box.
    if (cleaned.length > 1) {
      const next = ['', '', '', '', '', ''];
      for (let k = 0; k < Math.min(cleaned.length, 6); k++) next[k] = cleaned[k];
      setCodeDigits(next);
      const lastFilled = Math.min(cleaned.length, 6) - 1;
      codeInputsRef.current[lastFilled]?.focus();
      return;
    }
    setCodeDigits((prev) => prev.map((d, idx) => (idx === i ? cleaned : d)));
    if (i < 5) codeInputsRef.current[i + 1]?.focus();
  };

  const handleCodeKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[i] && i > 0) {
      codeInputsRef.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      codeInputsRef.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      codeInputsRef.current[i + 1]?.focus();
    }
  };

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await auth.forgotPassword(email.trim());
      setInfo(res.message);
      setExpiresIn(res.expiresInMinutes);
      setResendCooldown(30);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('forgotErrorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (resendCooldown > 0) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await auth.forgotPassword(email.trim());
      setInfo(res.message);
      setExpiresIn(res.expiresInMinutes);
      setResendCooldown(30);
      setCodeDigits(['', '', '', '', '', '']);
      codeInputsRef.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('forgotErrorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError(t('forgotCodeLengthError'));
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await auth.verifyPasswordCode(email.trim(), code);
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('forgotErrorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(t('forgotPasswordMinError'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('forgotPasswordMatchError'));
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await auth.resetPassword(email.trim(), code, password, confirmPassword);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('forgotResetError'));
    } finally {
      setBusy(false);
    }
  };

  const stepIndex = step === 'request' ? 1 : step === 'verify' ? 2 : step === 'reset' ? 3 : 4;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#e5f0ff,_transparent_55%),radial-gradient(circle_at_bottom,_#e2e8f0,_transparent_55%)] dark:bg-none" />
      </div>

      {/* Top bar: language + theme + back to login */}
      <div className="relative z-10 flex items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={onBackToLogin}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t('forgotBackToLogin')}
        </button>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white/80 text-xs font-medium dark:border-slate-700 dark:bg-slate-800/80">
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1.5 transition ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('ar')}
              className={`px-3 py-1.5 transition ${lang === 'ar' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'}`}
            >
              AR
            </button>
          </div>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? t('lightMode') : t('darkMode')}
            className="rounded-lg border border-slate-200 bg-white/80 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:text-slate-100"
          >
            {theme === 'dark' ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-start px-4 py-6 sm:py-12">
        <div className="w-full max-w-md">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/90">
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-5 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
                {t('forgotBadge')}
              </p>
              <h1 className="mt-0.5 text-xl font-bold leading-tight">{t('forgotTitle')}</h1>
              <p className="mt-1 text-sm text-white/80">
                {step === 'request' && t('forgotStepRequestHint')}
                {step === 'verify' && t('forgotStepVerifyHint')}
                {step === 'reset' && t('reset.stepResetHint')}
                {step === 'done' && t('forgotStepDoneHint')}
              </p>

              {/* Step indicator */}
              <ol className="mt-4 flex items-center gap-2 text-[11px] font-semibold">
                {(['1', '2', '3'] as const).map((n, i) => {
                  const idx = i + 1;
                  const active = stepIndex === idx;
                  const done = stepIndex > idx;
                  return (
                    <li key={n} className="flex flex-1 items-center gap-2">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                          done
                            ? 'bg-emerald-400 text-emerald-900'
                            : active
                              ? 'bg-white text-blue-700'
                              : 'bg-white/20 text-white/70'
                        }`}
                      >
                        {done ? '✓' : n}
                      </span>
                      {idx < 3 && <span className="h-px flex-1 bg-white/30" />}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Body */}
            <div className="p-6">
              {info && step !== 'done' && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {info}
                </div>
              )}
              {error && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {error}
                </div>
              )}

              {step === 'request' && (
                <form onSubmit={requestCode} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('forgotEmailLabel')}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      required
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !email.trim()}
                    className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/30 transition hover:from-sky-400 hover:to-blue-500 disabled:opacity-50"
                  >
                    {busy ? '…' : t('forgotSendCode')}
                  </button>
                </form>
              )}

              {step === 'verify' && (
                <form onSubmit={verifyCode} className="space-y-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('forgotSentTo')}{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{email}</span>
                    .{' '}
                    {t('forgotExpiresInPart1')} <span className="font-semibold">{expiresIn}</span>{' '}
                    {t('forgotExpiresInPart2')}
                  </p>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('forgotCodeLabel')}
                    </label>
                    <div className="flex justify-between gap-2" dir="ltr">
                      {codeDigits.map((d, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            codeInputsRef.current[i] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={1}
                          value={d}
                          onChange={(e) => setDigit(i, e.target.value)}
                          onKeyDown={(e) => handleCodeKeyDown(i, e)}
                          className="h-12 w-11 rounded-lg border border-slate-200 bg-white text-center font-mono text-xl font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('request');
                        setCodeDigits(['', '', '', '', '', '']);
                        setError(null);
                      }}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      ← {t('forgotChangeEmail')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void resendCode()}
                      disabled={resendCooldown > 0 || busy}
                      className="font-medium text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400"
                    >
                      {resendCooldown > 0
                        ? `${t('forgotResendIn')} ${resendCooldown}s`
                        : t('forgotResendCode')}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || code.length !== 6}
                    className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/30 transition hover:from-sky-400 hover:to-blue-500 disabled:opacity-50"
                  >
                    {busy ? '…' : t('reset.verifyButton')}
                  </button>
                </form>
              )}

              {step === 'reset' && (
                <form onSubmit={submitReset} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('forgotNewPasswordLabel')}
                    </label>
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/20 dark:border-slate-600 dark:bg-slate-800">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100"
                        required
                        minLength={8}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="ms-2 text-xs font-medium text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        {showPassword ? t('forgotHide') : t('forgotShow')}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {t('forgotPasswordMinHint')}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('forgotConfirmPasswordLabel')}
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      required
                      minLength={8}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busy || password.length < 8 || password !== confirmPassword}
                    className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/30 transition hover:from-sky-400 hover:to-blue-500 disabled:opacity-50"
                  >
                    {busy ? '…' : t('forgotResetButton')}
                  </button>
                </form>
              )}

              {step === 'done' && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{t('forgotDoneMessage')}</p>
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/30 transition hover:from-sky-400 hover:to-blue-500"
                  >
                    {t('forgotBackToLogin')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
