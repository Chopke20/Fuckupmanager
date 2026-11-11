import type { Equipment, OrderEquipmentItem, StagePlan, StagePlanRoleMapEntry } from '@lama-stage/shared-types'
import {
  STAGE_PLAN_LINE_MARKER,
  formatMeters,
  formatStagePlanEquipmentDescription,
  parseStagePlanSceneIdFromDescription,
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

/**
 * Czy linia należy do danej sceny w bloku.
 * Linie legacy (bez `#sceneId`) traktujemy jako należące do primarySceneId.
 */
export function stagePlanLineMatchesScene(
  item: Partial<OrderEquipmentItem>,
  params: {
    offerBlockId?: string | null
    sceneId: string
    primarySceneId?: string | null
  }
): boolean {
  if (!isStagePlanEquipmentLine(item)) return false
  const itemBlockId = item.offerBlockId ?? null
  const targetBlockId = params.offerBlockId ?? null
  if (itemBlockId !== targetBlockId) return false
  const lineSceneId = parseStagePlanSceneIdFromDescription(
    typeof item.description === 'string' ? item.description : null
  )
  if (lineSceneId === params.sceneId) return true
  if (lineSceneId === null && params.primarySceneId && params.primarySceneId === params.sceneId) {
    return true
  }
  return false
}

export function applyStagePlanToEquipmentItems(params: {
  existing: Partial<OrderEquipmentItem>[]
  plan: StagePlan
  catalog: Equipment[]
  roleMaps: StagePlanRoleMapEntry[]
  days: number
  offerBlockId?: string | null
  /** Identyfikator sceny w bloku — wymagany przy wielu scenach. */
  sceneId: string
  sceneName?: string
  /** Pierwsza scena zestawu — legacy linie bez #sceneId należą do niej. */
  primarySceneId?: string | null
}): {
  items: Partial<OrderEquipmentItem>[]
  issues: ReturnType<typeof resolveStagePlanOrderLines>['issues']
  blockingIssues: ReturnType<typeof stagePlanApplyBlockingIssues>
} {
  const kept = params.existing.filter(
    (item) =>
      !stagePlanLineMatchesScene(item, {
        offerBlockId: params.offerBlockId,
        sceneId: params.sceneId,
        primarySceneId: params.primarySceneId,
      })
  )

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
  const sceneName = (params.sceneName ?? 'Scena').trim() || 'Scena'
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
      description: formatStagePlanEquipmentDescription({
        sceneId: params.sceneId,
        sceneName,
        widthM: params.plan.widthM,
        depthM: params.plan.depthM,
        legHeightCm: params.plan.legHeightCm,
        exactSuffix: exact,
      }),
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

/** Usuwa z wykazu linie należące do sceny (np. po skasowaniu sceny w bloku). */
export function removeStagePlanSceneEquipmentItems(params: {
  existing: Partial<OrderEquipmentItem>[]
  offerBlockId?: string | null
  sceneId: string
  primarySceneId?: string | null
}): Partial<OrderEquipmentItem>[] {
  return params.existing.filter(
    (item) =>
      !stagePlanLineMatchesScene(item, {
        offerBlockId: params.offerBlockId,
        sceneId: params.sceneId,
        primarySceneId: params.primarySceneId,
      })
  )
}
