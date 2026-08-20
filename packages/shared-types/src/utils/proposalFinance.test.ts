import { describe, it, expect } from 'vitest'
import {
  applyGlobalDiscountAndVat,
  computeProposalEquipmentNet,
  computeProposalProductionNet,
  proposalOptionKey,
} from './proposalFinance'
import { MAX_PROPOSAL_OPTIONS, ProposalDocumentDraftSchema } from '../schemas/order-document.schema'

describe('proposalFinance', () => {
  it('counts equipment with day-1 / next-days rule', () => {
    expect(
      computeProposalEquipmentNet({
        unitPrice: 100,
        quantity: 2,
        days: 3,
        discount: 0,
        pricingRule: { day1: 1, nextDays: 0.5 },
      })
    ).toBe(400)
  })

  it('applies VAT after global discount', () => {
    const r = applyGlobalDiscountAndVat({ netBeforeGlobal: 1000, discountGlobal: 10, vatRate: 23 })
    expect(r.netAfterDiscount).toBe(900)
    expect(r.vatAmount).toBe(207)
    expect(r.grossTotal).toBe(1107)
  })

  it('rejects more than 6 options in draft', () => {
    const options = Array.from({ length: MAX_PROPOSAL_OPTIONS + 1 }, (_, i) => ({
      id: `BLOCK:00000000-0000-4000-8000-00000000000${i}`,
      kind: 'BLOCK' as const,
      targetId: '00000000-0000-4000-8000-000000000001',
      rationale: '',
    }))
    const parsed = ProposalDocumentDraftSchema.safeParse({ options })
    expect(parsed.success).toBe(false)
  })

  it('builds stable option keys', () => {
    expect(proposalOptionKey('BLOCK', 'abc')).toBe('BLOCK:abc')
  })

  it('counts production net with discount', () => {
    expect(computeProposalProductionNet({ rateValue: 500, units: 2, discount: 10 })).toBe(900)
  })
})
