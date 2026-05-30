/**
 * Task descriptions for custom orders embed a fenced JSON block —
 *
 *     ```customOrder
 *     {"brief":"...","customer":{...},"cards":[...]}
 *     ```
 *
 * so the structured spec can round-trip without a DB migration. The fence is
 * meant for machines; humans should see the prose above it (which
 * buildOrderDescription has already rendered as a nice bullet list).
 *
 * Strip the fence on display, everywhere a task description is shown.
 */
const FENCE_REGEX = /```customOrder\s*\n[\s\S]*?\n```/g;

export function stripCustomOrderFence(description: string | null | undefined): string {
  if (!description) return '';
  return description.replace(FENCE_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();
}
