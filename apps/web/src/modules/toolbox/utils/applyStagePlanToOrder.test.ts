import { describe, expect, it } from 'vitest'
import {
  buildStagePlan,
  fillRectWithDecks,
  STAGE_PLAN_LINE_MARKER,
  formatStagePlanEquipmentDescription,
} from '@lama-stage/shared-types'
import { applyStagePlanToEquipmentItems, removeStagePlanSceneEquipmentItems } from './applyStagePlanToOrder'

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
]

const roleMaps = [
  { roleKey: 'deck-2x1', action: 'map' as const, equipmentId: catalog[0]!.id },
  { roleKey: 'legs', action: 'skip' as const },
  { roleKey: 'deck-clamps', action: 'skip' as const },
]

describe('applyStagePlanToEquipmentItems', () => {
  it('zastępuje linie planu sceny tylko w docelowym bloku oferty', () => {
    const blockA = '11111111-1111-4111-8111-111111111111'
    const blockB = '22222222-2222-4222-8222-222222222222'
    const sceneA = 'scA'
    const existing = [
      {
        id: 'a1',
        name: 'Podest A',
        description: formatStagePlanEquipmentDescription({
          sceneId: sceneA,
          sceneName: 'Scena A',
          widthM: 2,
          depthM: 1,
          legHeightCm: 40,
        }),
        quantity: 1,
        offerBlockId: blockA,
      },
      {
        id: 'b1',
        name: 'Podest B',
        description: formatStagePlanEquipmentDescription({
          sceneId: 'scB',
          sceneName: 'Scena B',
          widthM: 2,
          depthM: 1,
          legHeightCm: 40,
        }),
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
      roleMaps,
      days: 1,
      offerBlockId: blockA,
      sceneId: sceneA,
      sceneName: 'Scena A',
      primarySceneId: sceneA,
    })

    expect(result.blockingIssues).toHaveLength(0)
    expect(result.items.some((row) => row.id === 'b1')).toBe(true)
    expect(result.items.some((row) => row.id === 'x1')).toBe(true)
    expect(
      result.items.filter(
        (row) => row.description?.includes(STAGE_PLAN_LINE_MARKER) && row.offerBlockId === blockA
      )
    ).toHaveLength(1)
  })

  it('druga scena w tym samym bloku nie kasuje pierwszej', () => {
    const blockA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const scene1 = 'sc1'
    const scene2 = 'sc2'
    const first = applyStagePlanToEquipmentItems({
      existing: [],
      plan,
      catalog,
      roleMaps,
      days: 1,
      offerBlockId: blockA,
      sceneId: scene1,
      sceneName: 'Scena 1',
      primarySceneId: scene1,
    })
    const second = applyStagePlanToEquipmentItems({
      existing: first.items,
      plan,
      catalog,
      roleMaps,
      days: 1,
      offerBlockId: blockA,
      sceneId: scene2,
      sceneName: 'Scena 2',
      primarySceneId: scene1,
    })
    const sceneLines = second.items.filter((row) =>
      row.description?.includes(STAGE_PLAN_LINE_MARKER)
    )
    expect(sceneLines).toHaveLength(2)
    expect(sceneLines.some((row) => row.description?.includes('#sc1'))).toBe(true)
    expect(sceneLines.some((row) => row.description?.includes('#sc2'))).toBe(true)
  })

  it('legacy linia bez #sceneId jest zastępowana tylko przy primary scenie', () => {
    const blockA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const primary = 'scPrimary'
    const other = 'scOther'
    const existing = [
      {
        id: 'legacy',
        name: 'Podest',
        description: `${STAGE_PLAN_LINE_MARKER} 2×1 m, nogi 40 cm`,
        quantity: 1,
        offerBlockId: blockA,
      },
    ]
    const otherApply = applyStagePlanToEquipmentItems({
      existing,
      plan,
      catalog,
      roleMaps,
      days: 1,
      offerBlockId: blockA,
      sceneId: other,
      sceneName: 'Inna',
      primarySceneId: primary,
    })
    expect(otherApply.items.some((row) => row.id === 'legacy')).toBe(true)

    const primaryApply = applyStagePlanToEquipmentItems({
      existing,
      plan,
      catalog,
      roleMaps,
      days: 1,
      offerBlockId: blockA,
      sceneId: primary,
      sceneName: 'Główna',
      primarySceneId: primary,
    })
    expect(primaryApply.items.some((row) => row.id === 'legacy')).toBe(false)
    expect(primaryApply.items.some((row) => row.description?.includes('#scPrimary'))).toBe(true)
  })

  it('mapuje deck i pomija nogi — ilość to same podesty', () => {
    const result = applyStagePlanToEquipmentItems({
      existing: [],
      plan,
      catalog,
      roleMaps,
      days: 1,
      sceneId: 'scX',
      sceneName: 'Scena',
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
      sceneId: 'scX',
    })
    expect(result.blockingIssues.some((issue) => issue.kind === 'unmapped')).toBe(true)
    expect(result.items).toHaveLength(0)
  })

  it('removeStagePlanSceneEquipmentItems usuwa tylko wskazaną scenę', () => {
    const blockA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const items = [
      {
        id: '1',
        description: formatStagePlanEquipmentDescription({
          sceneId: 'sc1',
          sceneName: 'A',
          widthM: 1,
          depthM: 1,
          legHeightCm: 40,
        }),
        offerBlockId: blockA,
      },
      {
        id: '2',
        description: formatStagePlanEquipmentDescription({
          sceneId: 'sc2',
          sceneName: 'B',
          widthM: 1,
          depthM: 1,
          legHeightCm: 40,
        }),
        offerBlockId: blockA,
      },
    ]
    const next = removeStagePlanSceneEquipmentItems({
      existing: items,
      offerBlockId: blockA,
      sceneId: 'sc1',
      primarySceneId: 'sc1',
    })
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe('2')
  })
})
