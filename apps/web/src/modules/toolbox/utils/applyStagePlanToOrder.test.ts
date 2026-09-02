import { describe, expect, it } from 'vitest'
import { buildStagePlan, fillRectWithDecks, STAGE_PLAN_LINE_MARKER } from '@lama-stage/shared-types'
import {
  applyStagePlanToEquipmentItems,
  buildStageCatalogMap,
} from './applyStagePlanToOrder'

const plan = buildStagePlan({
  decks: fillRectWithDecks(2, 1, true),
  stairs: [],
  claddingMaterial: 'none',
  cladding: { sides: [], overrides: {} },
  floorMaterial: 'none',
  railings: { sides: [], overrides: {} },
  legHeightCm: 40,
  snapToGrid: true,
  gridStepM: 1,
})

describe('applyStagePlanToEquipmentItems', () => {
  it('zastępuje linie planu sceny tylko w docelowym bloku oferty', () => {
    const blockA = '11111111-1111-4111-8111-111111111111'
    const blockB = '22222222-2222-4222-8222-222222222222'
    const existing = [
      {
        id: 'a1',
        name: 'Podest A',
        description: `${STAGE_PLAN_LINE_MARKER} blok A`,
        quantity: 1,
        offerBlockId: blockA,
      },
      {
        id: 'b1',
        name: 'Podest B',
        description: `${STAGE_PLAN_LINE_MARKER} blok B`,
        quantity: 2,
        offerBlockId: blockB,
      },
      {
        id: 'x1',
        name: 'Inny sprzęt',
        description: 'zwykła pozycja',
        quantity: 1,
        offerBlockId: blockA,
      },
    ]

    const result = applyStagePlanToEquipmentItems({
      existing,
      plan,
      catalog: [],
      days: 1,
      offerBlockId: blockA,
    })

    expect(result.some((row) => row.id === 'b1')).toBe(true)
    expect(result.some((row) => row.id === 'x1')).toBe(true)
    expect(result.filter((row) => row.description?.includes(STAGE_PLAN_LINE_MARKER) && row.offerBlockId === blockA)).toHaveLength(plan.bom.length)
    expect(result.filter((row) => row.description?.includes(STAGE_PLAN_LINE_MARKER) && row.offerBlockId === blockB)).toHaveLength(1)
  })

  it('mapuje pozycje BOM po stagePlanKey, nie po nazwie', () => {
    const catalog = [
      {
        id: 'eq-deck',
        name: 'Podest sceniczny 2×1m + nogi',
        category: 'Scena',
        dailyPrice: 100,
        stockQuantity: 10,
        unit: 'szt.',
        visibleInOffer: true,
        stagePlanKey: 'deck-2x1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'eq-legs',
        name: 'Nogi do podestów 40 cm',
        category: 'Scena',
        dailyPrice: 0,
        stockQuantity: 100,
        unit: 'szt.',
        visibleInOffer: false,
        stagePlanKey: 'legs-40',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    const result = applyStagePlanToEquipmentItems({
      existing: [],
      plan,
      catalog,
      days: 1,
    })

    const deckLine = result.find((row) => row.equipmentId === 'eq-deck')
    const legsLine = result.find((row) => row.equipmentId === 'eq-legs')
    expect(deckLine?.quantity).toBe(1)
    expect(deckLine?.unitPrice).toBe(100)
    expect(legsLine?.quantity).toBe(4)
    expect(legsLine?.visibleInOffer).toBe(false)
    expect(buildStageCatalogMap(catalog).get('deck-2x1')?.id).toBe('eq-deck')
  })
})
