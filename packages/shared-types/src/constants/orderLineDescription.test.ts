import { describe, it, expect } from 'vitest'
import {
  clampOrderLineDescription,
  truncateOrderLineDescriptionForPdf,
  ORDER_LINE_DESCRIPTION_MAX_LENGTH,
  ORDER_LINE_DESCRIPTION_PDF_MAX_LENGTH,
} from './orderLineDescription'

describe('orderLineDescription', () => {
  it('clampOrderLineDescription trims and limits length', () => {
    const long = 'a'.repeat(ORDER_LINE_DESCRIPTION_MAX_LENGTH + 10)
    expect(clampOrderLineDescription(`  ${long}  `).length).toBe(ORDER_LINE_DESCRIPTION_MAX_LENGTH)
    expect(clampOrderLineDescription('  krótki  ')).toBe('krótki')
    expect(clampOrderLineDescription(null)).toBe('')
  })

  it('truncateOrderLineDescriptionForPdf adds ellipsis when needed', () => {
    const long = 'x'.repeat(ORDER_LINE_DESCRIPTION_PDF_MAX_LENGTH + 20)
    const out = truncateOrderLineDescriptionForPdf(long)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(ORDER_LINE_DESCRIPTION_PDF_MAX_LENGTH + 1)
  })
})
