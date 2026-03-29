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

export function calculateOrderFinancialSummary(
  order: { discountGlobal?: number; vatRate?: number },
  equipmentItems: Partial<OrderEquipmentItem>[] = [],
  productionItems: Partial<OrderProductionItem>[] = []
): OrderFinancialSummary {
  const equipmentTotal = equipmentItems.reduce((sum, item) => {
    const base = (item.unitPrice ?? 0) * (item.quantity ?? 1)
    const day1Multiplier = item.pricingRule?.day1 ?? 1.0
    const nextDaysMultiplier = item.pricingRule?.nextDays ?? 0.5
    const firstDayValue = base * day1Multiplier
    const days = item.days ?? 1
    const extraDaysValue = days > 1 ? (days - 1) * base * nextDaysMultiplier : 0
    const multiDay = firstDayValue + extraDaysValue
    return sum + multiDay * (1 - (item.discount ?? 0) / 100)
  }, 0)

  const rentalTotal = equipmentItems
    .filter((item) => item.isRental)
    .reduce((sum, item) => {
      const base = (item.unitPrice ?? 0) * (item.quantity ?? 1)
      const day1Multiplier = item.pricingRule?.day1 ?? 1.0
      const nextDaysMultiplier = item.pricingRule?.nextDays ?? 0.5
      const firstDayValue = base * day1Multiplier
      const days = item.days ?? 1
      const extraDaysValue = days > 1 ? (days - 1) * base * nextDaysMultiplier : 0
      const multiDay = firstDayValue + extraDaysValue
      return sum + multiDay * (1 - (item.discount ?? 0) / 100)
    }, 0)

  const productionTotal = productionItems.reduce((sum, item) => {
    const base = (item.rateValue ?? 0) * (item.units ?? 1)
    return sum + base * (1 - (item.discount ?? 0) / 100)
  }, 0)

  const subcontractorTotal = productionItems
    .filter((item) => item.isSubcontractor)
    .reduce((sum, item) => {
      const base = (item.rateValue ?? 0) * (item.units ?? 1)
      return sum + base * (1 - (item.discount ?? 0) / 100)
    }, 0)

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
