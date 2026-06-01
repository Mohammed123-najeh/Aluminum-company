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
 * pulse animation, scrolls the node into view, then cleans up.
 *
 * If the element exists but isn't visible yet (parent is display:none, e.g.
 * the section panel hasn't switched over), we don't bail — the caller's
 * `flashById` helper retries until the node has a non-zero size.
 */
export function flashElement(el: HTMLElement | null): void {
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Re-add the class even if it's already present (e.g. another flash triggered
  // mid-animation) by removing it for one frame first so the animation restarts.
  el.classList.remove('flash-target');
  void el.offsetWidth; // force reflow so the animation re-triggers
  el.classList.add('flash-target');
  window.setTimeout(() => {
    el.classList.remove('flash-target');
  }, 3000);
}

/**
 * Look up a `data-…-id` element by id and flash it. Retries up to ~1.5s
 * because notification clicks navigate to a section that may still be
 * mounting when the flash event arrives. Each retry waits 100ms.
 */
export function flashById(selector: string, attempts = 15): void {
  const tick = () => {
    const node = document.querySelector<HTMLElement>(selector);
    if (node && node.offsetParent !== null) {
      // offsetParent is null when the node (or any ancestor) is display:none,
      // so this check both confirms existence and visibility.
      flashElement(node);
      return;
    }
    if (attempts > 1) {
      window.setTimeout(() => flashById(selector, attempts - 1), 100);
    }
  };
  tick();
}
