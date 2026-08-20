/**
 * Kalkulator: ile wystawić klientowi, żeby po VAT, podatku i składce zdrowotnej
 * zostać z żądaną gotówką dla technika.
 *
 * Model krańcowy (wycenowy) — nie zastępuje księgowości.
 * Stawki zdrowotne wg zasad 2026 (rok składkowy od II 2026):
 * - skala: 9% dochodu (bez odliczenia)
 * - liniowy: 4,9% dochodu, odliczenie od dochodu/kosztów do limitu rocznego
 * - ryczałt: składka progowa (stała miesięczna) — nie rośnie z pojedynczą fakturą
 * - CIT (sp. z o.o.): zdrowotna wspólnika/zarządu jest zryczałtowana — nie doliczamy krańcowo
 */

export type TechnicianPayoutKind = 'cash_not_deductible' | 'deductible_cost'

export type TaxRegimeId =
  | 'pit_linear'
  | 'pit_scale_12'
  | 'pit_scale_32'
  | 'cit_9'
  | 'cit_19'
  | 'ryczalt_8_5'
  | 'ryczalt_12'
  | 'ryczalt_15'
  | 'custom'

export interface TaxRegimeDefinition {
  id: TaxRegimeId
  label: string
  shortLabel: string
  /** Podatek dochodowy / ryczałt od przychodu (netto faktury). */
  incomeTaxPercent: number
  /** Składka zdrowotna krańcowa od dochodu/przychodu (0 = nie rośnie z tą fakturą). */
  healthPercent: number
  /**
   * Jaka część składki zdrowotnej pomniejsza podstawę podatku.
   * liniowy: 100% (w limicie), ryczałt: 50% zapłaconej — ale przy health=0 i tak bez wpływu.
   * skala / CIT: 0.
   */
  healthDeductibleShare: number
  hint: string
}

/** Prefabrykowane formy — S.C. i JDG na PIT; CIT osobno. */
export const TAX_REGIMES: TaxRegimeDefinition[] = [
  {
    id: 'pit_linear',
    label: 'PIT liniowy 19% (JDG / S.C.)',
    shortLabel: 'Liniowy 19%',
    incomeTaxPercent: 19,
    healthPercent: 4.9,
    healthDeductibleShare: 1,
    hint: 'Domyślnie dla S.C. / JDG na liniowym. Zdrowotna 4,9% dochodu; do limitu rocznego pomniejsza dochód.',
  },
  {
    id: 'pit_scale_12',
    label: 'PIT skala 12% (I próg)',
    shortLabel: 'Skala 12%',
    incomeTaxPercent: 12,
    healthPercent: 9,
    healthDeductibleShare: 0,
    hint: 'Skala podatkowa w I progu. Zdrowotna 9% dochodu, bez odliczenia od podatku/dochodu.',
  },
  {
    id: 'pit_scale_32',
    label: 'PIT skala 32% (II próg)',
    shortLabel: 'Skala 32%',
    incomeTaxPercent: 32,
    healthPercent: 9,
    healthDeductibleShare: 0,
    hint: 'Skala w II progu. Zdrowotna 9% dochodu, bez odliczenia.',
  },
  {
    id: 'cit_9',
    label: 'CIT 9% (sp. z o.o. / S.A.)',
    shortLabel: 'CIT 9%',
    incomeTaxPercent: 9,
    healthPercent: 0,
    healthDeductibleShare: 0,
    hint: 'Preferencyjny CIT. Zdrowotna wspólnika jest zryczałtowana — nie doliczamy krańcowo do tej faktury.',
  },
  {
    id: 'cit_19',
    label: 'CIT 19%',
    shortLabel: 'CIT 19%',
    incomeTaxPercent: 19,
    healthPercent: 0,
    healthDeductibleShare: 0,
    hint: 'Standardowy CIT. Zdrowotna wspólnika zryczałtowana — bez krańcowego doliczenia.',
  },
  {
    id: 'ryczalt_8_5',
    label: 'Ryczałt 8,5%',
    shortLabel: 'Ryczałt 8,5%',
    incomeTaxPercent: 8.5,
    healthPercent: 0,
    healthDeductibleShare: 0.5,
    hint: 'Zdrowotna na ryczałcie jest progowa (miesięczna), nie rośnie z jedną fakturą — tu tylko podatek od przychodu.',
  },
  {
    id: 'ryczalt_12',
    label: 'Ryczałt 12%',
    shortLabel: 'Ryczałt 12%',
    incomeTaxPercent: 12,
    healthPercent: 0,
    healthDeductibleShare: 0.5,
    hint: 'Jak wyżej: zdrowotna progowa, w wycenie krańcowej tylko ryczałt od przychodu.',
  },
  {
    id: 'ryczalt_15',
    label: 'Ryczałt 15%',
    shortLabel: 'Ryczałt 15%',
    incomeTaxPercent: 15,
    healthPercent: 0,
    healthDeductibleShare: 0.5,
    hint: 'Jak wyżej: zdrowotna progowa, w wycenie krańcowej tylko ryczałt od przychodu.',
  },
  {
    id: 'custom',
    label: 'Własne stawki',
    shortLabel: 'Własne',
    incomeTaxPercent: 19,
    healthPercent: 4.9,
    healthDeductibleShare: 1,
    hint: 'Ustaw ręcznie % podatku, zdrowotnej i czy zdrowotna pomniejsza podstawę.',
  },
]

export function getTaxRegime(id: TaxRegimeId): TaxRegimeDefinition {
  return TAX_REGIMES.find((r) => r.id === id) ?? TAX_REGIMES[0]!
}

export interface TechnicianCashInput {
  cashToTechnician: number
  peopleCount?: number
  vatPercent: number
  /** Preferowane: gotowa forma. Przy `custom` używane są pola poniżej. */
  taxRegimeId?: TaxRegimeId
  incomeTaxPercent?: number
  healthPercent?: number
  /** 0–1: ile zdrowotnej schodzi z podstawy podatku (liniowy ≈ 1, skala 0, ryczałt 0.5). */
  healthDeductibleShare?: number
  keepAfterTax?: number
  payoutKind: TechnicianPayoutKind
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
  healthAmount: number
  totalPublicBurden: number
  companyKeep: number
  multiplierGrossPerCash: number
  incomeTaxPercent: number
  healthPercent: number
  healthDeductibleShare: number
  keepFraction: number
  taxRegimeId: TaxRegimeId
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
 * Jaka część netto zostaje po podatku i zdrowotnej (przed VAT).
 * healthDeductibleShare: zdrowotna pomniejsza podstawę podatku w tej proporcji.
 */
export function keepFractionAfterIncomeCharges(
  incomeTaxPercent: number,
  healthPercent: number,
  healthDeductibleShare: number
): number {
  const t = incomeTaxPercent / 100
  const h = healthPercent / 100
  const d = Math.min(1, Math.max(0, healthDeductibleShare))
  // podatek = t * (1 - d*h) * N; zdrowotna = h * N
  return 1 - t * (1 - d * h) - h
}

function resolveRates(input: TechnicianCashInput): {
  taxRegimeId: TaxRegimeId
  incomeTaxPercent: number
  healthPercent: number
  healthDeductibleShare: number
} {
  const regimeId = input.taxRegimeId ?? 'custom'
  if (regimeId === 'custom') {
    return {
      taxRegimeId: 'custom',
      incomeTaxPercent: input.incomeTaxPercent ?? 19,
      healthPercent: input.healthPercent ?? 0,
      healthDeductibleShare: input.healthDeductibleShare ?? 0,
    }
  }
  const regime = getTaxRegime(regimeId)
  return {
    taxRegimeId: regimeId,
    incomeTaxPercent: input.incomeTaxPercent ?? regime.incomeTaxPercent,
    healthPercent: input.healthPercent ?? regime.healthPercent,
    healthDeductibleShare: input.healthDeductibleShare ?? regime.healthDeductibleShare,
  }
}

function chargesOnTaxableBase(
  taxableBase: number,
  incomeTaxPercent: number,
  healthPercent: number,
  healthDeductibleShare: number
): { incomeTaxAmount: number; healthAmount: number } {
  const t = incomeTaxPercent / 100
  const h = healthPercent / 100
  const d = Math.min(1, Math.max(0, healthDeductibleShare))
  const healthAmount = roundMoney(taxableBase * h)
  const incomeTaxAmount = roundMoney(taxableBase * (1 - d * h) * t)
  return { incomeTaxAmount, healthAmount }
}

/**
 * `cash_not_deductible` — gotówka nie schodzi jako koszt: VAT + podatek + zdrowotna od netto.
 * `deductible_cost` — wypłata jest kosztem: obciążenia tylko od kwoty zostawionej w firmie.
 */
export function calculateTechnicianCashQuote(input: TechnicianCashInput): TechnicianCashQuote {
  const cashPerPerson = input.cashToTechnician
  const peopleCount = Math.max(1, Math.floor(input.peopleCount ?? 1))
  const keepWanted = input.keepAfterTax ?? 0
  const vatPercent = input.vatPercent
  const { taxRegimeId, incomeTaxPercent, healthPercent, healthDeductibleShare } = resolveRates(input)

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
  if (!isNonNegativeFinite(healthPercent) || healthPercent >= 100) {
    return { ok: false, error: 'Składka zdrowotna musi być w zakresie 0–99,99%.' }
  }
  if (
    !isNonNegativeFinite(healthDeductibleShare) ||
    healthDeductibleShare > 1
  ) {
    return { ok: false, error: 'Udział odliczenia zdrowotnej musi być w zakresie 0–1.' }
  }

  const keepFraction = keepFractionAfterIncomeCharges(
    incomeTaxPercent,
    healthPercent,
    healthDeductibleShare
  )
  if (keepFraction <= MONEY_EPS) {
    return { ok: false, error: 'Suma podatku i zdrowotnej zjada cały dochód — obniż stawki.' }
  }

  const vatRate = vatPercent / 100
  const totalCash = cashPerPerson * peopleCount
  const needAfterCharges = totalCash + keepWanted

  let invoiceNet: number
  if (input.payoutKind === 'deductible_cost') {
    const taxableNeeded =
      keepWanted > 0 ? keepWanted / keepFraction : 0
    invoiceNet = totalCash + taxableNeeded
  } else {
    invoiceNet = needAfterCharges / keepFraction
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
  let healthAmount: number
  let companyKeep: number

  if (input.payoutKind === 'deductible_cost') {
    const taxableBase = Math.max(0, invoiceNet - totalCash)
    const charges = chargesOnTaxableBase(
      taxableBase,
      incomeTaxPercent,
      healthPercent,
      healthDeductibleShare
    )
    incomeTaxAmount = charges.incomeTaxAmount
    healthAmount = charges.healthAmount
    companyKeep = roundMoney(taxableBase - incomeTaxAmount - healthAmount)
  } else {
    const charges = chargesOnTaxableBase(
      invoiceNet,
      incomeTaxPercent,
      healthPercent,
      healthDeductibleShare
    )
    incomeTaxAmount = charges.incomeTaxAmount
    healthAmount = charges.healthAmount
    companyKeep = roundMoney(invoiceNet - incomeTaxAmount - healthAmount - totalCash)
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
    healthAmount,
    totalPublicBurden: roundMoney(vatAmount + incomeTaxAmount + healthAmount),
    companyKeep,
    multiplierGrossPerCash: Math.round(multiplier * 1000) / 1000,
    incomeTaxPercent,
    healthPercent,
    healthDeductibleShare,
    keepFraction: Math.round(keepFraction * 100000) / 100000,
    taxRegimeId,
  }
}

export function formatPln(value: number): string {
  return `${value.toLocaleString('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} PLN`
}
