import { useEffect, useRef } from 'react';

/**
 * Calls `callback` every `intervalMs`, but only while the browser tab is visible.
 *
 * Background tabs stop polling entirely (no wasted requests / battery), and the
 * moment the tab becomes visible again the callback fires once immediately so the
 * user sees fresh data without waiting for the next tick. Pass `enabled: false`
 * (e.g. when logged out) to suspend polling without unmounting the host hook.
 *
 * The latest `callback` is always used via a ref, so callers don't need to
 * memoize it to keep the interval stable.
 */
export function useVisiblePoll(callback: () => void, intervalMs: number, enabled = true): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState === 'visible') cbRef.current();
    };

    const id = window.setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === 'visible') cbRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, enabled]);
}
