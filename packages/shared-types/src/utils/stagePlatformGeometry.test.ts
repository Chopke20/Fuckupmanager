import { describe, expect, it } from 'vitest'
import {
  analyzeStageLayout,
  computeSharedEdgeMeters,
  computeStageAreaM2,
  computeStageBounds,
  computeStageJunctions,
  computeStageOutline,
  findEdgeCovering,
  intervalsLength,
  type StageRect,
} from './stagePlatformGeometry'

/** Prostokąt 6 × 4 m złożony z dwunastu blatów 2×1 ułożonych wzdłuż frontu. */
const RECT_6x4: StageRect[] = [0, 1, 2, 3].flatMap((y) =>
  [0, 2, 4].map((x) => ({ x, y, w: 2, h: 1 }))
)

/** Ten sam prostokąt z dostawionym skrzydłem 2 × 2 m po prawej stronie (kształt L). */
const L_SHAPE: StageRect[] = [
  ...RECT_6x4,
  { x: 6, y: 0, w: 2, h: 1 },
  { x: 6, y: 1, w: 2, h: 1 },
]

function perimeter(decks: StageRect[]): number {
  return computeStageOutline(decks).reduce((acc, e) => acc + e.lengthM, 0)
}

describe('computeStageOutline', () => {
  it('scala współliniowe krawędzie prostokąta do czterech boków', () => {
    const edges = computeStageOutline(RECT_6x4)
    expect(edges).toHaveLength(4)
    expect(edges.find((e) => e.side === 'front')?.lengthM).toBe(6)
    expect(edges.find((e) => e.side === 'back')?.lengthM).toBe(6)
    expect(edges.find((e) => e.side === 'left')?.lengthM).toBe(4)
    expect(edges.find((e) => e.side === 'right')?.lengthM).toBe(4)
    expect(perimeter(RECT_6x4)).toBe(20)
  })

  it('pojedynczy podest 2×1 ma cztery krawędzie i obwód 6 m', () => {
    expect(perimeter([{ x: 0, y: 0, w: 2, h: 1 }])).toBe(6)
  })

  it('kształt L ma wycięcie: sześć krawędzi i obwód 24 m', () => {
    const edges = computeStageOutline(L_SHAPE)
    expect(edges).toHaveLength(6)
    expect(perimeter(L_SHAPE)).toBe(24)
    expect(edges.filter((e) => e.side === 'back').map((e) => e.lengthM).sort()).toEqual([2, 6])
    expect(edges.filter((e) => e.side === 'right').map((e) => e.lengthM)).toEqual([2, 2])
    expect(edges.find((e) => e.side === 'front')?.lengthM).toBe(8)
  })

  it('nie zwraca krawędzi wewnętrznych między stykającymi się blatami', () => {
    const edges = computeStageOutline([
      { x: 0, y: 0, w: 2, h: 1 },
      { x: 2, y: 0, w: 2, h: 1 },
    ])
    expect(edges.filter((e) => e.side === 'left')).toHaveLength(1)
    expect(edges.filter((e) => e.side === 'right')).toHaveLength(1)
    expect(perimeter([
      { x: 0, y: 0, w: 2, h: 1 },
      { x: 2, y: 0, w: 2, h: 1 },
    ])).toBe(10)
  })

  it('szczelina 1 cm jest traktowana jak styk, 8 cm już nie', () => {
    const glued: StageRect[] = [
      { x: 0, y: 0, w: 2, h: 1 },
      { x: 2.01, y: 0, w: 2, h: 1 },
    ]
    const split: StageRect[] = [
      { x: 0, y: 0, w: 2, h: 1 },
      { x: 2.08, y: 0, w: 2, h: 1 },
    ]
    expect(computeStageOutline(glued).filter((e) => e.side === 'left')).toHaveLength(1)
    expect(computeStageOutline(split).filter((e) => e.side === 'left')).toHaveLength(2)
  })

  it('klucz krawędzi jest ten sam po ponownym przeliczeniu tego samego układu', () => {
    const first = computeStageOutline(L_SHAPE).map((e) => e.key)
    const second = computeStageOutline([...L_SHAPE].reverse()).map((e) => e.key)
    expect(new Set(second)).toEqual(new Set(first))
  })
})

describe('computeStageAreaM2', () => {
  it('liczy pole kształtu L bez gabarytu', () => {
    expect(computeStageAreaM2(L_SHAPE)).toBe(28)
    expect(computeStageBounds(L_SHAPE)).toMatchObject({ widthM: 8, depthM: 4 })
  })

  it('nie liczy nachodzących blatów dwa razy', () => {
    expect(
      computeStageAreaM2([
        { x: 0, y: 0, w: 2, h: 1 },
        { x: 0, y: 0, w: 2, h: 1 },
      ])
    ).toBe(2)
    expect(
      computeStageAreaM2([
        { x: 0, y: 0, w: 2, h: 2 },
        { x: 1, y: 1, w: 2, h: 2 },
      ])
    ).toBe(7)
  })

  it('pusty układ ma zerowe pole', () => {
    expect(computeStageAreaM2([])).toBe(0)
  })
})

describe('styki i zbiegi', () => {
  it('liczy długość wspólnych krawędzi', () => {
    expect(
      computeSharedEdgeMeters([
        { x: 0, y: 0, w: 2, h: 1 },
        { x: 2, y: 0, w: 2, h: 1 },
      ])
    ).toBe(1)
    expect(computeSharedEdgeMeters(RECT_6x4)).toBe(26)
  })

  it('rozpoznaje zbiegi narożników', () => {
    const junctions = computeStageJunctions([
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 1, y: 0, w: 1, h: 1 },
      { x: 0, y: 1, w: 1, h: 1 },
      { x: 1, y: 1, w: 1, h: 1 },
    ])
    expect(junctions.quad).toBe(1)
    expect(junctions.dual).toBe(4)
  })
})

describe('analyzeStageLayout', () => {
  it('spójny prostokąt to jedna wyspa bez uwag', () => {
    expect(analyzeStageLayout(RECT_6x4)).toEqual({ overlaps: 0, islands: 1, nearMisses: 0 })
  })

  it('wykrywa nachodzenie blatów', () => {
    const issues = analyzeStageLayout([
      { x: 0, y: 0, w: 2, h: 1 },
      { x: 1, y: 0, w: 2, h: 1 },
    ])
    expect(issues.overlaps).toBe(1)
  })

  it('wykrywa oderwaną wyspę i prawie-styk', () => {
    expect(
      analyzeStageLayout([
        { x: 0, y: 0, w: 2, h: 1 },
        { x: 6, y: 0, w: 2, h: 1 },
      ]).islands
    ).toBe(2)
    expect(
      analyzeStageLayout([
        { x: 0, y: 0, w: 2, h: 1 },
        { x: 2.06, y: 0, w: 2, h: 1 },
      ]).nearMisses
    ).toBe(1)
  })
})

describe('pomocnicze', () => {
  it('sumuje przedziały bez podwójnego liczenia', () => {
    expect(intervalsLength([[0, 2], [1, 3]])).toBe(3)
    expect(intervalsLength([[0, 2], [4, 5]])).toBe(3)
  })

  it('znajduje krawędź, na której da się oprzeć schody', () => {
    const edges = computeStageOutline(L_SHAPE)
    expect(findEdgeCovering(edges, 'front', 0, 1, 1)?.lengthM).toBe(8)
    expect(findEdgeCovering(edges, 'front', 0, 7.5, 1)).toBeNull()
    expect(findEdgeCovering(edges, 'left', 0, 1, 1)?.lengthM).toBe(4)
  })
})
