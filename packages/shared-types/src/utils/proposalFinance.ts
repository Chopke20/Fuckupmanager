export const MAX_PROPOSAL_OPTIONS = 6

function toNum(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function round2(value: number): number {
  return Number(value.toFixed(2))
}

function parsePricingRule(raw: unknown): { day1: number; nextDays: number } {
  let obj: { day1?: unknown; nextDays?: unknown } | null = null
  if (typeof raw === 'string' && raw.trim()) {
    try {
      obj = JSON.parse(raw) as { day1?: unknown; nextDays?: unknown }
    } catch {
      obj = null
    }
  } else if (raw && typeof raw === 'object') {
    obj = raw as { day1?: unknown; nextDays?: unknown }
  }
  return {
    day1: toNum(obj?.day1, 1),
    nextDays: toNum(obj?.nextDays, 0.5),
  }
}

export function computeProposalEquipmentNet(item: {
  unitPrice?: number | null
  quantity?: number | null
  days?: number | null
  discount?: number | null
  pricingRule?: unknown
}): number {
  const base = toNum(item.unitPrice, 0) * toNum(item.quantity, 1)
  const rule = parsePricingRule(item.pricingRule)
  const days = toNum(item.days, 1)
  const firstDayValue = base * rule.day1
  const extraDaysValue = days > 1 ? (days - 1) * base * rule.nextDays : 0
  return round2((firstDayValue + extraDaysValue) * (1 - toNum(item.discount, 0) / 100))
}

export function computeProposalProductionNet(item: {
  rateValue?: number | null
  units?: number | null
  discount?: number | null
}): number {
  const base = toNum(item.rateValue, 0) * toNum(item.units, 1)
  return round2(base * (1 - toNum(item.discount, 0) / 100))
}

export function applyGlobalDiscountAndVat(args: {
  netBeforeGlobal: number
  discountGlobal: number
  vatRate: number
}): { netAfterDiscount: number; vatAmount: number; grossTotal: number } {
  const discountAmount = round2(args.netBeforeGlobal * (toNum(args.discountGlobal, 0) / 100))
  const netAfterDiscount = round2(args.netBeforeGlobal - discountAmount)
  const vatAmount = round2(netAfterDiscount * (toNum(args.vatRate, 23) / 100))
  return {
    netAfterDiscount,
    vatAmount,
    grossTotal: round2(netAfterDiscount + vatAmount),
  }
}

export function proposalOptionKey(kind: string, targetId: string): string {
  return `${kind}:${targetId}`
}
