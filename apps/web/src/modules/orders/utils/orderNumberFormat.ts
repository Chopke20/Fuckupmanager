import { buildDocumentNumber, formatOrderReference } from '@lama-stage/shared-types'

// Format: ORD-{YY}-{NNNN}  e.g. ORD-26-0042
export function formatOrderNumber(
  orderNumber: number | null | undefined,
  orderYear: number | null | undefined
): string {
  if (orderNumber == null || orderYear == null || orderNumber < 1) return '—'
  return formatOrderReference(orderNumber, orderYear)
}

// Format: OFR-{YY}-{NNNN}-v{V}  e.g. OFR-26-0016-v3 (aligned with `buildDocumentNumber` for OFFER)
export function formatOfferNumber(
  orderNumber: number | null | undefined,
  offerVersion: number | null | undefined,
  orderYear: number | null | undefined
): string {
  if (orderNumber == null || orderYear == null || orderNumber < 1) return '—'
  const ver = offerVersion ?? 0
  return buildDocumentNumber({
    documentType: 'OFFER',
    orderNumber,
    orderYear,
    version: ver,
  })
}
