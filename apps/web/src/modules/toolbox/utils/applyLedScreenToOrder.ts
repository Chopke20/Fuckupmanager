import type { Equipment, OrderEquipmentItem, StagePlanRoleMapEntry } from '@lama-stage/shared-types'
import { indexStagePlanRoleMaps, stagePlanRoleLookupKeys } from '@lama-stage/shared-types'
import type { LedScreenProjectPayload } from '../calculators/ledScreen'
import {
  LED_SCREEN_LINE_MARKER,
  formatLedScreenEquipmentDescription,
  ledScreenBomLines,
  ledScreenCabinetsTotal,
  parseLedScreenEntryIdFromDescription,
} from './ledScreenPlanSet'

export function isLedScreenEquipmentLine(item: Partial<OrderEquipmentItem>): boolean {
  const desc = typeof item.description === 'string' ? item.description : ''
  return desc.includes(LED_SCREEN_LINE_MARKER)
}

export function ledScreenLineMatchesEntry(
  item: Partial<OrderEquipmentItem>,
  params: {
    offerBlockId?: string | null
    entryId: string
    primaryEntryId?: string | null
  }
): boolean {
  if (!isLedScreenEquipmentLine(item)) return false
  const itemBlockId = item.offerBlockId ?? null
  const targetBlockId = params.offerBlockId ?? null
  if (itemBlockId !== targetBlockId) return false
  const lineId = parseLedScreenEntryIdFromDescription(
    typeof item.description === 'string' ? item.description : null
  )
  if (lineId === params.entryId) return true
  if (lineId === null && params.primaryEntryId && params.primaryEntryId === params.entryId) {
    return true
  }
  return false
}

export type LedScreenApplyIssue =
  | { kind: 'unmapped'; catalogKey: string }
  | { kind: 'missing_equipment'; catalogKey: string }
  | { kind: 'duplicate_equipment'; catalogKeys: string[] }

export function resolveLedScreenOrderLines(params: {
  project: LedScreenProjectPayload
  maps: StagePlanRoleMapEntry[]
  catalog: Equipment[]
}): {
  lines: Array<{ catalogKey: string; quantity: number; unit: string; equipment: Equipment }>
  issues: LedScreenApplyIssue[]
} {
  const byRole = indexStagePlanRoleMaps(params.maps)
  const catalogById = new Map(params.catalog.map((eq) => [eq.id, eq]))
  const issues: LedScreenApplyIssue[] = []
  const resolved: Array<{
    catalogKey: string
    quantity: number
    unit: string
    equipment: Equipment
  }> = []
  const usedEquipment = new Map<string, string[]>()

  for (const line of ledScreenBomLines(params.project)) {
    const lookupKeys = stagePlanRoleLookupKeys(line.catalogKey)
    let map: StagePlanRoleMapEntry | undefined
    for (const key of lookupKeys) {
      map = byRole.get(key)
      if (map) break
    }
    if (!map || map.action === 'skip') {
      if (!map) issues.push({ kind: 'unmapped', catalogKey: line.catalogKey })
      continue
    }
    if (map.action !== 'map' || !map.equipmentId) {
      issues.push({ kind: 'missing_equipment', catalogKey: line.catalogKey })
      continue
    }
    const equipment = catalogById.get(map.equipmentId)
    if (!equipment) {
      issues.push({ kind: 'missing_equipment', catalogKey: line.catalogKey })
      continue
    }
    const prev = usedEquipment.get(equipment.id) ?? []
    prev.push(line.catalogKey)
    usedEquipment.set(equipment.id, prev)
    resolved.push({
      catalogKey: line.catalogKey,
      quantity: line.quantity,
      unit: line.unit,
      equipment,
    })
  }

  for (const [_, catalogKeys] of usedEquipment) {
    if (catalogKeys.length > 1) {
      issues.push({ kind: 'duplicate_equipment', catalogKeys })
    }
  }

  return { lines: resolved, issues }
}

export function ledScreenApplyBlockingIssues(
  issues: LedScreenApplyIssue[]
): LedScreenApplyIssue[] {
  return issues.filter(
    (issue) =>
      issue.kind === 'unmapped' ||
      issue.kind === 'missing_equipment' ||
      issue.kind === 'duplicate_equipment'
  )
}

export function applyLedScreenToEquipmentItems(params: {
  existing: Partial<OrderEquipmentItem>[]
  project: LedScreenProjectPayload
  catalog: Equipment[]
  roleMaps: StagePlanRoleMapEntry[]
  days: number
  offerBlockId?: string | null
  entryId: string
  entryName?: string
  primaryEntryId?: string | null
}): {
  items: Partial<OrderEquipmentItem>[]
  issues: LedScreenApplyIssue[]
  blockingIssues: LedScreenApplyIssue[]
} {
  const kept = params.existing.filter(
    (item) =>
      !ledScreenLineMatchesEntry(item, {
        offerBlockId: params.offerBlockId,
        entryId: params.entryId,
        primaryEntryId: params.primaryEntryId,
      })
  )

  const { lines, issues } = resolveLedScreenOrderLines({
    project: params.project,
    maps: params.roleMaps,
    catalog: params.catalog,
  })
  const blockingIssues = ledScreenApplyBlockingIssues(issues)
  if (blockingIssues.length > 0) {
    return { items: params.existing, issues, blockingIssues }
  }

  const now = Date.now()
  const entryName = (params.entryName ?? 'Ekran').trim() || 'Ekran'
  const cabinetsTotal = ledScreenCabinetsTotal(params.project)
  const screensCount = params.project.screens.length
  const newItems: Partial<OrderEquipmentItem>[] = lines.map((line, idx) => {
    const eq = line.equipment
    const quantity = Math.max(1, Math.ceil(line.quantity))
    return {
      id: `temp-led-${now}-${idx}`,
      orderId: '',
      equipmentId: eq.id,
      equipment: eq,
      name: eq.name,
      description: formatLedScreenEquipmentDescription({
        entryId: params.entryId,
        entryName,
        cabinetsTotal,
        screensCount,
      }),
      category: eq.category,
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

  return { items: [...kept, ...newItems], issues, blockingIssues }
}

export function removeLedScreenEntryEquipmentItems(params: {
  existing: Partial<OrderEquipmentItem>[]
  offerBlockId?: string | null
  entryId: string
  primaryEntryId?: string | null
}): Partial<OrderEquipmentItem>[] {
  return params.existing.filter(
    (item) =>
      !ledScreenLineMatchesEntry(item, {
        offerBlockId: params.offerBlockId,
        entryId: params.entryId,
        primaryEntryId: params.primaryEntryId,
      })
  )
}

export function renameLedScreenEntryEquipmentItems(params: {
  existing: Partial<OrderEquipmentItem>[]
  offerBlockId?: string | null
  entryId: string
  entryName: string
  primaryEntryId?: string | null
}): Partial<OrderEquipmentItem>[] {
  const nextName = params.entryName.trim()
  if (!nextName) return params.existing
  const marker = LED_SCREEN_LINE_MARKER
  const idToken = `#${params.entryId}`
  return params.existing.map((item) => {
    if (
      !ledScreenLineMatchesEntry(item, {
        offerBlockId: params.offerBlockId,
        entryId: params.entryId,
        primaryEntryId: params.primaryEntryId,
      })
    ) {
      return item
    }
    const desc = typeof item.description === 'string' ? item.description : ''
    const re = new RegExp(
      `(${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${idToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+)([^·]+)`
    )
    const updated = desc.includes(idToken)
      ? desc.replace(re, `$1${nextName} `)
      : desc.replace(
          new RegExp(
            `(${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+)([^·#]+)`
          ),
          `$1${idToken} ${nextName} `
        )
    return { ...item, description: updated }
  })
}

export function duplicateLedScreenEntryEquipmentItems(params: {
  existing: Partial<OrderEquipmentItem>[]
  offerBlockId?: string | null
  sourceEntryId: string
  targetEntryId: string
  targetEntryName: string
  primaryEntryId?: string | null
}): Partial<OrderEquipmentItem>[] {
  const now = Date.now()
  const clones: Partial<OrderEquipmentItem>[] = []
  for (const item of params.existing) {
    if (
      !ledScreenLineMatchesEntry(item, {
        offerBlockId: params.offerBlockId,
        entryId: params.sourceEntryId,
        primaryEntryId: params.primaryEntryId,
      })
    ) {
      continue
    }
    const desc = typeof item.description === 'string' ? item.description : ''
    const marker = LED_SCREEN_LINE_MARKER
    const sourceToken = `#${params.sourceEntryId}`
    const targetToken = `#${params.targetEntryId}`
    let nextDesc = desc
    if (desc.includes(sourceToken)) {
      nextDesc = desc
        .replace(sourceToken, targetToken)
        .replace(
          new RegExp(
            `(${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${targetToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+)([^·]+)`
          ),
          `$1${params.targetEntryName} `
        )
    } else if (desc.includes(marker)) {
      nextDesc = desc.replace(
        marker,
        `${marker} ${targetToken} ${params.targetEntryName}`
      )
    }
    clones.push({
      ...item,
      id: `temp-led-dup-${now}-${clones.length}`,
      description: nextDesc,
      sortOrder: (params.existing.length || 0) + clones.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
  return [...params.existing, ...clones]
}
