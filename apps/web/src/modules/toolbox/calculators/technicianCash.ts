export type TechnicianPayoutKind = 'cash_not_deductible' | 'deductible_cost'

export interface TechnicianCashInput {
  /** Kwota gotówki dla jednego technika. */
  cashToTechnician: number
  /** Liczba techników (mnoży gotówkę). */
  peopleCount?: number
  vatPercent: number
  incomeTaxPercent: number
  /** Dodatkowa kwota, która ma zostać w firmie po podatku dochodowym. */
  keepAfterTax?: number
  payoutKind: TechnicianPayoutKind
  /** Zaokrąglij brutto dla klienta w górę do pełnych złotych. */
  roundClientGrossUp?: boolean
}

export interface TechnicianCashResult {
  ok: true
  peopleCount: number
  cashPerPerson: number
  cashToTechnician: number
  invoiceNet: number
  vatAmount: number
  invoiceGross: number
  incomeTaxAmount: number
  totalToTaxOffice: number
  companyKeep: number
  multiplierGrossPerCash: number
}

export interface TechnicianCashError {
  ok: false
  error: string
}

export type TechnicianCashQuote = TechnicianCashResult | TechnicianCashError

const MONEY_EPS = 1e-9

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Z kwoty gotówki dla technika liczy, ile wystawić klientowi.
 *
 * `cash_not_deductible` — gotówka nie schodzi jako koszt: VAT od brutto + podatek
 * dochodowy od całego netto, reszta ma wystarczyć na wypłatę.
 *
 * `deductible_cost` — wypłata jest kosztem (faktura / umowa): podatek dochodowy
 * tylko od kwoty, która ma zostać w firmie.
 */
export function calculateTechnicianCashQuote(input: TechnicianCashInput): TechnicianCashQuote {
  const cashPerPerson = input.cashToTechnician
  const peopleCount = Math.max(1, Math.floor(input.peopleCount ?? 1))
  const keepWanted = input.keepAfterTax ?? 0
  const vatPercent = input.vatPercent
  const incomeTaxPercent = input.incomeTaxPercent

  if (!isNonNegativeFinite(cashPerPerson)) {
    return { ok: false, error: 'Kwota dla technika musi być liczbą nieujemną.' }
  }
  if (!Number.isFinite(peopleCount) || peopleCount < 1) {
    return { ok: false, error: 'Liczba techników musi być co najmniej 1.' }
  }
  if (!isNonNegativeFinite(keepWanted)) {
    return { ok: false, error: 'Kwota do zostawienia w firmie musi być liczbą nieujemną.' }
  }
  if (!isNonNegativeFinite(vatPercent) || vatPercent > 100) {
    return { ok: false, error: 'VAT musi być w zakresie 0–100%.' }
  }
  if (!isNonNegativeFinite(incomeTaxPercent) || incomeTaxPercent >= 100) {
    return { ok: false, error: 'Podatek dochodowy musi być w zakresie 0–99,99%.' }
  }

  const vatRate = vatPercent / 100
  const citRate = incomeTaxPercent / 100
  const totalCash = cashPerPerson * peopleCount
  const needAfterIncomeTax = totalCash + keepWanted

  let invoiceNet: number
  if (input.payoutKind === 'deductible_cost') {
    const taxableBase = citRate > 0 && keepWanted > 0 ? keepWanted / (1 - citRate) : keepWanted
    invoiceNet = totalCash + taxableBase
  } else {
    invoiceNet = citRate > 0 ? needAfterIncomeTax / (1 - citRate) : needAfterIncomeTax
  }

  let invoiceGross = invoiceNet * (1 + vatRate)
  if (input.roundClientGrossUp) {
    invoiceGross = Math.ceil(invoiceGross - MONEY_EPS)
  } else {
    invoiceGross = roundMoney(invoiceGross)
  }

  const vatAmount = roundMoney(invoiceGross * (vatRate / (1 + vatRate || 1)))
  invoiceNet = roundMoney(invoiceGross - vatAmount)

  let incomeTaxAmount: number
  let companyKeep: number
  if (input.payoutKind === 'deductible_cost') {
    const profit = Math.max(0, invoiceNet - totalCash)
    incomeTaxAmount = roundMoney(profit * citRate)
    companyKeep = roundMoney(profit - incomeTaxAmount)
  } else {
    incomeTaxAmount = roundMoney(invoiceNet * citRate)
    companyKeep = roundMoney(invoiceNet - incomeTaxAmount - totalCash)
  }

  const cashToTechnician = roundMoney(totalCash)
  const multiplier = cashToTechnician > 0 ? invoiceGross / cashToTechnician : 0

  return {
    ok: true,
    peopleCount,
    cashPerPerson: roundMoney(cashPerPerson),
    cashToTechnician,
    invoiceNet,
    vatAmount,
    invoiceGross: roundMoney(invoiceGross),
    incomeTaxAmount,
    totalToTaxOffice: roundMoney(vatAmount + incomeTaxAmount),
    companyKeep,
    multiplierGrossPerCash: Math.round(multiplier * 1000) / 1000,
  }
}

export function formatPln(value: number): string {
  return `${value.toLocaleString('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} PLN`
}
