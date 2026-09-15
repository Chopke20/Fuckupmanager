import { describe, expect, it } from 'vitest'
import { buildStagePlan, fillRectWithDecks, STAGE_PLAN_LINE_MARKER } from '@lama-stage/shared-types'
import { applyStagePlanToEquipmentItems } from './applyStagePlanToOrder'

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

const catalog = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Podest sceniczny 2×1m + nogi',
    category: 'Scena',
    dailyPrice: 100,
    stockQuantity: 10,
    unit: 'szt.',
    visibleInOffer: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Nogi do podestów 40 cm',
    category: 'Scena',
    dailyPrice: 0,
    stockQuantity: 100,
    unit: 'szt.',
    visibleInOffer: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

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
      catalog,
      roleMaps: [
        { roleKey: 'deck-2x1', action: 'map', equipmentId: catalog[0]!.id },
        { roleKey: 'legs', action: 'attach', attachToRoleKey: 'deck-2x1' },
        { roleKey: 'deck-clamps', action: 'skip' },
      ],
      days: 1,
      offerBlockId: blockA,
    })

    expect(result.blockingIssues).toHaveLength(0)
    expect(result.items.some((row) => row.id === 'b1')).toBe(true)
    expect(result.items.some((row) => row.id === 'x1')).toBe(true)
    expect(
      result.items.filter(
        (row) => row.description?.includes(STAGE_PLAN_LINE_MARKER) && row.offerBlockId === blockA
      )
    ).toHaveLength(1)
    expect(
      result.items.filter(
        (row) => row.description?.includes(STAGE_PLAN_LINE_MARKER) && row.offerBlockId === blockB
      )
    ).toHaveLength(1)
  })

  it('mapuje deck i dołącza nogi bez sumowania ilości', () => {
    const result = applyStagePlanToEquipmentItems({
      existing: [],
      plan,
      catalog,
      roleMaps: [
        { roleKey: 'deck-2x1', action: 'map', equipmentId: catalog[0]!.id },
        { roleKey: 'legs', action: 'attach', attachToRoleKey: 'deck-2x1' },
        { roleKey: 'deck-clamps', action: 'skip' },
      ],
      days: 1,
    })

    expect(result.blockingIssues).toHaveLength(0)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.equipmentId).toBe(catalog[0]!.id)
    expect(result.items[0]?.quantity).toBe(1)
    expect(result.items[0]?.unitPrice).toBe(100)
  })

  it('blokuje apply gdy brak mapowania pozycji oferty', () => {
    const result = applyStagePlanToEquipmentItems({
      existing: [],
      plan,
      catalog,
      roleMaps: [{ roleKey: 'deck-clamps', action: 'skip' }],
      days: 1,
    })
    expect(result.blockingIssues.some((issue) => issue.kind === 'unmapped')).toBe(true)
    expect(result.items).toHaveLength(0)
  })
})
