/**
 * Numer zlecenia w formacie ZL-1/26, ZL-2/26 (numer w roku + rok 2-cyfrowy).
 * Powiązana oferta: 1.1.2026 = orderNumber.offerVersion.orderYear.
 */
export function formatOrderNumber(
  orderNumber: number | null | undefined,
  orderYear: number | null | undefined
): string {
  if (orderNumber == null || orderYear == null || orderNumber < 1) return '—'
  const yearShort = String(orderYear % 100).padStart(2, '0')
  return `ZL-${orderNumber}/${yearShort}`
}

/**
 * Numer oferty powiązany ze zleceniem: orderNumber.offerVersion.orderYear, np. 1.1.2026
 */
export function formatOfferNumber(
  orderNumber: number | null | undefined,
  offerVersion: number | null | undefined,
  orderYear: number | null | undefined
): string {
  if (orderNumber == null || orderYear == null || orderNumber < 1) return '—'
  const ver = offerVersion ?? 0
  return `${orderNumber}.${ver}.${orderYear}`
}
