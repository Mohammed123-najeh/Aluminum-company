import React from 'react';

/** Keeps children mounted when inactive (hidden) so tab switches stay instant and data hooks don't remount. */
export const SectionPanel: React.FC<{
  active: boolean;
  children: React.ReactNode;
}> = ({ active, children }) => (
  <div className={active ? 'block min-h-0' : 'hidden'} aria-hidden={!active}>
    {children}
  </div>
);
