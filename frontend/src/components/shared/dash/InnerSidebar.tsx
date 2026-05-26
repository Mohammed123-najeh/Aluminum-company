import React from 'react';

export type InnerNavItem<K extends string> = {
  key: K;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
};

type Props<K extends string> = {
  items: InnerNavItem<K>[];
  active: K;
  onChange: (k: K) => void;
  title?: string;
};

export function InnerSidebar<K extends string>({ items, active, onChange, title }: Props<K>) {
  return (
    <aside className="w-56 shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {title && (
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{title}</p>
      )}
      <nav className="space-y-1">
        {items.map((it) => {
          const isActive = it.key === active;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onChange(it.key)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-indigo-950/40'
              }`}
            >
              <span className="flex items-center gap-2">
                {it.icon && (
                  <span className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`}>{it.icon}</span>
                )}
                <span className="text-start">{it.label}</span>
              </span>
              {it.badge !== undefined && it.badge > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}`}>
                  {it.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
