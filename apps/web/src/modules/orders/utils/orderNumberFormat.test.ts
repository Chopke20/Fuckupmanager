import { describe, it, expect } from 'vitest'
import { buildDocumentNumber } from '@lama-stage/shared-types'
import { formatOrderNumber, formatOfferNumber } from './orderNumberFormat'

describe('orderNumberFormat', () => {
  it('formatOrderNumber uses ORD-YY-NNNN', () => {
    expect(formatOrderNumber(16, 2026)).toBe('ORD-26-0016')
    expect(formatOrderNumber(1, 2026)).toBe('ORD-26-0001')
    expect(formatOrderNumber(null, 2026)).toBe('—')
    expect(formatOrderNumber(16, null)).toBe('—')
  })

  it('formatOfferNumber matches OFFER export numbering', () => {
    expect(formatOfferNumber(16, 3, 2026)).toBe('OFR-26-0016-v3')
    expect(formatOfferNumber(16, 0, 2026)).toBe('OFR-26-0016-v0')
  })

  it('buildDocumentNumber uses type prefixes PRP / WHS / BRF', () => {
    expect(
      buildDocumentNumber({ documentType: 'PROPOSAL', orderNumber: 16, orderYear: 2026, version: 1 })
    ).toBe('PRP-26-0016-v1')
    expect(
      buildDocumentNumber({ documentType: 'WAREHOUSE', orderNumber: 16, orderYear: 2026, version: 2 })
    ).toBe('WHS-26-0016-v2')
    expect(
      buildDocumentNumber({ documentType: 'BRIEF', orderNumber: 16, orderYear: 2026, version: 1 })
    ).toBe('BRF-26-0016-v1')
  })
})
