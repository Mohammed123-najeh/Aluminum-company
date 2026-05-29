export type TabItem<K extends string> = {
  key: K;
  label: string;
  badge?: number;
};

type Props<K extends string> = {
  items: TabItem<K>[];
  active: K;
  onChange: (k: K) => void;
};

/** Horizontal pill tab bar (wraps on small screens). */
export function TabBar<K extends string>({ items, active, onChange }: Props<K>) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/20'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            <span>{it.label}</span>
            {it.badge !== undefined && it.badge > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}`}>
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
