/**
 * Lightweight URL navigation primitive used in lieu of a full router.
 *
 * - `navigate(path)` updates the URL via `history.pushState` and fires an
 *   `app:navigate` custom event so subscribers (see `useUrlPath`) re-render.
 * - Subscribing components should listen for both `popstate` (browser
 *   back/forward) and `app:navigate` (programmatic navigation).
 *
 * Kept in `utils/` to avoid circular imports from `main.tsx`.
 */
export function navigate(to: string): void {
  if (window.location.pathname === to) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new CustomEvent('app:navigate'));
}
