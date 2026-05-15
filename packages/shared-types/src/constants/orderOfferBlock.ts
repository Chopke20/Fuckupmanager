/** Maksymalna długość tytułu bloku oferty (PDF + formularz). */
export const ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH = 80;

export function clampOrderOfferBlockTitle(value: unknown): string {
  if (value == null) return '';
  return String(value).trim().slice(0, ORDER_OFFER_BLOCK_TITLE_MAX_LENGTH);
}
