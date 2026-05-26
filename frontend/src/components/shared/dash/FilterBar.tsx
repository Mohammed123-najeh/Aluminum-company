import React from 'react';
import { inputClass } from './FormModal';

type Props = {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  dateFrom?: string;
  dateTo?: string;
  onDateChange?: (from: string, to: string) => void;
  children?: React.ReactNode;
};

export const FilterBar: React.FC<Props> = ({
  search,
  onSearchChange,
  searchPlaceholder,
  dateFrom,
  dateTo,
  onDateChange,
  children,
}) => (
  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    {onSearchChange && (
      <input
        type="search"
        value={search ?? ''}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder ?? 'Search…'}
        className={`${inputClass} w-56 max-w-full`}
      />
    )}
    {onDateChange && (
      <>
        <input
          type="date"
          value={dateFrom ?? ''}
          onChange={(e) => onDateChange(e.target.value, dateTo ?? '')}
          className={`${inputClass} w-36`}
        />
        <span className="text-xs text-slate-400">—</span>
        <input
          type="date"
          value={dateTo ?? ''}
          onChange={(e) => onDateChange(dateFrom ?? '', e.target.value)}
          className={`${inputClass} w-36`}
        />
      </>
    )}
    {children}
  </div>
);
