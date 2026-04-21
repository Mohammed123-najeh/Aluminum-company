import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';

type Props = { onClose: () => void };

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{title}</h3>
    {children}
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode; error?: string }> = ({ label, children, error }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
    {children}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500';

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const { t, lang, setLang, theme, toggleTheme, adminProfile, setAdminProfile, adminPassword, setAdminPassword } = useApp();

  // Profile state
  const [name, setName] = useState(adminProfile.name);
  const [email, setEmail] = useState(adminProfile.email);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pwError, setPwError] = useState('');

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdminProfile({ name: name.trim(), email: email.trim() });
    setProfileMsg(t('profileUpdated'));
    setTimeout(() => setProfileMsg(null), 2500);
  };

  const handlePasswordSave = (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setPwError('');

    if (currentPw !== adminPassword) {
      setPwError(t('passwordWrong'));
      return;
    }
    if (newPw.length < 8) {
      setPwError(t('passwordTooShort'));
      return;
    }
    if (newPw !== confirmPw) {
      setPwError(t('passwordMismatch'));
      return;
    }
    setAdminPassword(newPw);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwMsg({ text: t('passwordUpdated'), ok: true });
    setTimeout(() => setPwMsg(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden border-s border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('accountSettings')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{adminProfile.email}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto space-y-7 px-6 py-5">

          {/* ── Profile ── */}
          <Section title={t('profileSection')}>
            <form onSubmit={handleProfileSave} className="space-y-3">
              <Field label={t('fullName')}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label={t('emailAddress')}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
              </Field>
              {profileMsg && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{profileMsg}</p>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                {t('updateProfile')}
              </button>
            </form>
          </Section>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* ── Password ── */}
          <Section title={t('securitySection')}>
            <form onSubmit={handlePasswordSave} className="space-y-3">
              <Field label={t('currentPassword')}>
                <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition dark:border-slate-600 dark:bg-slate-700">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none dark:text-slate-100"
                  />
                  <button type="button" onClick={() => setShowCurrentPw((p) => !p)} className="px-3 text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                    {showCurrentPw ? 'Hide' : 'Show'}
                  </button>
                </div>
              </Field>

              <Field label={t('newPassword')}>
                <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition dark:border-slate-600 dark:bg-slate-700">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder={t('minPassword')}
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none dark:text-slate-100"
                  />
                  <button type="button" onClick={() => setShowNewPw((p) => !p)} className="px-3 text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                    {showNewPw ? 'Hide' : 'Show'}
                  </button>
                </div>
              </Field>

              <Field label={t('confirmNewPassword')}>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
              </Field>

              {pwError && <p className="text-xs text-red-500">{pwError}</p>}
              {pwMsg && <p className={`text-xs font-medium ${pwMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{pwMsg.text}</p>}

              <button
                type="submit"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {t('changePassword')}
              </button>
            </form>
          </Section>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* ── Language ── */}
          <Section title={t('languageSection')}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('systemLanguage')}</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {(['en', 'ar'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                    lang === l
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="text-base">{l === 'en' ? '🇬🇧' : '🇸🇦'}</span>
                  {l === 'en' ? t('english') : t('arabic')}
                </button>
              ))}
            </div>
          </Section>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* ── Theme ── */}
          <Section title={t('themeSection')}>
            <button
              type="button"
              onClick={toggleTheme}
              className={`flex w-full items-center justify-between rounded-xl border-2 px-5 py-4 transition ${
                theme === 'dark'
                  ? 'border-indigo-500 bg-slate-900 text-indigo-300'
                  : 'border-amber-400 bg-amber-50 text-amber-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
                <div className="text-start">
                  <p className="text-sm font-semibold">{theme === 'dark' ? t('darkMode') : t('lightMode')}</p>
                  <p className="text-xs opacity-70">{theme === 'dark' ? 'Click to switch to light' : 'Click to switch to dark'}</p>
                </div>
              </div>
              <div className={`h-5 w-10 rounded-full border-2 transition-colors ${theme === 'dark' ? 'border-indigo-500 bg-indigo-600' : 'border-amber-400 bg-amber-400'}`}>
                <div className={`mt-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-600">{t('systemVersion')}</p>
        </div>
      </div>
    </div>
  );
};
