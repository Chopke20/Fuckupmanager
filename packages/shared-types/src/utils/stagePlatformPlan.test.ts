import { describe, expect, it } from 'vitest'
import {
  buildStagePlan,
  packStageTiles,
  STAGE_PLAN_LINE_MARKER,
} from './stagePlatformPlan'

describe('packStageTiles', () => {
  it('składa 6×4 wyłącznie z podestów 2×1 wzdłuż frontu', () => {
    const tiles = packStageTiles(6, 4, true)
    expect(tiles).toHaveLength(12)
    expect(tiles.every((t) => t.kind === '2x1')).toBe(true)
  })

  it('dla 5×3 dokłada 1×1 na nieparzystym froncie', () => {
    const tiles = packStageTiles(5, 3, true)
    expect(tiles.filter((t) => t.kind === '2x1')).toHaveLength(6)
    expect(tiles.filter((t) => t.kind === '1x1')).toHaveLength(3)
  })

  it('dla 3×5 w głąb używa 2×1 wzdłuż głębokości', () => {
    const tiles = packStageTiles(3, 5, false)
    expect(tiles.filter((t) => t.kind === '2x1')).toHaveLength(6)
    expect(tiles.filter((t) => t.kind === '1x1')).toHaveLength(3)
  })
})

describe('buildStagePlan', () => {
  it('auto wybiera układ z mniejszą liczbą 1×1', () => {
    const plan = buildStagePlan({
      widthM: 5,
      depthM: 4,
      orientation: 'auto',
      claddingMaterial: 'skirt',
      claddingSides: 'front-sides',
      legHeightCm: 60,
      legShare: 'per-deck',
      includeStairs: true,
      includeRailings: true,
    })
    expect('ok' in plan && plan.ok === false).toBe(false)
    if ('ok' in plan) return
    expect(plan.counts.decks1x1).toBeLessThanOrEqual(4)
    expect(plan.counts.decks2x1 + plan.counts.decks1x1).toBe(plan.counts.decksTotal)
    expect(plan.counts.legs).toBe(plan.counts.decksTotal * 4)
    expect(plan.claddingMeters).toBe(5 + 2 * 4)
    expect(plan.bom.some((l) => l.name.includes('kotara'))).toBe(true)
    expect(plan.counts.stairs).toBe(1)
  })

  it('zaokrągla 5.2×3.1 do 6×4 i liczy obicie całego obwodu', () => {
    const plan = buildStagePlan({
      widthM: 5.2,
      depthM: 3.1,
      orientation: 'long-along-front',
      claddingMaterial: 'hard',
      claddingSides: 'all',
      legHeightCm: 40,
      legShare: 'per-deck',
      includeStairs: false,
      includeRailings: false,
    })
    if ('ok' in plan) throw new Error(plan.error)
    expect(plan.widthM).toBe(6)
    expect(plan.depthM).toBe(4)
    expect(plan.claddingMeters).toBe(20)
    expect(plan.counts.dualLegClamps).toBe(0)
    expect(plan.notes[0]).toMatch(/zaokrąglone/)
  })

  it('współdzielone nogi dają mniej sztuk niż 4 na podest', () => {
    const perDeck = buildStagePlan({
      widthM: 4,
      depthM: 2,
      orientation: 'long-along-front',
      claddingMaterial: 'none',
      claddingSides: 'all',
      legHeightCm: 80,
      legShare: 'per-deck',
      includeStairs: true,
      includeRailings: false,
    })
    const shared = buildStagePlan({
      widthM: 4,
      depthM: 2,
      orientation: 'long-along-front',
      claddingMaterial: 'none',
      claddingSides: 'all',
      legHeightCm: 80,
      legShare: 'shared-corners',
      includeStairs: true,
      includeRailings: false,
    })
    if ('ok' in perDeck || 'ok' in shared) throw new Error('unexpected')
    expect(perDeck.counts.legs).toBe(16)
    expect(shared.counts.legs).toBeLessThan(16)
    expect(perDeck.counts.dualLegClamps).toBeGreaterThan(0)
  })

  it('odrzuca zerową szerokość', () => {
    const plan = buildStagePlan({
      widthM: 0,
      depthM: 4,
      orientation: 'auto',
      claddingMaterial: 'none',
      claddingSides: 'all',
      legHeightCm: 60,
      legShare: 'per-deck',
      includeStairs: false,
      includeRailings: false,
    })
    expect(plan).toMatchObject({ ok: false })
  })

  it('znacznik linii zlecenia jest stały', () => {
    expect(STAGE_PLAN_LINE_MARKER).toBe('[plan sceny]')
  })
})
