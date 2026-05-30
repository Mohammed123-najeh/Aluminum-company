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
    <div className="mb-6 flex flex-wrap gap-2">
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-150 ${
              isActive
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            <span>{it.label}</span>
            {it.badge !== undefined && it.badge > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                }`}
              >
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
