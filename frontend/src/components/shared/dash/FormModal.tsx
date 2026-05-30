import React from 'react';

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  children: React.ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
};

export const FormModal: React.FC<Props> = ({ title, open, onClose, onSubmit, children, submitLabel = 'Save', cancelLabel = 'Cancel', submitting, size = 'md', footer }) => {
  if (!open) return null;
  const sizeClass = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';
  const body = <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/40 p-4 backdrop-blur-sm">
      <div className={`w-full ${sizeClass} overflow-hidden rounded-3xl bg-white shadow-2xl shadow-indigo-900/20 dark:bg-slate-900`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.3 4.3a1 1 0 0 1 1.4 0L10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 0 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 0 1 0-1.4z" />
            </svg>
          </button>
        </div>
        {onSubmit ? (
          <form onSubmit={onSubmit}>
            {body}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/40">
              {footer}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {cancelLabel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition hover:bg-indigo-500 hover:shadow-md disabled:opacity-50"
              >
                {submitting ? '…' : submitLabel}
              </button>
            </div>
          </form>
        ) : (
          <>
            {body}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/40">
              {footer}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {cancelLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; hint?: string; className?: string }> = ({ label, required, children, hint, className }) => (
  <label className={`block ${className ?? ''}`}>
    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
      {label}
      {required && <span className="text-rose-500"> *</span>}
    </span>
    <div className="mt-1.5">{children}</div>
    {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
  </label>
);

export const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
