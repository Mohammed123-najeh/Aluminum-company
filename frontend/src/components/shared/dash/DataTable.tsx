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
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
        Loading…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
        {empty ?? 'No data'}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/60">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2.5 text-${c.align ?? 'start'} text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${c.hideOnMobile ? 'hidden md:table-cell' : ''}`}
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
              className={`${i % 2 === 1 ? 'bg-slate-50/40 dark:bg-slate-800/20' : ''} ${onRowClick ? 'cursor-pointer hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30' : ''}`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 ${dense ? 'py-1.5' : 'py-2.5'} text-${c.align ?? 'start'} text-slate-700 dark:text-slate-200 ${c.hideOnMobile ? 'hidden md:table-cell' : ''}`}
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
