/**
 * Plan sceny z podestów — model v3.
 *
 * W wersji 1 plan był wynikiem funkcji: z frontu i głębokości algorytm układał
 * prostokąt i z niego liczył materiały. W wersji 2 plan jest dokumentem, który
 * operator redaguje na rzucie: układ podestów jest źródłem, a obwód, pola,
 * barierki i schody są z niego wyliczane. Wymiary gabarytowe zostają wyłącznie
 * jako opis, nie jako podstawa wyceny. Wersja 3 dodaje podesty 0,5×2 / W×D
 * oraz opcjonalną wysokość nóg na każdym podeście.
 */

import {
  STAGE_TOL_M,
  analyzeStageLayout,
  computeSharedEdgeMeters,
  computeStageAreaM2,
  computeStageBounds,
  computeStageJunctions,
  computeStageOutline,
  computeStagePerimeterClamps,
  findEdgeCovering,
  round2,
  roundM,
  type StageEdge,
  type StageEdgeSide,
  type StageLayoutIssues,
  type StageRect,
} from './stagePlatformGeometry'

export {
  STAGE_TOL_M,
  computeStageOutline,
  computeStageAreaM2,
  computeStageBounds,
  roundM,
  round2,
}
export type { StageEdge, StageEdgeSide, StageLayoutIssues, StageRect }

export const STAGE_PLAN_LINE_MARKER = '[plan sceny]'
/** v3: podesty 0.5×2 / custom + opcjonalna wysokość per podest. */
export const STAGE_PLAN_VERSION = 3
export const STAGE_PLAN_MIN_CUSTOM_M = 0.25
export const STAGE_PLAN_MAX_CUSTOM_M = 4

export const STAGE_LEG_HEIGHTS_CM = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200] as const

/** Dostępne kroki siatki. Domyślny 0,25 m pozwala ustawić blat „na ćwiartkę”. */
export const STAGE_GRID_STEPS_M = [0.25, 0.5, 1] as const
export const STAGE_DEFAULT_GRID_STEP_M = 0.25

/** Promień magnesu do krawędzi sąsiada przy wyłączonej siatce. */
export const STAGE_MAGNET_M = 0.1

export const STAGE_MAX_SPAN_M = 40
export const STAGE_MAX_DECKS = 400
export const STAGE_DEFAULT_STAIR_WIDTH_M = 1
export const STAGE_MIN_STAIR_WIDTH_M = 0.5
export const STAGE_MAX_STAIR_WIDTH_M = 4
/**
 * Przyjęta wysokość stopnia — z niej wychodzi liczba stopni i wysięg biegu.
 * Ostatni „stopień” to już powierzchnia sceny, więc nie liczy się do biegu.
 */
export const STAGE_STEP_RISE_CM = 20
export const STAGE_STEP_TREAD_M = 0.25
/** Od tej wysokości schody i barierki mają sens. */
export const STAGE_ACCESSORY_MIN_CM = 40

export type StageDeckKind = '2x1' | '1x1' | '0.5x2' | 'custom'
export type StageCladdingMaterial = 'none' | 'skirt' | 'hips'
export type StageFloorMaterial = 'none' | 'carpet' | 'hips'
export type StageBomUnit = 'szt.' | 'mb' | 'm²'

export interface StageDeck extends StageRect {
  id: string
  kind: StageDeckKind
  /** Wysokość nóg tego podestu (cm). Brak = `plan.legHeightCm`. */
  heightCm?: number
}

/**
 * Bieg schodów przypięty do krawędzi konturu.
 *
 * Pozycja jest zapisana bezwzględnie (`atM` = współrzędna krawędzi, `posM` =
 * początek wzdłuż niej), a nie kluczem krawędzi: klucze zmieniają się przy
 * każdej edycji układu, a schody mają zostać tam, gdzie je postawiono.
 */
export interface StageStair {
  id: string
  side: StageEdgeSide
  atM: number
  posM: number
  widthM: number
}

/**
 * Wybór krawędzi pod obicie albo barierki: bazowo całe strony sceny, plus
 * ręczne wyjątki dla pojedynczych krawędzi. Wyjątki przetrwają przesunięcie
 * podestu tylko wtedy, gdy krawędź się nie zmieniła — reszta wraca do reguły
 * dla strony, co jest zachowaniem przewidywalnym dla operatora.
 */
export interface StageEdgeSelection {
  sides: StageEdgeSide[]
  overrides: Record<string, boolean>
}

export interface StageBomLine {
  key: string
  /** Stabilny klucz mapowania na rekord sprzętu (`Equipment.stagePlanKey`). */
  catalogKey: string
  name: string
  quantity: number
  unit: StageBomUnit
  group: 'decks' | 'legs' | 'clamps' | 'cladding' | 'floor' | 'accessories'
  offer: boolean
}

export function resolveStageBomCatalogKey(
  key: string,
  ctx: {
    legHeightCm: number
    claddingMaterial: StageCladdingMaterial
    floorMaterial: StageFloorMaterial
  }
): string {
  switch (key) {
    case 'legs':
      return `legs-${ctx.legHeightCm}`
    case 'cladding':
      return ctx.claddingMaterial === 'skirt' ? 'cladding-skirt' : 'cladding-hips'
    case 'floor':
      return ctx.floorMaterial === 'carpet' ? 'floor-carpet' : 'floor-hips'
    case 'stairs':
      return `stairs-${ctx.legHeightCm}`
    default:
      return key
  }
}

export const STAGE_PLAN_CATALOG_KEY_LABELS: Record<string, string> = {
  'deck-2x1': 'Podest 2×1 m',
  'deck-1x1': 'Podest 1×1 m',
  'deck-0.5x2': 'Podest 0,5×2 m',
  'deck-custom': 'Podest niestandardowy (W×D)',
  'deck-clamps': 'Klamry blatów',
  'dual-leg-clamps': 'Klamry nóg podwójne',
  'quad-leg-clamps': 'Klamry nóg poczwórne',
  braces: 'Stężenia',
  'cladding-skirt': 'Obicie — kotara (mb)',
  'cladding-hips': 'Obicie — HIPS (m²)',
  'floor-carpet': 'Wykładzina na podestach',
  'floor-hips': 'Podłoga HIPS',
  railings: 'Barierki',
  legs: 'Nogi do podestów',
  stairs: 'Schody na scenę',
  ...Object.fromEntries(STAGE_LEG_HEIGHTS_CM.map((h) => [`legs-${h}`, `Nogi ${h} cm`])),
  ...Object.fromEntries(STAGE_LEG_HEIGHTS_CM.map((h) => [`stairs-${h}`, `Schody ${h} cm`])),
}

/**
 * Role / rodziny edytowane w zębatce mapowania.
 * `legs` i `stairs` pokrywają wszystkie wysokości, chyba że jest nadpisanie legs-40 itd.
 */
export const STAGE_PLAN_ROLE_CONFIG_KEYS = [
  'deck-2x1',
  'deck-1x1',
  'deck-0.5x2',
  'deck-custom',
  'legs',
  'deck-clamps',
  'dual-leg-clamps',
  'quad-leg-clamps',
  'braces',
  'cladding-skirt',
  'cladding-hips',
  'floor-carpet',
  'floor-hips',
  'stairs',
  'railings',
] as const

export type StagePlanRoleConfigKey = (typeof STAGE_PLAN_ROLE_CONFIG_KEYS)[number]

/** Rodzina roli dla konkretnego catalogKey (legs-40 → legs, deck-custom-1x0.5 → deck-custom). */
export function stagePlanRoleFamily(catalogKey: string): string {
  if (catalogKey.startsWith('legs-')) return 'legs'
  if (catalogKey.startsWith('stairs-')) return 'stairs'
  if (catalogKey.startsWith('deck-custom')) return 'deck-custom'
  return catalogKey
}

/** Klucze do wyszukania w przepisie: najpierw dokładny, potem rodzina. */
export function stagePlanRoleLookupKeys(catalogKey: string): string[] {
  const family = stagePlanRoleFamily(catalogKey)
  return family === catalogKey ? [catalogKey] : [catalogKey, family]
}

/** Część planu, którą redaguje operator. To ona jest zapisywana w zleceniu. */
export interface StagePlanInput {
  decks: StageDeck[]
  stairs: StageStair[]
  claddingMaterial: StageCladdingMaterial
  cladding: StageEdgeSelection
  floorMaterial: StageFloorMaterial
  railings: StageEdgeSelection
  legHeightCm: number
  snapToGrid: boolean
  gridStepM: number
}

export interface StagePlan extends StagePlanInput {
  version: 2 | 3
  /** Gabaryt — do nagłówka i podglądu, nie do liczenia materiałów. */
  widthM: number
  depthM: number
  edges: StageEdge[]
  areaM2: number
  claddingMb: number
  claddingM2: number
  railingMb: number
  counts: {
    decks2x1: number
    decks1x1: number
    decks05x2: number
    decksCustom: number
    decksTotal: number
    legs: number
    deckClamps: number
    dualLegClamps: number
    quadLegClamps: number
    braces: number
    stairs: number
    stepsPerStair: number
  }
  issues: StageLayoutIssues
  warnings: string[]
  notes: string[]
  bom: StageBomLine[]
}

export const STAGE_EDGE_SIDES = ['front', 'right', 'back', 'left'] as const

let idCounter = 0

function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

export function clampStageDeckSizeM(value: number): number {
  if (!Number.isFinite(value)) return STAGE_PLAN_MIN_CUSTOM_M
  return roundM(
    Math.min(STAGE_PLAN_MAX_CUSTOM_M, Math.max(STAGE_PLAN_MIN_CUSTOM_M, value))
  )
}

export function normalizeStageLegHeightCm(value: unknown, fallback = 60): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  if ((STAGE_LEG_HEIGHTS_CM as readonly number[]).includes(n)) return n
  // Najbliższa standardowa wysokość.
  let best: number = STAGE_LEG_HEIGHTS_CM[0]!
  let bestDist = Math.abs(best - n)
  for (const h of STAGE_LEG_HEIGHTS_CM) {
    const d = Math.abs(h - n)
    if (d < bestDist) {
      best = h
      bestDist = d
    }
  }
  return best
}

/** Efektywna wysokość podestu — własne pole albo domyślna planu. */
export function deckHeightCm(deck: StageDeck, planLegHeightCm: number): number {
  if (deck.heightCm == null) return normalizeStageLegHeightCm(planLegHeightCm)
  return normalizeStageLegHeightCm(deck.heightCm, planLegHeightCm)
}

function sizeForKind(kind: StageDeckKind, rotated: boolean): { w: number; h: number } {
  if (kind === '1x1') return { w: 1, h: 1 }
  if (kind === '2x1') return rotated ? { w: 1, h: 2 } : { w: 2, h: 1 }
  if (kind === '0.5x2') return rotated ? { w: 2, h: 0.5 } : { w: 0.5, h: 2 }
  return { w: 1, h: 1 }
}

export function createStageDeck(
  kind: StageDeckKind,
  x: number,
  y: number,
  rotated = false,
  customSize?: { w: number; h: number },
  heightCm?: number
): StageDeck {
  const size =
    kind === 'custom' && customSize
      ? { w: clampStageDeckSizeM(customSize.w), h: clampStageDeckSizeM(customSize.h) }
      : sizeForKind(kind === 'custom' ? '1x1' : kind, rotated)
  const deck: StageDeck = {
    id: nextId('d'),
    kind: kind === 'custom' ? 'custom' : kind,
    x: roundM(x),
    y: roundM(y),
    w: size.w,
    h: size.h,
  }
  if (heightCm != null) deck.heightCm = normalizeStageLegHeightCm(heightCm)
  return deck
}

export function createCustomStageDeck(
  widthM: number,
  depthM: number,
  x: number,
  y: number,
  heightCm?: number
): StageDeck {
  return createStageDeck('custom', x, y, false, { w: widthM, h: depthM }, heightCm)
}

export function rotateStageDeck(deck: StageDeck): StageDeck {
  if (Math.abs(deck.w - deck.h) < STAGE_TOL_M) return deck
  return { ...deck, w: deck.h, h: deck.w }
}

/** Klucz katalogowy blatu custom (np. deck-custom-1.5x0.5). */
export function customDeckCatalogKey(widthM: number, depthM: number): string {
  const a = formatMeters(roundM(widthM)).replace(',', '.')
  const b = formatMeters(roundM(depthM)).replace(',', '.')
  return `deck-custom-${a}x${b}`
}

export function deckKindLabel(deck: StageDeck): string {
  if (deck.kind === '2x1') return '2×1'
  if (deck.kind === '1x1') return '1×1'
  if (deck.kind === '0.5x2') return '0,5×2'
  return `${formatMeters(deck.w)}×${formatMeters(deck.h)}`
}

/** Czy podest ma inną wysokość niż domyślna planu (do etykiety / legendy). */
export function deckHasCustomHeight(deck: StageDeck, planLegHeightCm: number): boolean {
  if (deck.heightCm == null) return false
  return deckHeightCm(deck, planLegHeightCm) !== normalizeStageLegHeightCm(planLegHeightCm)
}

/** Etykieta rozmiaru na rzucie (bez wysokości). */
export function deckPlanLabel(deck: StageDeck, _planLegHeightCm?: number): string {
  return deckKindLabel(deck)
}

/** Druga linia etykiety: wysokość w cm, tylko gdy różni się od domyślnej. */
export function deckPlanHeightLabel(deck: StageDeck, planLegHeightCm: number): string | null {
  if (!deckHasCustomHeight(deck, planLegHeightCm)) return null
  return `${deckHeightCm(deck, planLegHeightCm)} cm`
}

function deckTouchesOutlineEdge(deck: StageRect, edge: StageEdge, tol = STAGE_TOL_M): boolean {
  const horizontal = edge.side === 'front' || edge.side === 'back'
  const edgeLo = horizontal ? Math.min(edge.x1, edge.x2) : Math.min(edge.y1, edge.y2)
  const edgeHi = horizontal ? Math.max(edge.x1, edge.x2) : Math.max(edge.y1, edge.y2)
  if (edge.side === 'front') {
    if (Math.abs(deck.y - edge.y1) > tol) return false
    return Math.min(deck.x + deck.w, edgeHi) - Math.max(deck.x, edgeLo) > tol
  }
  if (edge.side === 'back') {
    if (Math.abs(deck.y + deck.h - edge.y1) > tol) return false
    return Math.min(deck.x + deck.w, edgeHi) - Math.max(deck.x, edgeLo) > tol
  }
  if (edge.side === 'left') {
    if (Math.abs(deck.x - edge.x1) > tol) return false
    return Math.min(deck.y + deck.h, edgeHi) - Math.max(deck.y, edgeLo) > tol
  }
  if (Math.abs(deck.x + deck.w - edge.x1) > tol) return false
  return Math.min(deck.y + deck.h, edgeHi) - Math.max(deck.y, edgeLo) > tol
}

/** Wysokość podestu przy krawędzi konturu (max sąsiadujących). */
export function edgeFaceHeightCm(
  edge: StageEdge,
  decks: StageDeck[],
  planLegHeightCm: number
): number {
  let maxH = 0
  for (const deck of decks) {
    if (!deckTouchesOutlineEdge(deck, edge)) continue
    maxH = Math.max(maxH, deckHeightCm(deck, planLegHeightCm))
  }
  return maxH > 0 ? maxH : normalizeStageLegHeightCm(planLegHeightCm)
}

export function stairAttachedHeightCm(
  stair: StageStair,
  decks: StageDeck[],
  edges: StageEdge[],
  planLegHeightCm: number
): number {
  const cover = findEdgeCovering(edges, stair.side, stair.atM, stair.posM, stair.widthM)
  if (!cover) return normalizeStageLegHeightCm(planLegHeightCm)
  return edgeFaceHeightCm(cover, decks, planLegHeightCm)
}

function normalizeDeckKind(raw: unknown, w: number, h: number): StageDeckKind {
  if (raw === '2x1' || raw === '1x1' || raw === '0.5x2' || raw === 'custom') return raw
  const a = Math.min(w, h)
  const b = Math.max(w, h)
  if (Math.abs(a - 1) <= STAGE_TOL_M && Math.abs(b - 1) <= STAGE_TOL_M) return '1x1'
  if (Math.abs(a - 1) <= STAGE_TOL_M && Math.abs(b - 2) <= STAGE_TOL_M) return '2x1'
  if (Math.abs(a - 0.5) <= STAGE_TOL_M && Math.abs(b - 2) <= STAGE_TOL_M) return '0.5x2'
  return 'custom'
}

export function normalizeStageDeck(
  raw: unknown,
  planLegHeightCm = 60
): StageDeck | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<StageDeck>
  const wRaw = Number(item.w)
  const hRaw = Number(item.h)
  const w = Number.isFinite(wRaw) && wRaw > 0 ? roundM(wRaw) : 1
  const h = Number.isFinite(hRaw) && hRaw > 0 ? roundM(hRaw) : 1
  const kind = normalizeDeckKind(item.kind, w, h)
  const deck: StageDeck = {
    id: typeof item.id === 'string' && item.id ? item.id : nextId('d'),
    kind,
    x: roundM(Number(item.x) || 0),
    y: roundM(Number(item.y) || 0),
    w: kind === 'custom' ? clampStageDeckSizeM(w) : w,
    h: kind === 'custom' ? clampStageDeckSizeM(h) : h,
  }
  if (item.heightCm != null) {
    deck.heightCm = normalizeStageLegHeightCm(item.heightCm, planLegHeightCm)
  }
  return deck
}

export function createStageStair(
  side: StageEdgeSide,
  atM: number,
  posM: number,
  widthM = STAGE_DEFAULT_STAIR_WIDTH_M
): StageStair {
  return {
    id: nextId('s'),
    side,
    atM: roundM(atM),
    posM: roundM(posM),
    widthM: clampStairWidth(widthM),
  }
}

export function clampStairWidth(value: number): number {
  if (!Number.isFinite(value)) return STAGE_DEFAULT_STAIR_WIDTH_M
  return round2(Math.min(STAGE_MAX_STAIR_WIDTH_M, Math.max(STAGE_MIN_STAIR_WIDTH_M, value)))
}

export function edgeSelection(sides: StageEdgeSide[] = []): StageEdgeSelection {
  return { sides: [...sides], overrides: {} }
}

export function isEdgeSelected(selection: StageEdgeSelection, edge: StageEdge): boolean {
  const override = selection.overrides[edge.key]
  if (typeof override === 'boolean') return override
  return selection.sides.includes(edge.side)
}

export function selectedEdges(
  selection: StageEdgeSelection,
  edges: StageEdge[]
): StageEdge[] {
  return edges.filter((edge) => isEdgeSelected(selection, edge))
}

export function toggleEdgeInSelection(
  selection: StageEdgeSelection,
  edge: StageEdge
): StageEdgeSelection {
  const next = { ...selection, overrides: { ...selection.overrides } }
  const wanted = !isEdgeSelected(selection, edge)
  if (wanted === selection.sides.includes(edge.side)) delete next.overrides[edge.key]
  else next.overrides[edge.key] = wanted
  return next
}

export function toggleSideInSelection(
  selection: StageEdgeSelection,
  side: StageEdgeSide,
  edges: StageEdge[]
): StageEdgeSelection {
  const active = selection.sides.includes(side)
  const sides = active
    ? selection.sides.filter((s) => s !== side)
    : [...selection.sides, side]
  const overrides = { ...selection.overrides }
  // Przełączenie całej strony kasuje wyjątki na tej stronie — inaczej klik
  // w „Front” nie robiłby nic, gdy wszystkie krawędzie mają override.
  for (const edge of edges) {
    if (edge.side === side) delete overrides[edge.key]
  }
  return { sides, overrides }
}

/** Krok siatki: 0 wyłącza przyciąganie. */
export function snapToStep(value: number, step: number): number {
  if (!Number.isFinite(value)) return 0
  if (!Number.isFinite(step) || step <= 0) return roundM(value)
  return roundM(Math.round(value / step) * step)
}

/**
 * Wypełnia prostokąt blatami — akcja startowa edytora, nie stan planu.
 * Zawsze maksymalizuje liczbę 2×1: najpierw w preferowanym kierunku, potem
 * obrócone w pasku resztkowym, a 1×1 tylko na komórki, których nie da się
 * pokryć blatem 2×1.
 */
export function fillRectWithDecks(
  widthM: number,
  depthM: number,
  longAlongFront = true
): StageDeck[] {
  const w = Math.max(0, Math.floor(widthM))
  const d = Math.max(0, Math.floor(depthM))
  if (w < 1 || d < 1) return []
  const decks: StageDeck[] = []

  if (longAlongFront) {
    const pairs = Math.floor(w / 2)
    for (let y = 0; y < d; y += 1) {
      for (let i = 0; i < pairs; i += 1) decks.push(createStageDeck('2x1', i * 2, y))
    }
    if (w % 2 === 1) {
      const x = pairs * 2
      const verticalPairs = Math.floor(d / 2)
      for (let i = 0; i < verticalPairs; i += 1) {
        decks.push(createStageDeck('2x1', x, i * 2, true))
      }
      if (d % 2 === 1) decks.push(createStageDeck('1x1', x, verticalPairs * 2))
    }
    return decks
  }

  const pairs = Math.floor(d / 2)
  for (let x = 0; x < w; x += 1) {
    for (let i = 0; i < pairs; i += 1) decks.push(createStageDeck('2x1', x, i * 2, true))
  }
  if (d % 2 === 1) {
    const y = pairs * 2
    const horizontalPairs = Math.floor(w / 2)
    for (let i = 0; i < horizontalPairs; i += 1) {
      decks.push(createStageDeck('2x1', i * 2, y))
    }
    if (w % 2 === 1) decks.push(createStageDeck('1x1', horizontalPairs * 2, y))
  }
  return decks
}

/**
 * Liczba stopni biegu (bieżni) do wysokości nóg — bez poziomu sceny.
 * Np. scena 60 cm → stopnie 20 i 40 cm (2), potem wejście na podest.
 */
export function stageStairSteps(legHeightCm: number): number {
  return Math.max(1, Math.ceil(legHeightCm / STAGE_STEP_RISE_CM) - 1)
}

/** Wysięg biegu schodów poza kontur sceny (tylko bieżnie pośrednie). */
export function stageStairDepthM(legHeightCm: number): number {
  return round2(stageStairSteps(legHeightCm) * STAGE_STEP_TREAD_M)
}

function stairOverlapOnEdge(stair: StageStair, edge: StageEdge): number {
  const horizontal = edge.side === 'front' || edge.side === 'back'
  const edgeAt = horizontal ? edge.y1 : edge.x1
  if (edge.side !== stair.side || Math.abs(edgeAt - stair.atM) > STAGE_TOL_M) return 0
  const start = horizontal ? edge.x1 : edge.y1
  const end = horizontal ? edge.x2 : edge.y2
  return Math.max(0, Math.min(end, stair.posM + stair.widthM) - Math.max(start, stair.posM))
}

export function stairIsAttached(stair: StageStair, edges: StageEdge[]): boolean {
  return (
    findEdgeCovering(edges, stair.side, stair.atM, stair.posM, stair.widthM) !== null
  )
}

export function emptyStagePlanInput(): StagePlanInput {
  return {
    decks: [],
    stairs: [],
    claddingMaterial: 'skirt',
    cladding: edgeSelection([...STAGE_EDGE_SIDES]),
    floorMaterial: 'none',
    railings: edgeSelection(['back', 'left', 'right']),
    legHeightCm: 60,
    snapToGrid: true,
    gridStepM: STAGE_DEFAULT_GRID_STEP_M,
  }
}

/** Domyślny plan otwierany, gdy zlecenie nie ma jeszcze sceny. */
export function createDefaultStagePlan(): StagePlan {
  return buildStagePlan({ ...emptyStagePlanInput(), decks: fillRectWithDecks(6, 4, true) })
}

function pushBom(
  bom: StageBomLine[],
  line: Omit<StageBomLine, 'catalogKey'>,
  catalogCtx: {
    legHeightCm: number
    claddingMaterial: StageCladdingMaterial
    floorMaterial: StageFloorMaterial
  }
) {
  const catalogKey = resolveStageBomCatalogKey(line.key, catalogCtx)
  if (line.quantity > 0) bom.push({ ...line, catalogKey })
}

function prunedSelection(
  selection: StageEdgeSelection,
  edges: StageEdge[]
): StageEdgeSelection {
  const known = new Set(edges.map((edge) => edge.key))
  const overrides: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(selection.overrides ?? {})) {
    if (known.has(key)) overrides[key] = value
  }
  const sides = (selection.sides ?? []).filter((side) =>
    STAGE_EDGE_SIDES.includes(side)
  )
  return { sides, overrides }
}

export function buildStagePlan(input: StagePlanInput): StagePlan {
  const decks = input.decks.slice(0, STAGE_MAX_DECKS)
  const edges = computeStageOutline(decks)
  const bounds = computeStageBounds(decks)
  const areaM2 = computeStageAreaM2(decks)
  const issues = analyzeStageLayout(decks)
  const junctions = computeStageJunctions(decks)
  const perimeterClamps = computeStagePerimeterClamps(decks)

  const cladding = prunedSelection(input.cladding, edges)
  const railings = prunedSelection(input.railings, edges)
  const height = normalizeStageLegHeightCm(input.legHeightCm)
  const catalogCtx = {
    legHeightCm: height,
    claddingMaterial: input.claddingMaterial,
    floorMaterial: input.floorMaterial,
  }
  const deckHeights = decks.map((deck) => deckHeightCm(deck, height))
  const maxDeckHeight = deckHeights.length > 0 ? Math.max(...deckHeights) : height
  const accessoriesAllowed = maxDeckHeight >= STAGE_ACCESSORY_MIN_CM

  const decks2x1 = decks.filter((deck) => deck.kind === '2x1').length
  const decks1x1 = decks.filter((deck) => deck.kind === '1x1').length
  const decks05x2 = decks.filter((deck) => deck.kind === '0.5x2').length
  const decksCustom = decks.filter((deck) => deck.kind === 'custom').length
  const decksTotal = decks.length
  const legs = decksTotal * 4
  const legsByHeight = new Map<number, number>()
  for (const deck of decks) {
    const h = deckHeightCm(deck, height)
    legsByHeight.set(h, (legsByHeight.get(h) ?? 0) + 4)
  }

  const claddingEdges =
    input.claddingMaterial === 'none' ? [] : selectedEdges(cladding, edges)
  const claddingMb = round2(claddingEdges.reduce((acc, edge) => acc + edge.lengthM, 0))
  // Przy mieszanych wysokościach obicie m² liczymy od wysokości podestu przy krawędzi (max sąsiadów).
  const claddingM2 = round2(
    claddingEdges.reduce((acc, edge) => {
      const faceH = edgeFaceHeightCm(edge, decks, height)
      return acc + (edge.lengthM * faceH) / 100
    }, 0)
  )

  // Barierki tylko na krawędziach podestów ≥ 40 cm.
  const railingCandidateEdges = selectedEdges(railings, edges).filter(
    (edge) => edgeFaceHeightCm(edge, decks, height) >= STAGE_ACCESSORY_MIN_CM
  )
  const railingEdges = accessoriesAllowed ? railingCandidateEdges : []
  const railingGross = railingEdges.reduce((acc, edge) => acc + edge.lengthM, 0)
  const stairs = accessoriesAllowed
    ? input.stairs.filter(
        (stair) => stairAttachedHeightCm(stair, decks, edges, height) >= STAGE_ACCESSORY_MIN_CM
      )
    : []
  const railingGaps = stairs.reduce((acc, stair) => {
    const onSelectedEdge = railingEdges.reduce(
      (best, edge) => Math.max(best, stairOverlapOnEdge(stair, edge)),
      0
    )
    return acc + onSelectedEdge
  }, 0)
  const railingMb = round2(Math.max(0, railingGross - railingGaps))

  // Klamry/stężenia — progi osobno w każdej grupie wysokości.
  let dualLegClamps = 0
  let quadLegClamps = 0
  let braces = 0
  const decksByHeight = new Map<number, StageDeck[]>()
  for (const deck of decks) {
    const h = deckHeightCm(deck, height)
    const list = decksByHeight.get(h) ?? []
    list.push(deck)
    decksByHeight.set(h, list)
  }
  for (const [groupHeight, group] of decksByHeight) {
    const groupJunctions = computeStageJunctions(group)
    const clampRows = groupHeight > 100 ? 2 : 1
    if (groupHeight >= 60) {
      dualLegClamps += groupJunctions.dual * clampRows
      quadLegClamps += groupJunctions.quad * clampRows
    }
    if (groupHeight >= 168) {
      braces += groupJunctions.dual + groupJunctions.quad
    }
  }
  // Fallback: gdy jedna wysokość, użyj globalnych junctionów (dokładniejsze styki).
  if (decksByHeight.size <= 1) {
    const clampRows = maxDeckHeight > 100 ? 2 : 1
    dualLegClamps = maxDeckHeight >= 60 ? junctions.dual * clampRows : 0
    quadLegClamps = maxDeckHeight >= 60 ? junctions.quad * clampRows : 0
    braces = maxDeckHeight >= 168 ? junctions.dual + junctions.quad : 0
  }
  const stepsPerStair = stageStairSteps(maxDeckHeight)

  const warnings: string[] = []
  if (decksTotal === 0) {
    warnings.push('Plan jest pusty — dodaj podesty na rzucie.')
  }
  if (issues.overlaps > 0) {
    warnings.push(
      `Podesty nachodzą na siebie w ${issues.overlaps} ${issues.overlaps === 1 ? 'miejscu' : 'miejscach'} — takiego układu nie da się zbudować.`
    )
  }
  if (issues.islands > 1) {
    warnings.push(
      `Układ ma ${issues.islands} rozłączne części — jeśli to nie są osobne wyspy, dosuń podesty do siebie.`
    )
  }
  if (issues.nearMisses > 0) {
    warnings.push(
      `W ${issues.nearMisses} ${issues.nearMisses === 1 ? 'miejscu' : 'miejscach'} podesty nie stykają się dokładnie — obicie policzone po konturze z tolerancją 2 cm.`
    )
  }
  const detachedStairs = stairs.filter((stair) => !stairIsAttached(stair, edges)).length
  if (detachedStairs > 0) {
    warnings.push(
      `${detachedStairs} ${detachedStairs === 1 ? 'bieg schodów nie przylega' : 'biegi schodów nie przylegają'} do krawędzi sceny — przestaw je na obrys.`
    )
  }
  if (input.stairs.length > 0 && !accessoriesAllowed) {
    warnings.push(
      `Przy wysokości ${height} cm schody i barierki nie są liczone — wejście jest jednym stopniem.`
    )
  }
  if (bounds.widthM > STAGE_MAX_SPAN_M || bounds.depthM > STAGE_MAX_SPAN_M) {
    warnings.push(`Gabaryt sceny przekracza ${STAGE_MAX_SPAN_M} m — sprawdź układ.`)
  }

  const notes: string[] = []
  if (decksTotal > 0) {
    notes.push(
      `Układ ${bounds.widthM} × ${bounds.depthM} m gabarytowo, powierzchnia użytkowa ${formatMeters(areaM2)} m².`
    )
    notes.push('Nogi: 4 na każdy podest, bez współdzielenia narożników.')
  }
  if (claddingMb > 0) {
    notes.push(
      `Obicie ${claddingMaterialLabel(input.claddingMaterial).toLowerCase()} na ${edgeSelectionLabel(cladding, edges)}: ${formatMeters(claddingMb)} mb, ${formatMeters(claddingM2)} m² przy wysokości ${height} cm.`
    )
  }
  if (input.floorMaterial !== 'none' && areaM2 > 0) {
    notes.push(
      `Podłoga ${floorMaterialLabel(input.floorMaterial).toLowerCase()}: ${formatMeters(areaM2)} m².`
    )
  }
  if (stairs.length > 0) {
    notes.push(
      `Schody: ${stairs.length} ${stairs.length === 1 ? 'bieg' : 'biegi'} (stopnie od wysokości podestu przy krawędzi).`
    )
  }
  if (railingMb > 0) {
    notes.push(
      `Barierki na ${edgeSelectionLabel(railings, edges)}: ${formatMeters(railingMb)} mb${railingGaps > 0 ? ` (po odjęciu ${formatMeters(round2(railingGaps))} mb przejść na schody)` : ''}.`
    )
  }
  if (maxDeckHeight >= 60) notes.push('Powyżej 60 cm wysokości: klamry nóg obowiązkowe (stężenie).')
  if (maxDeckHeight > 100) notes.push('Powyżej 100 cm: druga linia klamer nóg (ok. 1/3 i 2/3 wysokości).')
  if (maxDeckHeight >= 168) notes.push('Od 168 cm: dodatkowe stężenia poziome i ukośne.')

  // Uskoki między sąsiednimi podestami o różnych wysokościach — na razie tylko notatka.
  const stepGaps = new Map<number, number>()
  for (let i = 0; i < decks.length; i += 1) {
    for (let j = i + 1; j < decks.length; j += 1) {
      const a = decks[i]!
      const b = decks[j]!
      const ha = deckHeightCm(a, height)
      const hb = deckHeightCm(b, height)
      if (ha === hb) continue
      const shared = computeSharedEdgeMeters([a, b])
      if (shared <= STAGE_TOL_M) continue
      const delta = Math.abs(ha - hb)
      stepGaps.set(delta, round2((stepGaps.get(delta) ?? 0) + shared))
    }
  }
  for (const [delta, mb] of [...stepGaps.entries()].sort((a, b) => a[0] - b[0])) {
    notes.push(`Uskok ${delta} cm na ${formatMeters(mb)} mb (bez automatycznego obicia).`)
  }

  notes.push(
    input.snapToGrid
      ? `Siatka włączona, krok ${formatMeters(input.gridStepM)} m.`
      : `Siatka wyłączona — blaty dociągane magnetycznie do sąsiada w promieniu ${Math.round(STAGE_MAGNET_M * 100)} cm.`
  )

  const bom: StageBomLine[] = []
  pushBom(
    bom,
    {
      key: 'deck-2x1',
      name: 'Podest sceniczny 2×1 m',
      quantity: decks2x1,
      unit: 'szt.',
      group: 'decks',
      offer: true,
    },
    catalogCtx
  )
  pushBom(
    bom,
    {
      key: 'deck-1x1',
      name: 'Podest sceniczny 1×1 m',
      quantity: decks1x1,
      unit: 'szt.',
      group: 'decks',
      offer: true,
    },
    catalogCtx
  )
  pushBom(
    bom,
    {
      key: 'deck-0.5x2',
      name: 'Podest sceniczny 0,5×2 m',
      quantity: decks05x2,
      unit: 'szt.',
      group: 'decks',
      offer: true,
    },
    catalogCtx
  )
  const customCounts = new Map<string, { w: number; h: number; qty: number }>()
  for (const deck of decks) {
    if (deck.kind !== 'custom') continue
    const key = customDeckCatalogKey(deck.w, deck.h)
    const prev = customCounts.get(key)
    if (prev) prev.qty += 1
    else customCounts.set(key, { w: deck.w, h: deck.h, qty: 1 })
  }
  for (const [key, item] of customCounts) {
    pushBom(
      bom,
      {
        key,
        name: `Podest niestandardowy ${formatMeters(item.w)}×${formatMeters(item.h)} m`,
        quantity: item.qty,
        unit: 'szt.',
        group: 'decks',
        offer: true,
      },
      catalogCtx
    )
  }
  for (const [legH, qty] of [...legsByHeight.entries()].sort((a, b) => a[0] - b[0])) {
    pushBom(
      bom,
      {
        key: `legs-${legH}`,
        name: `Nogi do podestów ${legH} cm`,
        quantity: qty,
        unit: 'szt.',
        group: 'legs',
        offer: false,
      },
      catalogCtx
    )
  }
  pushBom(
    bom,
    {
      key: 'deck-clamps',
      name: 'Klamry / szybkozłączki blatów',
      quantity: perimeterClamps,
      unit: 'szt.',
      group: 'clamps',
      offer: false,
    },
    catalogCtx
  )
  pushBom(
    bom,
    {
      key: 'dual-leg-clamps',
      name: 'Klamry nóg podwójne',
      quantity: dualLegClamps,
      unit: 'szt.',
      group: 'clamps',
      offer: false,
    },
    catalogCtx
  )
  pushBom(
    bom,
    {
      key: 'quad-leg-clamps',
      name: 'Klamry nóg poczwórne',
      quantity: quadLegClamps,
      unit: 'szt.',
      group: 'clamps',
      offer: false,
    },
    catalogCtx
  )
  pushBom(
    bom,
    {
      key: 'braces',
      name: 'Stężenia ukośne / poziome',
      quantity: braces,
      unit: 'szt.',
      group: 'clamps',
      offer: false,
    },
    catalogCtx
  )
  if (input.claddingMaterial === 'skirt') {
    pushBom(
      bom,
      {
        key: 'cladding',
        name: `Obicie — kotara (${edgeSelectionLabel(cladding, edges)}, h=${height} cm, ${formatMeters(claddingM2)} m²)`,
        quantity: claddingMb,
        unit: 'mb',
        group: 'cladding',
        offer: true,
      },
      catalogCtx
    )
  }
  if (input.claddingMaterial === 'hips') {
    pushBom(
      bom,
      {
        key: 'cladding',
        name: `Obicie — HIPS (${edgeSelectionLabel(cladding, edges)}, h=${height} cm, ${formatMeters(claddingMb)} mb)`,
        quantity: claddingM2,
        unit: 'm²',
        group: 'cladding',
        offer: true,
      },
      catalogCtx
    )
  }
  if (input.floorMaterial === 'carpet') {
    pushBom(
      bom,
      {
        key: 'floor',
        name: 'Wykładzina na podestach',
        quantity: areaM2,
        unit: 'm²',
        group: 'floor',
        offer: true,
      },
      catalogCtx
    )
  }
  if (input.floorMaterial === 'hips') {
    pushBom(
      bom,
      {
        key: 'floor',
        name: 'Podłoga HIPS na podestach',
        quantity: areaM2,
        unit: 'm²',
        group: 'floor',
        offer: true,
      },
      catalogCtx
    )
  }
  const stairsByHeight = new Map<number, number>()
  for (const stair of stairs) {
    const h = stairAttachedHeightCm(stair, decks, edges, height)
    stairsByHeight.set(h, (stairsByHeight.get(h) ?? 0) + 1)
  }
  for (const [stairH, qty] of [...stairsByHeight.entries()].sort((a, b) => a[0] - b[0])) {
    const steps = stageStairSteps(stairH)
    pushBom(
      bom,
      {
        key: `stairs-${stairH}`,
        name: `Schody na scenę (${stairH} cm, ${steps} ${steps === 1 ? 'stopień pośredni' : 'stopnie pośrednie'})`,
        quantity: qty,
        unit: 'szt.',
        group: 'accessories',
        offer: true,
      },
      catalogCtx
    )
  }
  pushBom(
    bom,
    {
      key: 'railings',
      name: `Barierki (${edgeSelectionLabel(railings, edges)})`,
      quantity: railingMb,
      unit: 'mb',
      group: 'accessories',
      offer: true,
    },
    catalogCtx
  )

  return {
    version: 3,
    decks,
    stairs,
    claddingMaterial: input.claddingMaterial,
    cladding,
    floorMaterial: input.floorMaterial,
    railings,
    legHeightCm: height,
    snapToGrid: input.snapToGrid,
    gridStepM: input.gridStepM,
    widthM: bounds.widthM,
    depthM: bounds.depthM,
    edges,
    areaM2,
    claddingMb,
    claddingM2,
    railingMb,
    counts: {
      decks2x1,
      decks1x1,
      decks05x2,
      decksCustom,
      decksTotal,
      legs,
      deckClamps: perimeterClamps,
      dualLegClamps,
      quadLegClamps,
      braces,
      stairs: stairs.length,
      stepsPerStair,
    },
    issues,
    warnings,
    notes,
    bom,
  }
}

/* ------------------------------------------------------------- migracja --- */

interface LegacyTile {
  x: number
  y: number
  w: number
  h: number
  kind?: string
}

interface LegacyPlan {
  version: 1
  tiles: LegacyTile[]
  claddingMaterial?: string
  claddingSides?: string
  legHeightCm?: number
  includeStairs?: boolean
  includeRailings?: boolean
}

function legacyCladdingSides(sides: string | undefined): StageEdgeSide[] {
  if (sides === 'front') return ['front']
  if (sides === 'front-sides') return ['front', 'left', 'right']
  return [...STAGE_EDGE_SIDES]
}

/**
 * Podnosi plan v1 do v2. Stare snapshoty dokumentów STAGE_PLAN są nieusuwalne,
 * więc migracja działa przy odczycie — renderer nigdy nie dostaje v1.
 * Współdzielone narożniki znikają: nogi są przeliczane na 4 na podest.
 */
export function migrateLegacyStagePlan(legacy: LegacyPlan): StagePlan {
  const decks = (Array.isArray(legacy.tiles) ? legacy.tiles : []).map((tile) => {
    const kind: StageDeckKind = tile.kind === '1x1' ? '1x1' : '2x1'
    const deck = createStageDeck(kind, Number(tile.x) || 0, Number(tile.y) || 0)
    return { ...deck, w: Number(tile.w) || deck.w, h: Number(tile.h) || deck.h }
  })
  const material: StageCladdingMaterial =
    legacy.claddingMaterial === 'hard'
      ? 'hips'
      : legacy.claddingMaterial === 'skirt'
        ? 'skirt'
        : 'none'

  const base: StagePlanInput = {
    decks,
    stairs: [],
    claddingMaterial: material,
    cladding: edgeSelection(legacyCladdingSides(legacy.claddingSides)),
    floorMaterial: 'none',
    railings: edgeSelection(legacy.includeRailings ? ['back', 'left', 'right'] : []),
    legHeightCm: Number(legacy.legHeightCm) || 60,
    snapToGrid: true,
    gridStepM: 1,
  }

  if (!legacy.includeStairs) return buildStagePlan(base)

  const edges = computeStageOutline(decks)
  const front = edges
    .filter((edge) => edge.side === 'front')
    .sort((a, b) => b.lengthM - a.lengthM)[0]
  if (!front) return buildStagePlan(base)
  const width = Math.min(STAGE_DEFAULT_STAIR_WIDTH_M, front.lengthM)
  const stair = createStageStair(
    'front',
    front.y1,
    roundM(front.x1 + (front.lengthM - width) / 2),
    width
  )
  return buildStagePlan({ ...base, stairs: [stair] })
}

export function isStagePlan(value: unknown): value is StagePlan {
  if (!value || typeof value !== 'object') return false
  const plan = value as StagePlan
  return (
    (plan.version === 2 || plan.version === 3) &&
    Array.isArray(plan.decks) &&
    Array.isArray(plan.bom)
  )
}

function isLegacyStagePlan(value: unknown): value is LegacyPlan {
  if (!value || typeof value !== 'object') return false
  const plan = value as LegacyPlan
  return plan.version === 1 && Array.isArray(plan.tiles)
}

/**
 * Wczytuje plan z JSON-a. Pola wyliczane są zawsze przeliczane od nowa, żeby
 * zapisany kiedyś BOM nie rozjechał się z aktualnymi regułami liczenia.
 */
export function parseStagePlanJson(raw: string | null | undefined): StagePlan | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (isLegacyStagePlan(parsed)) return migrateLegacyStagePlan(parsed)
    if (!isStagePlan(parsed)) return null
    const legHeightCm = normalizeStageLegHeightCm(parsed.legHeightCm ?? 60)
    const decks = (Array.isArray(parsed.decks) ? parsed.decks : [])
      .map((deck) => normalizeStageDeck(deck, legHeightCm))
      .filter((deck): deck is StageDeck => deck != null)
    return buildStagePlan({
      decks,
      stairs: Array.isArray(parsed.stairs) ? parsed.stairs : [],
      claddingMaterial: parsed.claddingMaterial ?? 'none',
      cladding: parsed.cladding ?? edgeSelection(),
      floorMaterial: parsed.floorMaterial ?? 'none',
      railings: parsed.railings ?? edgeSelection(),
      legHeightCm,
      snapToGrid: parsed.snapToGrid ?? true,
      gridStepM: parsed.gridStepM ?? STAGE_DEFAULT_GRID_STEP_M,
    })
  } catch {
    return null
  }
}

/** Do zapisu w zleceniu trafia tylko część redagowana — reszta jest pochodna. */
export function serializeStagePlan(plan: StagePlan): string {
  const input: StagePlanInput & { version: 3 } = {
    version: 3,
    decks: plan.decks,
    stairs: plan.stairs,
    claddingMaterial: plan.claddingMaterial,
    cladding: plan.cladding,
    floorMaterial: plan.floorMaterial,
    railings: plan.railings,
    legHeightCm: plan.legHeightCm,
    snapToGrid: plan.snapToGrid,
    gridStepM: plan.gridStepM,
  }
  return JSON.stringify({ ...input, bom: plan.bom })
}

/* --------------------------------------------------------------- opisy ---- */

export function formatMeters(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString('pl-PL', { maximumFractionDigits: 2 })
}

export function claddingMaterialLabel(material: StageCladdingMaterial): string {
  if (material === 'skirt') return 'Kotara'
  if (material === 'hips') return 'HIPS'
  return 'Bez obicia'
}

export function floorMaterialLabel(material: StageFloorMaterial): string {
  if (material === 'carpet') return 'Wykładzina'
  if (material === 'hips') return 'HIPS'
  return 'Bez podłogi'
}

export function edgeSideLabel(side: StageEdgeSide): string {
  if (side === 'front') return 'front'
  if (side === 'back') return 'tył'
  if (side === 'left') return 'lewy bok'
  return 'prawy bok'
}

/** Krótki opis wyboru krawędzi — do notatek, BOM i nagłówka rysunku. */
export function edgeSelectionLabel(
  selection: StageEdgeSelection,
  edges: StageEdge[]
): string {
  const chosen = selectedEdges(selection, edges)
  if (chosen.length === 0) return 'brak krawędzi'
  if (chosen.length === edges.length && edges.length > 0) return 'cały obwód'
  const sides = STAGE_EDGE_SIDES.filter((side) =>
    chosen.some((edge) => edge.side === side)
  )
  const partial = sides.some(
    (side) =>
      chosen.filter((edge) => edge.side === side).length <
      edges.filter((edge) => edge.side === side).length
  )
  const label = sides.map(edgeSideLabel).join(' + ')
  return partial ? `${label} (wybrane krawędzie)` : label
}
