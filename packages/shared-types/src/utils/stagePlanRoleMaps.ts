import type { Equipment } from '../schemas/equipment.schema'
import type {
  StagePlanRoleAction,
  StagePlanRoleMap,
} from '../schemas/stage-plan-role-map.schema'
import type { StageBomLine, StagePlan } from './stagePlatformPlan'
import { stagePlanRoleLookupKeys } from './stagePlatformPlan'

export interface StagePlanRoleMapEntry {
  roleKey: string
  action: StagePlanRoleAction
  equipmentId?: string | null
  attachToRoleKey?: string | null
}

export interface ResolvedStageOrderLine {
  catalogKey: string
  sourceKeys: string[]
  quantity: number
  unit: StageBomLine['unit']
  equipment: Equipment
  /** BOM lines that contributed (mapped + attached). */
  bomLines: StageBomLine[]
}

export type StagePlanApplyIssue =
  | { kind: 'unmapped'; line: StageBomLine }
  | { kind: 'unit_mismatch'; line: StageBomLine; equipment: Equipment }
  | { kind: 'duplicate_equipment'; equipmentId: string; catalogKeys: string[] }
  | { kind: 'attach_target_missing'; line: StageBomLine; attachToRoleKey: string }
  | { kind: 'map_without_equipment'; line: StageBomLine }

function findMapEntry(
  maps: Map<string, StagePlanRoleMapEntry>,
  catalogKey: string
): StagePlanRoleMapEntry | undefined {
  for (const key of stagePlanRoleLookupKeys(catalogKey)) {
    const entry = maps.get(key)
    if (entry) return entry
  }
  return undefined
}

export function indexStagePlanRoleMaps(
  maps: Array<Pick<StagePlanRoleMap, 'roleKey' | 'action' | 'equipmentId' | 'attachToRoleKey'> | StagePlanRoleMapEntry>
): Map<string, StagePlanRoleMapEntry> {
  const indexed = new Map<string, StagePlanRoleMapEntry>()
  for (const item of maps) {
    indexed.set(item.roleKey, {
      roleKey: item.roleKey,
      action: item.action,
      equipmentId: item.equipmentId ?? null,
      attachToRoleKey: item.attachToRoleKey ?? null,
    })
  }
  return indexed
}

/**
 * Zamienia BOM planu na wiersze zlecenia wg przepisu firmy.
 * Ilość bierze tylko z roli `map`; `attach` nie sumuje ilości.
 */
export function resolveStagePlanOrderLines(params: {
  plan: StagePlan
  maps: StagePlanRoleMapEntry[] | Map<string, StagePlanRoleMapEntry>
  catalog: Equipment[]
}): { lines: ResolvedStageOrderLine[]; issues: StagePlanApplyIssue[] } {
  const byRole =
    params.maps instanceof Map ? params.maps : indexStagePlanRoleMaps(params.maps)
  const byEquipmentId = new Map(params.catalog.map((item) => [item.id, item] as const))

  const issues: StagePlanApplyIssue[] = []
  const mapped: Array<{
    catalogKey: string
    line: StageBomLine
    equipment: Equipment
  }> = []
  const attachedByHost = new Map<string, StageBomLine[]>()

  for (const line of params.plan.bom) {
    const entry = findMapEntry(byRole, line.catalogKey)
    if (!entry || entry.action === 'skip') {
      if (!entry) issues.push({ kind: 'unmapped', line })
      continue
    }

    if (entry.action === 'attach') {
      const host = entry.attachToRoleKey?.trim()
      if (!host) {
        issues.push({ kind: 'attach_target_missing', line, attachToRoleKey: '' })
        continue
      }
      const list = attachedByHost.get(host) ?? []
      list.push(line)
      attachedByHost.set(host, list)
      continue
    }

    // map
    if (!entry.equipmentId) {
      issues.push({ kind: 'map_without_equipment', line })
      continue
    }
    const equipment = byEquipmentId.get(entry.equipmentId)
    if (!equipment) {
      issues.push({ kind: 'map_without_equipment', line })
      continue
    }
    const unit = (equipment.unit || 'szt.').trim()
    if (unit !== line.unit) {
      issues.push({ kind: 'unit_mismatch', line, equipment })
    }
    mapped.push({ catalogKey: line.catalogKey, line, equipment })
  }

  // Duplicate equipmentId among map roles → error
  const byEq = new Map<string, string[]>()
  for (const item of mapped) {
    const keys = byEq.get(item.equipment.id) ?? []
    keys.push(item.catalogKey)
    byEq.set(item.equipment.id, keys)
  }
  for (const [equipmentId, catalogKeys] of byEq) {
    if (catalogKeys.length > 1) {
      issues.push({ kind: 'duplicate_equipment', equipmentId, catalogKeys })
    }
  }

  // Attach target must exist as a mapped role (exact or family match on host key)
  for (const [hostKey, attached] of attachedByHost) {
    const hostMapped = mapped.find(
      (item) =>
        item.catalogKey === hostKey ||
        stagePlanRoleLookupKeys(item.catalogKey).includes(hostKey) ||
        stagePlanRoleLookupKeys(hostKey).includes(item.catalogKey)
    )
    if (!hostMapped) {
      for (const line of attached) {
        issues.push({ kind: 'attach_target_missing', line, attachToRoleKey: hostKey })
      }
    }
  }

  if (issues.some((issue) => issue.kind === 'duplicate_equipment')) {
    return { lines: [], issues }
  }

  const lines: ResolvedStageOrderLine[] = []
  for (const item of mapped) {
    const attached =
      attachedByHost.get(item.catalogKey) ??
      attachedByHost.get(stagePlanRoleLookupKeys(item.catalogKey).find((k) => attachedByHost.has(k)) ?? '') ??
      []

    // Also collect attaches that target family of this mapped key
    const extra: StageBomLine[] = []
    for (const [hostKey, list] of attachedByHost) {
      if (hostKey === item.catalogKey) continue
      if (stagePlanRoleLookupKeys(item.catalogKey).includes(hostKey)) {
        extra.push(...list)
      }
    }

    const bomLines = [item.line, ...attached, ...extra]
    // dedupe by catalogKey
    const seen = new Set<string>()
    const uniqueBom: StageBomLine[] = []
    for (const bom of bomLines) {
      if (seen.has(bom.catalogKey)) continue
      seen.add(bom.catalogKey)
      uniqueBom.push(bom)
    }

    lines.push({
      catalogKey: item.catalogKey,
      sourceKeys: uniqueBom.map((bom) => bom.catalogKey),
      quantity: item.line.quantity,
      unit: item.line.unit,
      equipment: item.equipment,
      bomLines: uniqueBom,
    })
  }

  return { lines, issues }
}

/** Problemy blokujące apply do oferty (nie ukryte / niewymagane). */
export function stagePlanApplyBlockingIssues(
  issues: StagePlanApplyIssue[],
  opts?: { requireOfferMapped?: boolean }
): StagePlanApplyIssue[] {
  const requireOffer = opts?.requireOfferMapped !== false
  return issues.filter((issue) => {
    if (issue.kind === 'unmapped') {
      return requireOffer ? issue.line.offer : true
    }
    if (issue.kind === 'attach_target_missing') return true
    if (issue.kind === 'map_without_equipment') return true
    if (issue.kind === 'duplicate_equipment') return true
    if (issue.kind === 'unit_mismatch') return true
    return false
  })
}
