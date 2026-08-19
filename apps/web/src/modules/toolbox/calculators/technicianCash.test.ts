import { describe, expect, it } from 'vitest'
import { calculateTechnicianCashQuote } from './technicianCash'

describe('calculateTechnicianCashQuote', () => {
  it('liczy brutto tak, żeby po VAT 23% i CIT 9% zostało 1000 zł gotówki', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      incomeTaxPercent: 9,
      payoutKind: 'cash_not_deductible',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.invoiceGross).toBeGreaterThan(1000)
    expect(result.cashToTechnician).toBe(1000)
    const leftover = result.invoiceNet - result.incomeTaxAmount
    expect(leftover).toBeCloseTo(1000, 1)
    expect(result.invoiceNet + result.vatAmount).toBeCloseTo(result.invoiceGross, 2)
    expect(result.totalToTaxOffice).toBeCloseTo(result.vatAmount + result.incomeTaxAmount, 2)
  })

  it('przy zerowym CIT dolicza tylko VAT', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      incomeTaxPercent: 0,
      payoutKind: 'cash_not_deductible',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.invoiceNet).toBe(1000)
    expect(result.vatAmount).toBe(230)
    expect(result.invoiceGross).toBe(1230)
    expect(result.incomeTaxAmount).toBe(0)
  })

  it('gdy wypłata jest kosztem i nie ma marży, dolicza tylko VAT', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      incomeTaxPercent: 9,
      keepAfterTax: 0,
      payoutKind: 'deductible_cost',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.invoiceNet).toBe(1000)
    expect(result.invoiceGross).toBe(1230)
    expect(result.incomeTaxAmount).toBe(0)
  })

  it('gdy wypłata jest kosztem, CIT liczy tylko od kwoty zostawionej w firmie', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      incomeTaxPercent: 9,
      keepAfterTax: 100,
      payoutKind: 'deductible_cost',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.companyKeep).toBeCloseTo(100, 0)
    expect(result.cashToTechnician).toBe(1000)
    expect(result.invoiceNet).toBeGreaterThan(1100)
  })

  it('mnoży gotówkę przez liczbę techników', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 500,
      peopleCount: 2,
      vatPercent: 23,
      incomeTaxPercent: 0,
      payoutKind: 'cash_not_deductible',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cashToTechnician).toBe(1000)
    expect(result.invoiceGross).toBe(1230)
  })

  it('zaokrągla brutto w górę do pełnych złotych i zostawia co najmniej żądaną gotówkę', () => {
    const exact = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      incomeTaxPercent: 9,
      payoutKind: 'cash_not_deductible',
      roundClientGrossUp: false,
    })
    const rounded = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      incomeTaxPercent: 9,
      payoutKind: 'cash_not_deductible',
      roundClientGrossUp: true,
    })
    expect(exact.ok && rounded.ok).toBe(true)
    if (!exact.ok || !rounded.ok) return
    expect(Number.isInteger(rounded.invoiceGross)).toBe(true)
    expect(rounded.invoiceGross).toBeGreaterThanOrEqual(Math.ceil(exact.invoiceGross - 1e-9))
    expect(rounded.invoiceNet - rounded.incomeTaxAmount).toBeGreaterThanOrEqual(1000)
  })

  it('odrzuca podatek dochodowy 100%', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      incomeTaxPercent: 100,
      payoutKind: 'cash_not_deductible',
    })
    expect(result.ok).toBe(false)
  })
})
