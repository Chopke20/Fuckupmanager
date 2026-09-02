import type { Equipment, OrderEquipmentItem, StageBomLine, StagePlan } from '@lama-stage/shared-types'
import { STAGE_PLAN_LINE_MARKER, formatMeters } from '@lama-stage/shared-types'

export interface StageBomMappingIssue {
  line: StageBomLine
  kind: 'unmapped' | 'unit_mismatch'
  equipment?: Equipment
}

export function buildStageCatalogMap(catalog: Equipment[]): Map<string, Equipment> {
  const map = new Map<string, Equipment>()
  for (const item of catalog) {
    if (item.category === 'ZASOBY') continue
    const key = item.stagePlanKey?.trim()
    if (key) map.set(key, item)
  }
  return map
}

export function getStageBomMappingIssues(
  plan: StagePlan,
  catalog: Equipment[]
): StageBomMappingIssue[] {
  const byKey = buildStageCatalogMap(catalog)
  const issues: StageBomMappingIssue[] = []
  for (const line of plan.bom) {
    const equipment = byKey.get(line.catalogKey)
    if (!equipment) {
      issues.push({ line, kind: 'unmapped' })
      continue
    }
    const unit = (equipment.unit || 'szt.').trim()
    if (unit !== line.unit) {
      issues.push({ line, kind: 'unit_mismatch', equipment })
    }
  }
  return issues
}

export function isStagePlanEquipmentLine(item: Partial<OrderEquipmentItem>): boolean {
  const desc = typeof item.description === 'string' ? item.description : ''
  return desc.includes(STAGE_PLAN_LINE_MARKER)
}

export function applyStagePlanToEquipmentItems(params: {
  existing: Partial<OrderEquipmentItem>[]
  plan: StagePlan
  catalog: Equipment[]
  days: number
  offerBlockId?: string | null
}): Partial<OrderEquipmentItem>[] {
  const targetBlockId = params.offerBlockId ?? null
  const kept = params.existing.filter((item) => {
    if (!isStagePlanEquipmentLine(item)) return true
    const itemBlockId = item.offerBlockId ?? null
    return itemBlockId !== targetBlockId
  })
  const byKey = buildStageCatalogMap(params.catalog)
  const now = Date.now()
  const dim = `${params.plan.widthM}×${params.plan.depthM} m, nogi ${params.plan.legHeightCm} cm`
  const newItems: Partial<OrderEquipmentItem>[] = params.plan.bom.map((line, idx) => {
    const eq = byKey.get(line.catalogKey)
    const quantity = Math.max(1, Math.ceil(line.quantity))
    const exact =
      line.unit === 'szt.' ? '' : ` · ${formatMeters(line.quantity)} ${line.unit}`
    return {
      id: `temp-stage-${now}-${idx}`,
      orderId: '',
      equipmentId: eq?.id,
      equipment: eq,
      name: eq?.name || line.name,
      description: `${STAGE_PLAN_LINE_MARKER} ${dim}${exact}`,
      category: eq ? (eq.category === 'SCENA' ? 'Scena' : eq.category) : 'Scena',
      quantity,
      unitPrice: eq?.dailyPrice ?? 0,
      days: Math.max(1, params.days),
      discount: 0,
      pricingRule: eq?.pricingRule || { day1: 1.0, nextDays: 0.5 },
      visibleInOffer: eq ? eq.visibleInOffer !== false : line.offer,
      isRental: false,
      sortOrder: kept.length + idx,
      offerBlockId: params.offerBlockId ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })
  return [...kept, ...newItems]
}
