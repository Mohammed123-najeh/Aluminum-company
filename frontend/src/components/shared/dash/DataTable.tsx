import React from 'react';

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  render: (row: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'start' | 'center' | 'end';
  hideOnMobile?: boolean;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, index: number) => string;
  empty?: React.ReactNode;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  dense?: boolean;
};

export function DataTable<T>({ rows, columns, rowKey, empty, loading, onRowClick, dense }: Props<T>) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
          Loading…
        </span>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-600">
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
        {empty ?? 'No data'}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
        <thead className="sticky top-0 bg-indigo-50/60 dark:bg-indigo-950/30">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-3 text-${c.align ?? 'start'} text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 ${c.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`transition-colors ${i % 2 === 1 ? 'bg-indigo-50/20 dark:bg-slate-800/20' : ''} ${onRowClick ? 'cursor-pointer hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'}`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-4 ${dense ? 'py-2' : 'py-3'} text-${c.align ?? 'start'} text-slate-700 dark:text-slate-200 ${c.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                >
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
