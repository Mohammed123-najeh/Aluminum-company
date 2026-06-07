import React from 'react';
import { LoginForm } from './components/LoginForm';
import { BrandFullLogo } from './components/shared/BrandLogo';
import { useApp } from './contexts/AppContext';

type Props = { onLoginSuccess?: () => void };

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const { t, lang, setLang, theme, toggleTheme } = useApp();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#e5f0ff,_transparent_55%),radial-gradient(circle_at_bottom,_#e2e8f0,_transparent_55%)] dark:bg-none" />
        <div className="absolute -left-24 top-24 h-64 w-64 rotate-6 rounded-full bg-gradient-to-br from-slate-400/30 via-slate-200/30 to-white/50 blur-3xl dark:from-slate-700/30 dark:via-slate-800/30 dark:to-slate-900/50" />
        <div className="absolute -right-24 bottom-10 h-72 w-72 -rotate-6 rounded-full bg-gradient-to-tr from-sky-500/10 via-blue-500/10 to-slate-200/30 blur-3xl dark:from-sky-900/20 dark:via-blue-900/20" />
      </div>

      {/* Top bar: language + theme toggles */}
      <div className="relative z-10 flex items-center justify-end gap-2 p-4">
        {/* Language toggle */}
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
        {/* Dark mode toggle */}
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

      <div className="relative flex min-h-[calc(100vh-64px)] flex-col justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-2xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/80 lg:flex-row">

          {/* Left: branding */}
          <aside className="relative hidden w-full max-w-md flex-1 flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-950/50 to-slate-900 px-10 py-10 text-slate-50 lg:flex">
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute -left-10 top-10 h-40 w-40 rounded-full border border-slate-600/40" />
              <div className="absolute left-8 top-8 h-40 w-40 rounded-full border border-slate-500/30" />
              <div className="absolute inset-x-0 bottom-6 h-px bg-gradient-to-r from-transparent via-slate-500/50 to-transparent" />
              <div className="absolute right-6 top-24 h-20 w-20 rotate-12 rounded-xl border border-amber-600/30 bg-gradient-to-br from-amber-900/40 to-slate-900/80 shadow-lg shadow-black/60" />
            </div>

            <header className="relative flex flex-col items-center text-center">
              <div className="w-full rounded-2xl bg-white/95 px-5 pb-5 pt-4 shadow-2xl shadow-black/25 ring-1 ring-white/30">
                <BrandFullLogo />
              </div>
              <div className="mt-4 space-y-0.5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400/90 pt-1">
                  {t('adminPanel')}
                </p>
              </div>
            </header>

            <main className="relative mt-10 space-y-5">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-50">
                {t('brandHeadline')}
              </h2>
              <p className="text-sm leading-relaxed text-slate-300">{t('brandDesc')}</p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-[11px] text-slate-300">
                {[
                  { label: t('production'), sub: t('productionDesc') },
                  { label: t('inventory'), sub: t('inventoryDesc') },
                  { label: t('employeeOverview'), sub: t('employeeOverviewBlurb') },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2">
                    <p className="font-medium text-slate-100">{item.label}</p>
                    <p className="mt-1 text-slate-400">{item.sub}</p>
                  </div>
                ))}
              </div>
            </main>

            <footer className="relative mt-6 flex items-center justify-between text-[11px] text-slate-500">
              <p>{t('copyright')}</p>
              <p className="text-slate-400">{t('internalUse')}</p>
            </footer>
          </aside>

          {/* Right: login */}
          <section className="flex w-full flex-1 items-center justify-center px-6 py-10 sm:px-10">
            <div className="w-full max-w-md">
              {/* Mobile header */}
              <div className="mb-6 flex flex-col items-center gap-3 lg:hidden">
                <div className="w-full rounded-2xl bg-white/95 px-4 pb-4 pt-3 shadow-lg shadow-slate-900/10 ring-1 ring-slate-200/80 dark:ring-slate-700/80">
                  <BrandFullLogo compact />
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {t('secureAccess')}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white/90 px-6 py-7 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-700/50 dark:bg-slate-800/90">
                <LoginForm onSuccess={onLoginSuccess} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
