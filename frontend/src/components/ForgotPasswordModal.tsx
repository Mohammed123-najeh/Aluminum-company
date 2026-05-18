import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { auth } from '../services/api';

type Props = {
  initialEmail?: string;
  onClose: () => void;
  onResetComplete?: (email: string) => void;
};

type Step = 'request' | 'verify' | 'done';

export const ForgotPasswordModal: React.FC<Props> = ({ initialEmail, onClose, onResetComplete }) => {
  const { t } = useApp();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number>(15);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown countdown for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : t('forgotErrorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError(t('forgotCodeLengthError'));
      return;
    }
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
      await auth.resetPassword(email.trim(), code.trim(), password, confirmPassword);
      setStep('done');
      onResetComplete?.(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('forgotResetError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="bg-linear-to-r from-sky-500 to-blue-600 px-6 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
                {t('forgotBadge')}
              </p>
              <h2 className="text-lg font-bold leading-tight">{t('forgotTitle')}</h2>
              <p className="mt-0.5 text-xs text-white/80">
                {step === 'request' && t('forgotStepRequestHint')}
                {step === 'verify' && t('forgotStepVerifyHint')}
                {step === 'done' && t('forgotStepDoneHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/10 p-1.5 text-white/90 transition hover:bg-white/20"
              aria-label={t('close')}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {info && (
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy || !email.trim()}
                  className="flex-1 rounded-lg bg-linear-to-r from-sky-500 to-blue-600 py-2.5 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:opacity-50"
                >
                  {busy ? '…' : t('forgotSendCode')}
                </button>
              </div>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={submitReset} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('forgotSentTo')} <span className="font-semibold text-slate-700 dark:text-slate-200">{email}</span>.{' '}
                {t('forgotExpiresInPart1')} <span className="font-semibold">{expiresIn}</span> {t('forgotExpiresInPart2')}
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('forgotCodeLabel')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-center font-mono text-xl tracking-[0.5em] text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('forgotNewPasswordLabel')}
                </label>
                <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/20 dark:border-slate-600 dark:bg-slate-700">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="ms-2 text-xs font-medium text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showPassword ? t('forgotHide') : t('forgotShow')}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{t('forgotPasswordMinHint')}</p>
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  required
                  minLength={8}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setStep('request')}
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

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy || code.length !== 6 || password.length < 8 || password !== confirmPassword}
                  className="flex-1 rounded-lg bg-linear-to-r from-sky-500 to-blue-600 py-2.5 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:opacity-50"
                >
                  {busy ? '…' : t('forgotResetButton')}
                </button>
              </div>
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
                onClick={onClose}
                className="w-full rounded-lg bg-linear-to-r from-sky-500 to-blue-600 py-2.5 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500"
              >
                {t('forgotBackToLogin')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
