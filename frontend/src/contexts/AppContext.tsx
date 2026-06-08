import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { translations } from '../i18n/translations';
import type { TKey, Lang } from '../i18n/translations';
import type { ApiUser } from '../services/api';

type Theme = 'light' | 'dark';

export type AdminProfile = {
  name: string;
  email: string;
};

type AppContextType = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  theme: Theme;
  toggleTheme: () => void;
  t: (key: TKey) => string;
  adminProfile: AdminProfile;
  setAdminProfile: (profile: AdminProfile) => void;
  adminPassword: string;
  setAdminPassword: (pw: string) => void;
  /** Sanctum Bearer token — null when logged out */
  token: string | null;
  setToken: (token: string | null) => void;
  /** Current logged-in user (role, id, etc.) — set after login and auth.me() */
  currentUser: ApiUser | null;
  setCurrentUser: (user: ApiUser | null) => void;
};

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>('en');
  const [theme, setTheme] = useState<Theme>('light');
  const [adminProfile, setAdminProfile] = useState<AdminProfile>({
    name: 'Mohammed',
    email: 'mohammed@gmail.com',
  });
  const [adminPassword, setAdminPassword] = useState('12345678');
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem('auth_token'),
  );
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem('auth_token', t);
    else localStorage.removeItem('auth_token');
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const toggleTheme = useCallback(
    () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')),
    [],
  );

  // `t` only changes when the language changes — keeping it stable means consumers
  // that depend on it don't re-render on unrelated state updates (theme, token, user).
  const t = useCallback((key: TKey): string => translations[lang][key] ?? key, [lang]);

  // Memoize the context value so a change to one field doesn't hand every consumer a
  // brand-new object (which would re-render the entire tree on every state update).
  const value = useMemo(
    () => ({ lang, setLang, theme, toggleTheme, t, adminProfile, setAdminProfile, adminPassword, setAdminPassword, token, setToken, currentUser, setCurrentUser }),
    [lang, setLang, theme, toggleTheme, t, adminProfile, adminPassword, token, setToken, currentUser],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
