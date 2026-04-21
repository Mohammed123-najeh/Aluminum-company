/** App-wide display currency (Israeli new shekel). */
export const DISPLAY_CURRENCY = 'ILS' as const;

const ilsFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: DISPLAY_CURRENCY,
});

/** Format an amount as ₪ (ILS), e.g. for totals and line items. */
export function formatIls(amount: number): string {
  return ilsFormatter.format(amount);
}
