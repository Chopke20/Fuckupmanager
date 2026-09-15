import { describe, expect, it } from 'vitest'
import {
  buildStagePlan,
  fillRectWithDecks,
  resolveStagePlanOrderLines,
  stagePlanApplyBlockingIssues,
} from '../index'

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
    name: 'Podest + nogi',
    category: 'Scena',
    dailyPrice: 100,
    stockQuantity: 10,
    unit: 'szt.' as const,
    visibleInOffer: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

describe('resolveStagePlanOrderLines', () => {
  it('pomija nogi i zostawia ilość z podestu', () => {
    const { lines, issues } = resolveStagePlanOrderLines({
      plan,
      maps: [
        { roleKey: 'deck-2x1', action: 'map', equipmentId: catalog[0]!.id },
        { roleKey: 'legs', action: 'skip' },
        { roleKey: 'deck-clamps', action: 'skip' },
      ],
      catalog,
    })
    expect(stagePlanApplyBlockingIssues(issues)).toHaveLength(0)
    expect(lines).toHaveLength(1)
    expect(lines[0]?.quantity).toBe(1)
  })

  it('zgłasza duplicate_equipment', () => {
    const { issues } = resolveStagePlanOrderLines({
      plan,
      maps: [
        { roleKey: 'deck-2x1', action: 'map', equipmentId: catalog[0]!.id },
        { roleKey: 'legs', action: 'map', equipmentId: catalog[0]!.id },
        { roleKey: 'deck-clamps', action: 'skip' },
      ],
      catalog,
    })
    expect(stagePlanApplyBlockingIssues(issues).some((i) => i.kind === 'duplicate_equipment')).toBe(
      true
    )
  })
})
