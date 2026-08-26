import { computeProposalEquipmentNet, computeProposalProductionNet } from './proposalFinance'

/**
 * Grupowanie zakresu bazowego proposal po bloku oferty (lub "pozostały sprzęt" / "obsługa" /
 * "transport" dla pozycji bez bloku). Wyodrębnione ze snapshotu, żeby ta sama logika była
 * dostępna zarówno w backendzie (`proposal-snapshot.ts`, budowa publicznego snapshotu) jak i w
 * UI operatora (podgląd + generowanie sugestii konceptu przed zapisem draftu) — jedno źródło
 * prawdy, bez ryzyka rozjazdu.
 */

export type ProposalScopeBlock = {
  id: string
  title: string
  sortOrder?: number | null
}

export type ProposalScopeEquipmentLine = {
  id: string
  name: string
  category?: string | null
  offerBlockId?: string | null
  visibleInOffer?: boolean | null
  unitPrice: number
  quantity: number
  days?: number | null
  discount?: number | null
  pricingRule?: unknown
}

export type ProposalScopeProductionLine = {
  id: string
  name: string
  offerBlockId?: string | null
  visibleInOffer?: boolean | null
  isTransport?: boolean | null
  rateValue: number
  units?: number | null
  discount?: number | null
}

export type ProposalScopeEquipmentDetail = {
  name: string
  quantity: number
  category: string | null
}

export type ProposalScopeProductionDetail = {
  name: string
  units: number
  isTransport: boolean
}

export type ProposalScopeGroup = {
  id: string
  title: string
  /** Nazwy pozycji (bez ilości) — do wyświetlenia operatorowi / zachowania kompatybilności starych snapshotów. */
  itemNames: string[]
  /** Sprzęt z ilościami/kategoriami — wejście dla generatora konceptu (`suggestProposalConcept`). */
  equipmentDetails: ProposalScopeEquipmentDetail[]
  /** Obsługa/transport z jednostkami — wejście dla generatora konceptu. */
  productionDetails: ProposalScopeProductionDetail[]
  equipmentNet: number
  productionNet: number
  transportNet: number
}

function round2(n: number): number {
  return Number(n.toFixed(2))
}

function isVisibleInOffer(flag: boolean | null | undefined): boolean {
  return flag !== false
}

export function groupProposalScope(args: {
  blocks: ProposalScopeBlock[]
  equipment: ProposalScopeEquipmentLine[]
  production: ProposalScopeProductionLine[]
  /** id-y sprzętu / produkcji / bloków już użyte jako "opcje rozbudowy" — wyłączone z zakresu bazowego. */
  excludedEquipmentIds?: Set<string>
  excludedProductionIds?: Set<string>
  excludedBlockIds?: Set<string>
}): ProposalScopeGroup[] {
  const excludedEq = args.excludedEquipmentIds ?? new Set<string>()
  const excludedProd = args.excludedProductionIds ?? new Set<string>()
  const excludedBlocks = args.excludedBlockIds ?? new Set<string>()

  const baseEq = args.equipment.filter(
    (i) => isVisibleInOffer(i.visibleInOffer) && !excludedEq.has(i.id) && !(i.offerBlockId && excludedBlocks.has(i.offerBlockId))
  )
  const baseProdAll = args.production.filter(
    (i) => isVisibleInOffer(i.visibleInOffer) && !excludedProd.has(i.id) && !(i.offerBlockId && excludedBlocks.has(i.offerBlockId))
  )

  const blockById = new Map(args.blocks.map((b) => [b.id, b]))
  const grouped = new Map<string, ProposalScopeGroup>()

  const ensureGroup = (id: string, title: string): ProposalScopeGroup => {
    const existing = grouped.get(id)
    if (existing) return existing
    const created: ProposalScopeGroup = {
      id,
      title,
      itemNames: [],
      equipmentDetails: [],
      productionDetails: [],
      equipmentNet: 0,
      productionNet: 0,
      transportNet: 0,
    }
    grouped.set(id, created)
    return created
  }

  for (const item of baseEq) {
    const blockId = item.offerBlockId && blockById.has(item.offerBlockId) ? item.offerBlockId : 'ungrouped'
    const title = blockId === 'ungrouped' ? 'Pozostały sprzęt' : blockById.get(blockId)!.title
    const group = ensureGroup(blockId, title)
    group.itemNames.push(item.name)
    group.equipmentDetails.push({ name: item.name, quantity: Math.max(1, item.quantity || 1), category: item.category ?? null })
    group.equipmentNet = round2(group.equipmentNet + computeProposalEquipmentNet(item))
  }

  for (const item of baseProdAll) {
    const isTransportItem = Boolean(item.isTransport)
    const blockId = item.offerBlockId && blockById.has(item.offerBlockId) ? item.offerBlockId : null
    const group = blockId
      ? ensureGroup(blockId, blockById.get(blockId)!.title)
      : ensureGroup(isTransportItem ? 'ungrouped-transport' : 'ungrouped-prod', isTransportItem ? 'Transport' : 'Obsługa')
    group.itemNames.push(item.name)
    group.productionDetails.push({ name: item.name, units: Math.max(1, item.units ?? 1), isTransport: isTransportItem })
    if (isTransportItem) group.transportNet = round2(group.transportNet + computeProposalProductionNet(item))
    else group.productionNet = round2(group.productionNet + computeProposalProductionNet(item))
  }

  return [...grouped.values()].filter((g) => g.itemNames.length > 0)
}
