import React from 'react';
import { stripCustomOrderFence } from '../../utils/taskDescription';

type Props = {
  description: string | null | undefined;
  clamp?: boolean;
  className?: string;
};

/**
 * Renders a task description with the embedded custom-order JSON fence
 * stripped out. Preserves line breaks so the bullet list reads naturally.
 */
export const TaskDescription: React.FC<Props> = ({ description, clamp, className }) => {
  const text = stripCustomOrderFence(description);
  if (!text) return null;
  return (
    <p
      className={`${clamp ? 'line-clamp-2' : 'whitespace-pre-line'} text-sm text-slate-600 dark:text-slate-400 ${className ?? ''}`}
    >
      {text}
    </p>
  );
};
