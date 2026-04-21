import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { StockTaskFulfillmentPanel } from '../shared/StockTaskFulfillmentPanel';

type Props = {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
  onCompleted: () => void | Promise<void>;
};

export const SalesTaskFulfillmentModal: React.FC<Props> = ({ taskId, taskTitle, onClose, onCompleted }) => {
  const { t } = useApp();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900">
        <header className="shrink-0 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t('salesDeskTitle')}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{taskTitle}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{t('salesDeskSubtitleEmployee')}</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <StockTaskFulfillmentPanel
            mode="employee"
            taskId={taskId}
            taskTitle={taskTitle}
            delegatedFulfill={false}
            onFulfilled={onCompleted}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};
