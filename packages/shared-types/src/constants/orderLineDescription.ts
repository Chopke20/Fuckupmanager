/** Maks. długość opisu pozycji zlecenia (sprzęt, zasoby, transport) w formularzu i API. */
export const ORDER_LINE_DESCRIPTION_MAX_LENGTH = 120

/** Skrót opisu w PDF oferty (inline przy nazwie pozycji). */
export const ORDER_LINE_DESCRIPTION_PDF_MAX_LENGTH = 72

export function clampOrderLineDescription(
  value: string | null | undefined,
  maxLength: number = ORDER_LINE_DESCRIPTION_MAX_LENGTH
): string {
  if (value == null) return ''
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  if (trimmed.length <= maxLength) return trimmed
  return trimmed.slice(0, maxLength)
}

export function truncateOrderLineDescriptionForPdf(
  value: string | null | undefined,
  maxLength: number = ORDER_LINE_DESCRIPTION_PDF_MAX_LENGTH
): string {
  const trimmed = clampOrderLineDescription(value, maxLength + 32)
  if (!trimmed) return ''
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}
