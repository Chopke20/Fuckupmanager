import { describe, expect, it } from 'vitest'
import {
  calculateTechnicianCashQuote,
  keepFractionAfterIncomeCharges,
} from './technicianCash'

describe('keepFractionAfterIncomeCharges', () => {
  it('liniowy 19% + zdrowotna 4,9% z pełnym odliczeniem', () => {
    // 1 - 0.19*(1-0.049) - 0.049 = 1 - 0.18069 - 0.049 = 0.77031
    expect(keepFractionAfterIncomeCharges(19, 4.9, 1)).toBeCloseTo(0.77031, 5)
  })

  it('skala 12% + zdrowotna 9% bez odliczenia', () => {
    expect(keepFractionAfterIncomeCharges(12, 9, 0)).toBeCloseTo(0.79, 5)
  })

  it('CIT 9% bez zdrowotnej krańcowej', () => {
    expect(keepFractionAfterIncomeCharges(9, 0, 0)).toBeCloseTo(0.91, 5)
  })
})

describe('calculateTechnicianCashQuote', () => {
  it('S.C. / JDG liniowy: po VAT, PIT 19% i zdrowotnej 4,9% zostaje 1000 zł gotówki', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      taxRegimeId: 'pit_linear',
      payoutKind: 'cash_not_deductible',
      roundClientGrossUp: false,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.healthPercent).toBe(4.9)
    expect(result.incomeTaxPercent).toBe(19)
    const afterCharges =
      result.invoiceNet - result.incomeTaxAmount - result.healthAmount
    expect(afterCharges).toBeCloseTo(1000, 1)
    expect(result.healthAmount).toBeGreaterThan(0)
    expect(result.invoiceGross).toBeGreaterThan(result.invoiceNet)
  })

  it('skala 12%: zdrowotna 9% bez odliczenia podnosi brutto względem samego PIT', () => {
    const withHealth = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      taxRegimeId: 'pit_scale_12',
      payoutKind: 'cash_not_deductible',
      roundClientGrossUp: false,
    })
    const taxOnly = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      taxRegimeId: 'custom',
      incomeTaxPercent: 12,
      healthPercent: 0,
      healthDeductibleShare: 0,
      payoutKind: 'cash_not_deductible',
      roundClientGrossUp: false,
    })
    expect(withHealth.ok && taxOnly.ok).toBe(true)
    if (!withHealth.ok || !taxOnly.ok) return
    expect(withHealth.invoiceGross).toBeGreaterThan(taxOnly.invoiceGross)
    expect(withHealth.healthAmount).toBeGreaterThan(0)
  })

  it('CIT 9%: bez krańcowej zdrowotnej, po podatku zostaje gotówka', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      taxRegimeId: 'cit_9',
      payoutKind: 'cash_not_deductible',
      roundClientGrossUp: false,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.healthAmount).toBe(0)
    expect(result.invoiceNet - result.incomeTaxAmount).toBeCloseTo(1000, 1)
  })

  it('przy zerowych obciążeniach dolicza tylko VAT', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      taxRegimeId: 'custom',
      incomeTaxPercent: 0,
      healthPercent: 0,
      healthDeductibleShare: 0,
      payoutKind: 'cash_not_deductible',
      roundClientGrossUp: false,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.invoiceNet).toBe(1000)
    expect(result.vatAmount).toBe(230)
    expect(result.invoiceGross).toBe(1230)
  })

  it('gdy wypłata jest kosztem i nie ma marży, dolicza tylko VAT', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      taxRegimeId: 'pit_linear',
      keepAfterTax: 0,
      payoutKind: 'deductible_cost',
      roundClientGrossUp: false,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.invoiceNet).toBe(1000)
    expect(result.invoiceGross).toBe(1230)
    expect(result.incomeTaxAmount).toBe(0)
    expect(result.healthAmount).toBe(0)
  })

  it('gdy wypłata jest kosztem, obciążenia tylko od kwoty zostawionej w firmie', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      taxRegimeId: 'pit_linear',
      keepAfterTax: 100,
      payoutKind: 'deductible_cost',
      roundClientGrossUp: false,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.companyKeep).toBeCloseTo(100, 0)
    expect(result.cashToTechnician).toBe(1000)
    expect(result.healthAmount).toBeGreaterThan(0)
    expect(result.invoiceNet).toBeGreaterThan(1100)
  })

  it('mnoży gotówkę przez liczbę techników', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 500,
      peopleCount: 2,
      vatPercent: 23,
      taxRegimeId: 'custom',
      incomeTaxPercent: 0,
      healthPercent: 0,
      healthDeductibleShare: 0,
      payoutKind: 'cash_not_deductible',
      roundClientGrossUp: false,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cashToTechnician).toBe(1000)
    expect(result.invoiceGross).toBe(1230)
  })

  it('zaokrągla brutto w górę i zostawia co najmniej żądaną gotówkę (liniowy)', () => {
    const exact = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      taxRegimeId: 'pit_linear',
      payoutKind: 'cash_not_deductible',
      roundClientGrossUp: false,
    })
    const rounded = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      taxRegimeId: 'pit_linear',
      payoutKind: 'cash_not_deductible',
      roundClientGrossUp: true,
    })
    expect(exact.ok && rounded.ok).toBe(true)
    if (!exact.ok || !rounded.ok) return
    expect(Number.isInteger(rounded.invoiceGross)).toBe(true)
    expect(rounded.invoiceGross).toBeGreaterThanOrEqual(Math.ceil(exact.invoiceGross - 1e-9))
    const leftover =
      rounded.invoiceNet - rounded.incomeTaxAmount - rounded.healthAmount
    expect(leftover).toBeGreaterThanOrEqual(1000)
  })

  it('odrzuca podatek 100%', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      taxRegimeId: 'custom',
      incomeTaxPercent: 100,
      healthPercent: 0,
      payoutKind: 'cash_not_deductible',
    })
    expect(result.ok).toBe(false)
  })

  it('odrzuca gdy podatek + zdrowotna zjadają cały dochód', () => {
    const result = calculateTechnicianCashQuote({
      cashToTechnician: 1000,
      vatPercent: 23,
      taxRegimeId: 'custom',
      incomeTaxPercent: 50,
      healthPercent: 50,
      healthDeductibleShare: 0,
      payoutKind: 'cash_not_deductible',
    })
    expect(result.ok).toBe(false)
  })
})
