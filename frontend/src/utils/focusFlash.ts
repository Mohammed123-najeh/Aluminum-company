/**
 * Global "flash this item" channel used by notification clicks. The bell fires
 * a CustomEvent and any list/panel that knows how to render the target subscribes
 * to it. The contract is intentionally tiny so it works across sections without
 * a context provider.
 *
 * Kinds in use:
 *   - 'task'             — focus and highlight a task row
 *   - 'message'          — highlight the most recent message in a thread peer
 *   - 'leave-request'    — HR leave queue row
 *   - 'salary-request'   — admin/HR salary queue row
 *   - 'debit-request'    — HR debit queue row
 *   - 'submission'       — admin submissions queue row
 */
export type FocusKind =
  | 'task'
  | 'message'
  | 'leave-request'
  | 'salary-request'
  | 'debit-request'
  | 'submission';

export type FocusFlashDetail = {
  kind: FocusKind;
  id: string;
};

const EVENT = 'focus:flash';

export function emitFocusFlash(detail: FocusFlashDetail): void {
  window.dispatchEvent(new CustomEvent<FocusFlashDetail>(EVENT, { detail }));
}

/**
 * Subscribe to focus-flash events. The handler receives `(id)` for the matching
 * kind only and is expected to find the DOM node, scroll it into view, and
 * apply the flash class. Returns a cleanup function.
 */
export function onFocusFlash(
  kind: FocusKind,
  handler: (id: string) => void,
): () => void {
  const listener = (e: Event) => {
    const d = (e as CustomEvent<FocusFlashDetail>).detail;
    if (d?.kind === kind && d.id) handler(d.id);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/**
 * Apply a 2-second flash highlight to a DOM node. Adds the ring + a small
 * pulse animation, scrolls the node into view, then cleans up. Safe to call
 * even when the node is null.
 */
export function flashElement(el: HTMLElement | null): void {
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('flash-target');
  window.setTimeout(() => {
    el.classList.remove('flash-target');
  }, 2000);
}
