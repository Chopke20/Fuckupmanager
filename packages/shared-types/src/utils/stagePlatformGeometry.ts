/**
 * Geometria układu podestów scenicznych.
 *
 * Wszystkie wymiary w metrach. Układ współrzędnych: x rośnie w prawo,
 * y rośnie w głąb sceny, front (publiczność) leży na y = 0.
 *
 * Podesty są zawsze równoległe do osi (obrót co 90° = zamiana w/h), dzięki
 * czemu kontur zbioru jest zbiorem odcinków poziomych i pionowych i da się go
 * policzyć dokładnie, bez geometrii wielokątów.
 */

/** Tolerancja sklejania krawędzi: szczeliny mniejsze uznajemy za styk. */
export const STAGE_TOL_M = 0.02

/** Szczelina większa od tolerancji, ale mniejsza od tej wartości, to ostrzeżenie. */
export const STAGE_GAP_WARN_M = 0.1

export interface StageRect {
  x: number
  y: number
  w: number
  h: number
}

export type StageEdgeSide = 'front' | 'back' | 'left' | 'right'

export interface StageEdge {
  /** Klucz z geometrii odcinka — stabilny między przeliczeniami tego samego układu. */
  key: string
  side: StageEdgeSide
  x1: number
  y1: number
  x2: number
  y2: number
  lengthM: number
}

export interface StageLayoutIssues {
  /** Pary podestów nachodzących na siebie. */
  overlaps: number
  /** Liczba rozłącznych wysp (1 = scena spójna). */
  islands: number
  /** Pary podestów, które prawie się stykają — szczelina od tolerancji do 10 cm. */
  nearMisses: number
}

const SIDE_ORDER: Record<StageEdgeSide, number> = {
  front: 0,
  right: 1,
  back: 2,
  left: 3,
}

/** Zaokrąglenie do milimetra — używane w kluczach krawędzi i porównaniach. */
export function roundM(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

type Interval = [number, number]

function mergeIntervals(list: Interval[], tol: number): Interval[] {
  const sorted = list.map((iv): Interval => [iv[0], iv[1]]).sort((a, b) => a[0] - b[0])
  const out: Interval[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv[0] <= last[1] + tol) {
      if (iv[1] > last[1]) last[1] = iv[1]
    } else {
      out.push(iv)
    }
  }
  return out
}

/** Łączna długość przedziałów po zsumowaniu części wspólnych. */
export function intervalsLength(list: Interval[], tol = 1e-9): number {
  return mergeIntervals(list, tol).reduce((acc, [a, b]) => acc + (b - a), 0)
}

export function subtractIntervals(
  base: Interval,
  cuts: Interval[],
  tol = STAGE_TOL_M
): Interval[] {
  let parts: Interval[] = [[base[0], base[1]]]
  for (const cut of mergeIntervals(cuts, tol)) {
    const next: Interval[] = []
    for (const part of parts) {
      const start = Math.max(part[0], cut[0])
      const end = Math.min(part[1], cut[1])
      if (end - start <= tol) {
        next.push(part)
        continue
      }
      if (start - part[0] > tol) next.push([part[0], start])
      if (part[1] - end > tol) next.push([end, part[1]])
    }
    parts = next
  }
  return parts.filter(([a, b]) => b - a > tol)
}

function overlapLength(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1))
}

interface RawSegment {
  side: StageEdgeSide
  at: number
  a: number
  b: number
}

/**
 * Kontur zbioru podestów: krawędzie zewnętrzne wraz z wycięciami.
 *
 * Dla każdej krawędzi podestu odejmujemy te jej fragmenty, po drugiej stronie
 * których znajduje się materiał innego podestu. To, co zostanie, jest obwodem.
 * Odcinki współliniowe są scalane, więc front z trzech blatów 2×1 daje jedną
 * krawędź 6 m, a nie trzy po 2 m.
 */
export function computeStageOutline(decks: StageRect[], tol = STAGE_TOL_M): StageEdge[] {
  const raw: RawSegment[] = []

  for (const deck of decks) {
    const xEnd = deck.x + deck.w
    const yEnd = deck.y + deck.h
    const others = decks.filter((other) => other !== deck)

    const belowCuts = others
      .filter((o) => o.y <= deck.y - tol && o.y + o.h >= deck.y - tol)
      .map((o): Interval => [o.x, o.x + o.w])
    for (const [a, b] of subtractIntervals([deck.x, xEnd], belowCuts, tol)) {
      raw.push({ side: 'front', at: deck.y, a, b })
    }

    const aboveCuts = others
      .filter((o) => o.y + o.h >= yEnd + tol && o.y <= yEnd + tol)
      .map((o): Interval => [o.x, o.x + o.w])
    for (const [a, b] of subtractIntervals([deck.x, xEnd], aboveCuts, tol)) {
      raw.push({ side: 'back', at: yEnd, a, b })
    }

    const leftCuts = others
      .filter((o) => o.x <= deck.x - tol && o.x + o.w >= deck.x - tol)
      .map((o): Interval => [o.y, o.y + o.h])
    for (const [a, b] of subtractIntervals([deck.y, yEnd], leftCuts, tol)) {
      raw.push({ side: 'left', at: deck.x, a, b })
    }

    const rightCuts = others
      .filter((o) => o.x + o.w >= xEnd + tol && o.x <= xEnd + tol)
      .map((o): Interval => [o.y, o.y + o.h])
    for (const [a, b] of subtractIntervals([deck.y, yEnd], rightCuts, tol)) {
      raw.push({ side: 'right', at: xEnd, a, b })
    }
  }

  const groups = new Map<string, RawSegment[]>()
  for (const segment of raw) {
    const key = `${segment.side}|${roundM(segment.at)}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(segment)
    else groups.set(key, [segment])
  }

  const edges: StageEdge[] = []
  for (const segments of groups.values()) {
    const first = segments[0]
    if (!first) continue
    const side = first.side
    const at = roundM(first.at)
    const horizontal = side === 'front' || side === 'back'
    for (const [a, b] of mergeIntervals(
      segments.map((s): Interval => [s.a, s.b]),
      tol
    )) {
      const from = roundM(a)
      const to = roundM(b)
      edges.push(
        horizontal
          ? {
              key: `H|${at}|${from}|${to}|${side}`,
              side,
              x1: from,
              y1: at,
              x2: to,
              y2: at,
              lengthM: round2(to - from),
            }
          : {
              key: `V|${at}|${from}|${to}|${side}`,
              side,
              x1: at,
              y1: from,
              x2: at,
              y2: to,
              lengthM: round2(to - from),
            }
      )
    }
  }

  return edges.sort((a, b) => {
    if (a.side !== b.side) return SIDE_ORDER[a.side] - SIDE_ORDER[b.side]
    const aAt = a.side === 'front' || a.side === 'back' ? a.y1 : a.x1
    const bAt = b.side === 'front' || b.side === 'back' ? b.y1 : b.x1
    if (aAt !== bAt) return aAt - bAt
    const aFrom = a.side === 'front' || a.side === 'back' ? a.x1 : a.y1
    const bFrom = b.side === 'front' || b.side === 'back' ? b.x1 : b.y1
    return aFrom - bFrom
  })
}

/**
 * Pole powierzchni zajętej przez podesty — suma zbiorów, nie suma pól.
 * Nachodzące blaty nie są liczone dwa razy, a wycięcia nie są doliczane.
 */
export function computeStageAreaM2(decks: StageRect[], tol = STAGE_TOL_M): number {
  if (decks.length === 0) return 0
  const bands = Array.from(
    new Set(decks.flatMap((d) => [roundM(d.y), roundM(d.y + d.h)]))
  ).sort((a, b) => a - b)

  let area = 0
  for (let i = 0; i < bands.length - 1; i += 1) {
    const from = bands[i]
    const to = bands[i + 1]
    if (from == null || to == null) continue
    const height = to - from
    if (height <= tol) continue
    const spans = decks
      .filter((d) => d.y <= from + tol && d.y + d.h >= to - tol)
      .map((d): Interval => [d.x, d.x + d.w])
    if (spans.length === 0) continue
    area += intervalsLength(spans) * height
  }
  return round2(area)
}

/** Gabaryt układu — tylko do nagłówka i podglądu, nie do liczenia materiałów. */
export function computeStageBounds(decks: StageRect[]): {
  minX: number
  minY: number
  widthM: number
  depthM: number
} {
  if (decks.length === 0) return { minX: 0, minY: 0, widthM: 0, depthM: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const d of decks) {
    minX = Math.min(minX, d.x)
    minY = Math.min(minY, d.y)
    maxX = Math.max(maxX, d.x + d.w)
    maxY = Math.max(maxY, d.y + d.h)
  }
  return {
    minX: roundM(minX),
    minY: roundM(minY),
    widthM: round2(maxX - minX),
    depthM: round2(maxY - minY),
  }
}

/** Długość wspólnych krawędzi między podestami — podstawa liczenia klamer blatów. */
export function computeSharedEdgeMeters(decks: StageRect[], tol = STAGE_TOL_M): number {
  let meters = 0
  for (let i = 0; i < decks.length; i += 1) {
    for (let j = i + 1; j < decks.length; j += 1) {
      const a = decks[i]
      const b = decks[j]
      if (!a || !b) continue
      const touchingHorizontally =
        Math.abs(a.y + a.h - b.y) <= tol || Math.abs(b.y + b.h - a.y) <= tol
      const touchingVertically =
        Math.abs(a.x + a.w - b.x) <= tol || Math.abs(b.x + b.w - a.x) <= tol
      if (touchingHorizontally) {
        meters += overlapLength(a.x, a.x + a.w, b.x, b.x + b.w)
      } else if (touchingVertically) {
        meters += overlapLength(a.y, a.y + a.h, b.y, b.y + b.h)
      }
    }
  }
  return round2(meters)
}

/**
 * Zbiegi narożników podestów. Dwa spotykające się narożniki wymagają klamry
 * podwójnej, trzy lub cztery — poczwórnej.
 */
export function computeStageJunctions(decks: StageRect[]): { dual: number; quad: number } {
  const counts = new Map<string, number>()
  const bump = (x: number, y: number) => {
    const key = `${roundM(x)},${roundM(y)}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const d of decks) {
    bump(d.x, d.y)
    bump(d.x + d.w, d.y)
    bump(d.x, d.y + d.h)
    bump(d.x + d.w, d.y + d.h)
  }
  let dual = 0
  let quad = 0
  for (const count of counts.values()) {
    if (count === 2) dual += 1
    else if (count >= 3) quad += 1
  }
  return { dual, quad }
}

function rectsTouch(a: StageRect, b: StageRect, tol: number): boolean {
  const horizontally =
    (Math.abs(a.y + a.h - b.y) <= tol || Math.abs(b.y + b.h - a.y) <= tol) &&
    overlapLength(a.x, a.x + a.w, b.x, b.x + b.w) > tol
  const vertically =
    (Math.abs(a.x + a.w - b.x) <= tol || Math.abs(b.x + b.w - a.x) <= tol) &&
    overlapLength(a.y, a.y + a.h, b.y, b.y + b.h) > tol
  return horizontally || vertically
}

function rectsOverlap(a: StageRect, b: StageRect, tol: number): boolean {
  return (
    overlapLength(a.x, a.x + a.w, b.x, b.x + b.w) > tol &&
    overlapLength(a.y, a.y + a.h, b.y, b.y + b.h) > tol
  )
}

function rectsNearMiss(a: StageRect, b: StageRect, tol: number): boolean {
  const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w))
  const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h))
  const alignedX = overlapLength(a.x, a.x + a.w, b.x, b.x + b.w) > tol
  const alignedY = overlapLength(a.y, a.y + a.h, b.y, b.y + b.h) > tol
  if (alignedX && gapY > tol && gapY <= STAGE_GAP_WARN_M) return true
  if (alignedY && gapX > tol && gapX <= STAGE_GAP_WARN_M) return true
  return false
}

/** Wykrywanie układów, których nie da się zbudować w magazynie. */
export function analyzeStageLayout(decks: StageRect[], tol = STAGE_TOL_M): StageLayoutIssues {
  let overlaps = 0
  let nearMisses = 0
  const parent = decks.map((_, index) => index)
  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) root = parent[root] as number
    return root
  }
  const union = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  for (let i = 0; i < decks.length; i += 1) {
    for (let j = i + 1; j < decks.length; j += 1) {
      const a = decks[i]
      const b = decks[j]
      if (!a || !b) continue
      if (rectsOverlap(a, b, tol)) overlaps += 1
      if (rectsTouch(a, b, tol)) union(i, j)
      else if (rectsNearMiss(a, b, tol)) nearMisses += 1
    }
  }

  const roots = new Set<number>()
  for (let i = 0; i < decks.length; i += 1) roots.add(find(i))

  return { overlaps, islands: roots.size, nearMisses }
}

/** Czy odcinek [from, from + length] leży na którejś krawędzi konturu danej strony. */
export function findEdgeCovering(
  edges: StageEdge[],
  side: StageEdgeSide,
  at: number,
  from: number,
  length: number,
  tol = STAGE_TOL_M
): StageEdge | null {
  const horizontal = side === 'front' || side === 'back'
  for (const edge of edges) {
    if (edge.side !== side) continue
    const edgeAt = horizontal ? edge.y1 : edge.x1
    if (Math.abs(edgeAt - at) > tol) continue
    const start = horizontal ? edge.x1 : edge.y1
    const end = horizontal ? edge.x2 : edge.y2
    if (from >= start - tol && from + length <= end + tol) return edge
  }
  return null
}
