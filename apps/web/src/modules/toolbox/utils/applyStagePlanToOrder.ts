import type { Equipment, OrderEquipmentItem, StagePlan, StagePlanRoleMapEntry } from '@lama-stage/shared-types'
import {
  STAGE_PLAN_LINE_MARKER,
  formatMeters,
  resolveStagePlanOrderLines,
  stagePlanApplyBlockingIssues,
} from '@lama-stage/shared-types'

export {
  resolveStagePlanOrderLines,
  stagePlanApplyBlockingIssues,
  indexStagePlanRoleMaps,
} from '@lama-stage/shared-types'
export type {
  StagePlanRoleMapEntry,
  ResolvedStageOrderLine,
  StagePlanApplyIssue,
} from '@lama-stage/shared-types'

export function isStagePlanEquipmentLine(item: Partial<OrderEquipmentItem>): boolean {
  const desc = typeof item.description === 'string' ? item.description : ''
  return desc.includes(STAGE_PLAN_LINE_MARKER)
}

export function applyStagePlanToEquipmentItems(params: {
  existing: Partial<OrderEquipmentItem>[]
  plan: StagePlan
  catalog: Equipment[]
  roleMaps: StagePlanRoleMapEntry[]
  days: number
  offerBlockId?: string | null
}): {
  items: Partial<OrderEquipmentItem>[]
  issues: ReturnType<typeof resolveStagePlanOrderLines>['issues']
  blockingIssues: ReturnType<typeof stagePlanApplyBlockingIssues>
} {
  const targetBlockId = params.offerBlockId ?? null
  const kept = params.existing.filter((item) => {
    if (!isStagePlanEquipmentLine(item)) return true
    const itemBlockId = item.offerBlockId ?? null
    return itemBlockId !== targetBlockId
  })

  const { lines, issues } = resolveStagePlanOrderLines({
    plan: params.plan,
    maps: params.roleMaps,
    catalog: params.catalog,
  })
  const blockingIssues = stagePlanApplyBlockingIssues(issues)

  if (blockingIssues.length > 0) {
    return { items: params.existing, issues, blockingIssues }
  }

  const now = Date.now()
  const dim = `${params.plan.widthM}×${params.plan.depthM} m, nogi ${params.plan.legHeightCm} cm`
  const newItems: Partial<OrderEquipmentItem>[] = lines.map((line, idx) => {
    const eq = line.equipment
    const quantity = Math.max(1, Math.ceil(line.quantity))
    const exact =
      line.unit === 'szt.' ? '' : ` · ${formatMeters(line.quantity)} ${line.unit}`
    return {
      id: `temp-stage-${now}-${idx}`,
      orderId: '',
      equipmentId: eq.id,
      equipment: eq,
      name: eq.name,
      description: `${STAGE_PLAN_LINE_MARKER} ${dim}${exact}`,
      category: eq.category === 'SCENA' ? 'Scena' : eq.category,
      quantity,
      unitPrice: eq.dailyPrice ?? 0,
      days: Math.max(1, params.days),
      discount: 0,
      pricingRule: eq.pricingRule || { day1: 1.0, nextDays: 0.5 },
      visibleInOffer: eq.visibleInOffer !== false,
      isRental: false,
      sortOrder: kept.length + idx,
      offerBlockId: params.offerBlockId ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  return {
    items: [...kept, ...newItems],
    issues,
    blockingIssues,
  }
}
