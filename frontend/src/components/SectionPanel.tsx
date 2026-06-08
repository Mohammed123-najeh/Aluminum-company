import React, { useRef } from 'react';

/**
 * Mount-on-first-open, then keep-alive.
 *
 * A section is NOT rendered until the first time it becomes active. After that it
 * stays mounted (just CSS-hidden when inactive) so re-opening is instant and its
 * data hooks don't refetch on every tab switch.
 *
 * This matters for two reasons:
 *  - Lazy panels (`React.lazy`) only download their JS chunk when first opened,
 *    instead of every panel's chunk loading at page mount.
 *  - The initial dashboard render reconciles only the default section's subtree,
 *    not all 8–12 panels at once.
 */
export const SectionPanel: React.FC<{
  active: boolean;
  children: React.ReactNode;
}> = ({ active, children }) => {
  const hasBeenActive = useRef(false);
  if (active) hasBeenActive.current = true;

  // Never opened yet → render nothing (no DOM, no hooks, no lazy chunk fetch).
  if (!hasBeenActive.current) return null;

  return (
    <div className={active ? 'block min-h-0' : 'hidden'} aria-hidden={!active}>
      {children}
    </div>
  );
};
