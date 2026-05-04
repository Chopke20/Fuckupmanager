import type { OrderEquipmentItem, OrderProductionItem } from '@lama-stage/shared-types'

export interface OrderFinancialSummary {
  equipmentTotal: number
  productionTotal: number
  revenueNet: number
  discountAmount: number
  netAfterDiscount: number
  vatAmount: number
  grossTotal: number
  subcontractorTotal: number
  rentalTotal: number
  ownMarginNet: number
  marginPercent: number
}

function toNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** Netto pozycji sprzętu (bez rozróżnienia rental — ten sam wzór co przychód z pozycji). */
export function computeEquipmentLineNet(item: Partial<OrderEquipmentItem>): number {
  const base = toNum(item.unitPrice, 0) * toNum(item.quantity, 1)
  const day1Multiplier = item.pricingRule?.day1 ?? 1.0
  const nextDaysMultiplier = item.pricingRule?.nextDays ?? 0.5
  const firstDayValue = base * day1Multiplier
  const days = toNum(item.days, 1)
  const extraDaysValue = days > 1 ? (days - 1) * base * nextDaysMultiplier : 0
  const multiDay = firstDayValue + extraDaysValue
  return multiDay * (1 - toNum(item.discount, 0) / 100)
}

/** Netto pozycji produkcji / transportu. */
export function computeProductionLineNet(item: Partial<OrderProductionItem>): number {
  const base = toNum(item.rateValue, 0) * toNum(item.units, 1)
  return base * (1 - toNum(item.discount, 0) / 100)
}

function hasCustomMarginPair(q: unknown, c: unknown): boolean {
  const uq = toNum(q, NaN)
  const uc = toNum(c, NaN)
  return q != null && c != null && Number.isFinite(uq) && Number.isFinite(uc) && uq > 0 && uc >= 0
}

/**
 * Kwota odejmowana od marży dla pozycji rental (domyślnie cały netto pozycji).
 * Gdy wypełnione oba pola: marginRentalUnits × marginRentalUnitCostNet.
 */
export function computeRentalMarginDeduction(item: Partial<OrderEquipmentItem>): number {
  if (!item.isRental) return 0
  const lineNet = computeEquipmentLineNet(item)
  if (hasCustomMarginPair(item.marginRentalUnits, item.marginRentalUnitCostNet)) {
    return toNum(item.marginRentalUnits, 0) * toNum(item.marginRentalUnitCostNet, 0)
  }
  return lineNet
}

/**
 * Kwota odejmowana od marży dla podwykonawcy (domyślnie cały netto pozycji).
 */
export function computeSubcontractorMarginDeduction(item: Partial<OrderProductionItem>): number {
  if (!item.isSubcontractor) return 0
  const lineNet = computeProductionLineNet(item)
  if (hasCustomMarginPair(item.marginSubcontractorUnits, item.marginSubcontractorUnitCostNet)) {
    return toNum(item.marginSubcontractorUnits, 0) * toNum(item.marginSubcontractorUnitCostNet, 0)
  }
  return lineNet
}

export function calculateOrderFinancialSummary(
  order: { discountGlobal?: number; vatRate?: number },
  equipmentItems: Partial<OrderEquipmentItem>[] = [],
  productionItems: Partial<OrderProductionItem>[] = []
): OrderFinancialSummary {
  const equipmentTotal = equipmentItems.reduce((sum, item) => sum + computeEquipmentLineNet(item), 0)

  const rentalTotal = equipmentItems.reduce((sum, item) => sum + computeRentalMarginDeduction(item), 0)

  const productionTotal = productionItems.reduce((sum, item) => sum + computeProductionLineNet(item), 0)

  const subcontractorTotal = productionItems.reduce((sum, item) => sum + computeSubcontractorMarginDeduction(item), 0)

  const revenueNet = equipmentTotal + productionTotal
  const discountAmount = revenueNet * ((order.discountGlobal ?? 0) / 100)
  const netAfterDiscount = revenueNet - discountAmount
  const vatAmount = netAfterDiscount * ((order.vatRate ?? 23) / 100)
  const grossTotal = netAfterDiscount + vatAmount
  const ownMarginNet = netAfterDiscount - subcontractorTotal - rentalTotal
  const marginPercent = netAfterDiscount > 0 ? (ownMarginNet / netAfterDiscount) * 100 : 0

  return {
    equipmentTotal,
    productionTotal,
    revenueNet,
    discountAmount,
    netAfterDiscount,
    vatAmount,
    grossTotal,
    subcontractorTotal,
    rentalTotal,
    ownMarginNet,
    marginPercent,
  }
}
