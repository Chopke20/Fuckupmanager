import { describe, expect, it } from 'vitest'
import {
  STAGE_PLAN_LINE_MARKER,
  buildStagePlan,
  createStageDeck,
  createStageStair,
  edgeSelection,
  edgeSelectionLabel,
  emptyStagePlanInput,
  fillRectWithDecks,
  isEdgeSelected,
  migrateLegacyStagePlan,
  parseStagePlanJson,
  rotateStageDeck,
  serializeStagePlan,
  snapToStep,
  stageStairDepthM,
  stairIsAttached,
  toggleEdgeInSelection,
  toggleSideInSelection,
  type StageBomLine,
  type StagePlan,
  type StagePlanInput,
} from './stagePlatformPlan'

function planFor(overrides: Partial<StagePlanInput> = {}): StagePlan {
  return buildStagePlan({ ...emptyStagePlanInput(), ...overrides })
}

function bomLine(plan: StagePlan, key: string): StageBomLine | undefined {
  return plan.bom.find((line) => line.key === key)
}

const RECT_6x4 = () => fillRectWithDecks(6, 4, true)

/** Prostokąt 6×4 z dostawionym skrzydłem 2×2 po prawej stronie. */
const L_SHAPE = () => [
  ...RECT_6x4(),
  createStageDeck('2x1', 6, 0),
  createStageDeck('2x1', 6, 1),
]

describe('fillRectWithDecks', () => {
  it('składa 6×4 wyłącznie z blatów 2×1 wzdłuż frontu', () => {
    const decks = fillRectWithDecks(6, 4, true)
    expect(decks).toHaveLength(12)
    expect(decks.every((deck) => deck.kind === '2x1')).toBe(true)
  })

  it('dla 5×3 dokłada 1×1 na nieparzystym froncie', () => {
    const decks = fillRectWithDecks(5, 3, true)
    expect(decks.filter((deck) => deck.kind === '2x1')).toHaveLength(6)
    expect(decks.filter((deck) => deck.kind === '1x1')).toHaveLength(3)
  })

  it('w głąb obraca blaty 2×1', () => {
    const decks = fillRectWithDecks(3, 4, false)
    expect(decks.filter((deck) => deck.kind === '2x1').every((deck) => deck.h === 2)).toBe(
      true
    )
  })

  it('obrót zamienia boki tylko blatom 2×1', () => {
    const long = rotateStageDeck(createStageDeck('2x1', 0, 0))
    expect([long.w, long.h]).toEqual([1, 2])
    const square = createStageDeck('1x1', 0, 0)
    expect(rotateStageDeck(square)).toBe(square)
  })
})

describe('buildStagePlan — nogi i podesty', () => {
  it('zawsze liczy cztery nogi na podest', () => {
    const plan = planFor({ decks: RECT_6x4() })
    expect(plan.counts.decksTotal).toBe(12)
    expect(plan.counts.legs).toBe(48)
    expect(bomLine(plan, 'legs')?.quantity).toBe(48)
    expect(plan.notes.some((note) => note.includes('bez współdzielenia'))).toBe(true)
  })

  it('pusty plan nie wywala się, tylko ostrzega', () => {
    const plan = planFor({ decks: [] })
    expect(plan.counts.legs).toBe(0)
    expect(plan.areaM2).toBe(0)
    expect(plan.warnings.some((w) => w.includes('pusty'))).toBe(true)
  })
})

describe('buildStagePlan — obicie i podłoga', () => {
  it('liczy obicie prostokąta w mb i m² dla wysokości nóg', () => {
    const plan = planFor({ decks: RECT_6x4(), legHeightCm: 60 })
    expect(plan.claddingMb).toBe(20)
    expect(plan.claddingM2).toBe(12)
    expect(edgeSelectionLabel(plan.cladding, plan.edges)).toBe('cały obwód')
  })

  it('kotara idzie do wykazu w mb, HIPS w m²', () => {
    const skirt = planFor({ decks: RECT_6x4(), claddingMaterial: 'skirt', legHeightCm: 80 })
    expect(bomLine(skirt, 'cladding')).toMatchObject({ unit: 'mb', quantity: 20 })
    expect(bomLine(skirt, 'cladding')?.name).toContain('16 m²')

    const hips = planFor({ decks: RECT_6x4(), claddingMaterial: 'hips', legHeightCm: 80 })
    expect(bomLine(hips, 'cladding')).toMatchObject({ unit: 'm²', quantity: 16 })
    expect(bomLine(hips, 'cladding')?.name).toContain('20 mb')
  })

  it('kształt L ma dłuższy obwód i mniejsze pole niż gabaryt', () => {
    const plan = planFor({ decks: L_SHAPE(), legHeightCm: 60 })
    expect(plan.widthM).toBe(8)
    expect(plan.depthM).toBe(4)
    expect(plan.claddingMb).toBe(24)
    expect(plan.claddingM2).toBe(14.4)
    // Gabaryt 8 × 4 dałby 32 m² — liczymy realne 28 m².
    expect(plan.areaM2).toBe(28)
  })

  it('bez obicia nie liczy ani mb, ani m²', () => {
    const plan = planFor({ decks: RECT_6x4(), claddingMaterial: 'none' })
    expect(plan.claddingMb).toBe(0)
    expect(plan.claddingM2).toBe(0)
    expect(bomLine(plan, 'cladding')).toBeUndefined()
  })

  it('podłoga liczy powierzchnię użytkową w m²', () => {
    const carpet = planFor({ decks: L_SHAPE(), floorMaterial: 'carpet' })
    expect(bomLine(carpet, 'floor')).toMatchObject({ unit: 'm²', quantity: 28 })
    expect(bomLine(carpet, 'floor')?.name).toContain('Wykładzina')

    const hips = planFor({ decks: L_SHAPE(), floorMaterial: 'hips' })
    expect(bomLine(hips, 'floor')?.name).toContain('HIPS')

    expect(bomLine(planFor({ decks: L_SHAPE() }), 'floor')).toBeUndefined()
  })
})

describe('buildStagePlan — schody i barierki', () => {
  it('liczy wiele biegów schodów i dobiera stopnie do wysokości', () => {
    const plan = planFor({
      decks: RECT_6x4(),
      legHeightCm: 60,
      stairs: [
        createStageStair('front', 0, 1),
        createStageStair('left', 0, 1),
        createStageStair('right', 6, 2),
      ],
    })
    expect(plan.counts.stairs).toBe(3)
    expect(plan.counts.stepsPerStair).toBe(3)
    expect(bomLine(plan, 'stairs')?.quantity).toBe(3)
    expect(stageStairDepthM(60)).toBe(0.75)
    expect(plan.stairs.every((stair) => stairIsAttached(stair, plan.edges))).toBe(true)
  })

  it('schody wycinają przejście w barierce', () => {
    const withoutStairs = planFor({ decks: RECT_6x4() })
    expect(withoutStairs.railingMb).toBe(14)

    const withStair = planFor({
      decks: RECT_6x4(),
      stairs: [createStageStair('left', 0, 1)],
    })
    expect(withStair.railingMb).toBe(13)
    expect(withStair.notes.some((note) => note.includes('przejść na schody'))).toBe(true)
  })

  it('schody poza obrysem są sygnalizowane', () => {
    const plan = planFor({
      decks: RECT_6x4(),
      stairs: [createStageStair('front', 0, 12)],
    })
    expect(stairIsAttached(plan.stairs[0]!, plan.edges)).toBe(false)
    expect(plan.warnings.some((w) => w.includes('nie przylega'))).toBe(true)
  })

  it('poniżej 40 cm schody i barierki nie są liczone', () => {
    const plan = planFor({
      decks: RECT_6x4(),
      legHeightCm: 20,
      stairs: [createStageStair('front', 0, 1)],
    })
    expect(plan.counts.stairs).toBe(0)
    expect(plan.railingMb).toBe(0)
    expect(plan.warnings.some((w) => w.includes('nie są liczone'))).toBe(true)
  })
})

describe('wybór krawędzi', () => {
  it('przełączenie pojedynczej krawędzi nadpisuje regułę strony', () => {
    const plan = planFor({ decks: RECT_6x4() })
    const front = plan.edges.find((edge) => edge.side === 'front')!
    const next = toggleEdgeInSelection(plan.cladding, front)
    expect(isEdgeSelected(next, front)).toBe(false)
    const replanned = planFor({ decks: plan.decks, cladding: next })
    expect(replanned.claddingMb).toBe(14)
  })

  it('przełączenie strony kasuje wyjątki na tej stronie', () => {
    const plan = planFor({ decks: RECT_6x4() })
    const front = plan.edges.find((edge) => edge.side === 'front')!
    const withOverride = toggleEdgeInSelection(plan.cladding, front)
    const reset = toggleSideInSelection(withOverride, 'front', plan.edges)
    expect(reset.overrides[front.key]).toBeUndefined()
    expect(reset.sides).not.toContain('front')
  })

  it('wyjątki dla krawędzi, których już nie ma, są czyszczone', () => {
    const plan = planFor({
      decks: RECT_6x4(),
      cladding: { sides: ['front'], overrides: { 'H|9|9|9|front': true } },
    })
    expect(Object.keys(plan.cladding.overrides)).toHaveLength(0)
  })

  it('opisuje wybór krawędzi po stronach', () => {
    const plan = planFor({
      decks: RECT_6x4(),
      cladding: edgeSelection(['front', 'left']),
    })
    expect(edgeSelectionLabel(plan.cladding, plan.edges)).toBe('front + lewy bok')
    expect(edgeSelectionLabel(edgeSelection([]), plan.edges)).toBe('brak krawędzi')
  })
})

describe('walidacja układu', () => {
  it('ostrzega o nachodzących blatach', () => {
    const plan = planFor({
      decks: [createStageDeck('2x1', 0, 0), createStageDeck('2x1', 1, 0)],
    })
    expect(plan.issues.overlaps).toBe(1)
    expect(plan.warnings.some((w) => w.includes('nachodzą'))).toBe(true)
  })

  it('ostrzega o rozłącznych wyspach i nieszczelnych stykach', () => {
    const islands = planFor({
      decks: [createStageDeck('2x1', 0, 0), createStageDeck('2x1', 6, 0)],
    })
    expect(islands.warnings.some((w) => w.includes('rozłączne'))).toBe(true)

    const gap = planFor({
      decks: [
        createStageDeck('2x1', 0, 0),
        { ...createStageDeck('2x1', 2, 0), x: 2.06 },
      ],
    })
    expect(gap.warnings.some((w) => w.includes('nie stykają się'))).toBe(true)
  })
})

describe('zapis i odczyt', () => {
  it('zapisuje tylko część redagowaną i przelicza pochodne przy odczycie', () => {
    const plan = planFor({
      decks: L_SHAPE(),
      floorMaterial: 'carpet',
      stairs: [createStageStair('front', 0, 2)],
    })
    const restored = parseStagePlanJson(serializeStagePlan(plan))
    expect(restored).not.toBeNull()
    expect(restored!.areaM2).toBe(28)
    expect(restored!.claddingMb).toBe(24)
    expect(restored!.stairs).toHaveLength(1)
    expect(restored!.counts.legs).toBe(56)
  })

  it('odrzuca śmieci', () => {
    expect(parseStagePlanJson(null)).toBeNull()
    expect(parseStagePlanJson('{')).toBeNull()
    expect(parseStagePlanJson('{"version":9}')).toBeNull()
  })
})

describe('migracja planów v1', () => {
  const legacyJson = JSON.stringify({
    version: 1,
    requestedWidthM: 6,
    requestedDepthM: 4,
    widthM: 6,
    depthM: 4,
    orientationUsed: 'long-along-front',
    tiles: [0, 1, 2, 3].flatMap((y) =>
      [0, 2, 4].map((x) => ({ x, y, w: 2, h: 1, kind: '2x1' }))
    ),
    claddingMaterial: 'hard',
    claddingSides: 'front-sides',
    claddingMeters: 14,
    legHeightCm: 80,
    legShare: 'shared-corners',
    includeStairs: true,
    includeRailings: true,
    counts: { legs: 35 },
    notes: [],
    bom: [],
  })

  it('podnosi stary snapshot do v2 bez utraty treści', () => {
    const plan = parseStagePlanJson(legacyJson)
    expect(plan).not.toBeNull()
    expect(plan!.version).toBe(2)
    expect(plan!.counts.decksTotal).toBe(12)
    expect(plan!.claddingMaterial).toBe('hips')
    expect(plan!.claddingMb).toBe(14)
    expect(plan!.claddingM2).toBe(11.2)
  })

  it('zamienia współdzielone narożniki na 4 nogi na podest', () => {
    const plan = parseStagePlanJson(legacyJson)!
    expect(plan.counts.legs).toBe(48)
  })

  it('zamienia flagę schodów na jeden bieg na środku frontu', () => {
    const plan = parseStagePlanJson(legacyJson)!
    expect(plan.stairs).toHaveLength(1)
    expect(plan.stairs[0]).toMatchObject({ side: 'front', posM: 2.5, widthM: 1 })
    expect(stairIsAttached(plan.stairs[0]!, plan.edges)).toBe(true)
  })

  it('plan v1 bez dodatków migruje bez schodów i barierek', () => {
    const plan = migrateLegacyStagePlan({
      version: 1,
      tiles: [{ x: 0, y: 0, w: 2, h: 1, kind: '2x1' }],
      claddingMaterial: 'none',
      claddingSides: 'all',
      legHeightCm: 40,
      includeStairs: false,
      includeRailings: false,
    })
    expect(plan.stairs).toHaveLength(0)
    expect(plan.railingMb).toBe(0)
    expect(plan.claddingMb).toBe(0)
  })
})

describe('pomocnicze', () => {
  it('przyciąga do kroku siatki, a przy zerowym kroku tylko zaokrągla', () => {
    expect(snapToStep(1.13, 0.25)).toBe(1.25)
    expect(snapToStep(1.1, 1)).toBe(1)
    expect(snapToStep(1.1234, 0)).toBe(1.123)
  })

  it('znacznik linii zlecenia jest stały', () => {
    expect(STAGE_PLAN_LINE_MARKER).toBe('[plan sceny]')
  })
})
