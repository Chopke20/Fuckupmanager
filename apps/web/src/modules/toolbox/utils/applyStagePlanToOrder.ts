import type { Equipment, OrderEquipmentItem, StagePlan } from '@lama-stage/shared-types'
import { STAGE_PLAN_LINE_MARKER } from '@lama-stage/shared-types'

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/\s+/g, ' ')
    .trim()
}

function findCatalog(list: Equipment[], predicate: (name: string) => boolean): Equipment | undefined {
  return list.find((eq) => eq.category !== 'ZASOBY' && predicate(norm(eq.name)))
}

export function matchStageBomToCatalog(list: Equipment[], plan: StagePlan): Map<string, Equipment> {
  const map = new Map<string, Equipment>()
  const deck2 = findCatalog(list, (n) => n.includes('podest') && (n.includes('2x1') || n.includes('2 x 1')))
  const deck1 = findCatalog(list, (n) => n.includes('podest') && (n.includes('1x1') || n.includes('1 x 1')))
  const legs = findCatalog(
    list,
    (n) => n.includes('nog') && n.includes(String(plan.legHeightCm))
  ) || findCatalog(list, (n) => n.includes('nog'))
  const skirt = findCatalog(list, (n) => n.includes('kotar') || n.includes('falban') || n.includes('obic'))
  const hard = findCatalog(list, (n) => n.includes('blend') || (n.includes('sklejk') && n.includes('obic')))
  const stairs = findCatalog(list, (n) => n.includes('schod'))
  const rail = findCatalog(list, (n) => n.includes('barierk'))
  const deckClamp = findCatalog(list, (n) => n.includes('klamr') && (n.includes('blat') || n.includes('szybkoz')))
  const dual = findCatalog(list, (n) => n.includes('klamr') && n.includes('nóg') && n.includes('podw'))
  const quad = findCatalog(list, (n) => n.includes('klamr') && (n.includes('poczw') || n.includes('4')))

  if (deck2) map.set('deck-2x1', deck2)
  if (deck1) map.set('deck-1x1', deck1)
  if (legs) map.set('legs', legs)
  if (plan.claddingMaterial === 'skirt' && skirt) map.set('cladding', skirt)
  if (plan.claddingMaterial === 'hard' && hard) map.set('cladding', hard)
  if (stairs) map.set('stairs', stairs)
  if (rail) map.set('railings', rail)
  if (deckClamp) map.set('deck-clamps', deckClamp)
  if (dual) map.set('dual-leg-clamps', dual)
  if (quad) map.set('quad-leg-clamps', quad)
  return map
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
  const kept = params.existing.filter((item) => !isStagePlanEquipmentLine(item))
  const matched = matchStageBomToCatalog(params.catalog, params.plan)
  const now = Date.now()
  const dim = `${params.plan.widthM}×${params.plan.depthM} m, nogi ${params.plan.legHeightCm} cm`
  const newItems: Partial<OrderEquipmentItem>[] = params.plan.bom.map((line, idx) => {
    const eq = matched.get(line.key)
    return {
      id: `temp-stage-${now}-${idx}`,
      orderId: '',
      equipmentId: eq?.id,
      equipment: eq,
      name: eq?.name || line.name,
      description: `${STAGE_PLAN_LINE_MARKER} ${dim}`,
      category: eq ? (eq.category === 'SCENA' ? 'Scena' : eq.category) : 'Scena',
      quantity: line.quantity,
      unitPrice: eq?.dailyPrice ?? 0,
      days: Math.max(1, params.days),
      discount: 0,
      pricingRule: eq?.pricingRule || { day1: 1.0, nextDays: 0.5 },
      visibleInOffer: line.offer,
      isRental: false,
      sortOrder: kept.length + idx,
      offerBlockId: params.offerBlockId ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })
  return [...kept, ...newItems]
}
