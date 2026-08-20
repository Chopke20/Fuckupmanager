export const STAGE_PLAN_LINE_MARKER = '[plan sceny]'

export const STAGE_LEG_HEIGHTS_CM = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200] as const

export type StageDeckKind = '2x1' | '1x1'
export type StageOrientation = 'auto' | 'long-along-front' | 'long-along-depth'
export type StageCladdingMaterial = 'none' | 'skirt' | 'hard'
export type StageCladdingSides = 'front' | 'front-sides' | 'all'
export type StageLegShare = 'per-deck' | 'shared-corners'

export interface StageTile {
  x: number
  y: number
  w: number
  h: number
  kind: StageDeckKind
}

export interface StageBomLine {
  key: string
  name: string
  quantity: number
  unit: 'szt.' | 'mb'
  group: 'decks' | 'legs' | 'clamps' | 'cladding' | 'accessories'
  offer: boolean
}

export interface StagePlanInput {
  widthM: number
  depthM: number
  orientation: StageOrientation
  claddingMaterial: StageCladdingMaterial
  claddingSides: StageCladdingSides
  legHeightCm: number
  legShare: StageLegShare
  includeStairs: boolean
  includeRailings: boolean
}

export interface StagePlan {
  version: 1
  requestedWidthM: number
  requestedDepthM: number
  widthM: number
  depthM: number
  orientationUsed: Exclude<StageOrientation, 'auto'>
  tiles: StageTile[]
  claddingMaterial: StageCladdingMaterial
  claddingSides: StageCladdingSides
  claddingMeters: number
  legHeightCm: number
  legShare: StageLegShare
  includeStairs: boolean
  includeRailings: boolean
  counts: {
    decks2x1: number
    decks1x1: number
    decksTotal: number
    legs: number
    deckClamps: number
    dualLegClamps: number
    quadLegClamps: number
    braces: number
    stairs: number
    railingMeters: number
  }
  notes: string[]
  bom: StageBomLine[]
}

function ceilPositiveMeters(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.max(1, Math.ceil(value - 1e-9))
}

export function packStageTiles(
  widthM: number,
  depthM: number,
  longAlongFront: boolean
): StageTile[] {
  const tiles: StageTile[] = []
  if (widthM < 1 || depthM < 1) return tiles

  if (longAlongFront) {
    const pairs = Math.floor(widthM / 2)
    const odd = widthM % 2 === 1
    for (let y = 0; y < depthM; y += 1) {
      for (let i = 0; i < pairs; i += 1) {
        tiles.push({ x: i * 2, y, w: 2, h: 1, kind: '2x1' })
      }
      if (odd) tiles.push({ x: pairs * 2, y, w: 1, h: 1, kind: '1x1' })
    }
    return tiles
  }

  const pairs = Math.floor(depthM / 2)
  const odd = depthM % 2 === 1
  for (let x = 0; x < widthM; x += 1) {
    for (let i = 0; i < pairs; i += 1) {
      tiles.push({ x, y: i * 2, w: 1, h: 2, kind: '2x1' })
    }
    if (odd) tiles.push({ x, y: pairs * 2, w: 1, h: 1, kind: '1x1' })
  }
  return tiles
}

function tileScore(tiles: StageTile[]) {
  const decks1x1 = tiles.filter((t) => t.kind === '1x1').length
  const decks2x1 = tiles.filter((t) => t.kind === '2x1').length
  return { decks1x1, decks2x1, total: decks1x1 + decks2x1 }
}

function pickOrientation(
  widthM: number,
  depthM: number,
  orientation: StageOrientation
): Exclude<StageOrientation, 'auto'> {
  if (orientation === 'long-along-front' || orientation === 'long-along-depth') return orientation
  const alongFront = packStageTiles(widthM, depthM, true)
  const alongDepth = packStageTiles(widthM, depthM, false)
  const a = tileScore(alongFront)
  const b = tileScore(alongDepth)
  if (a.decks1x1 !== b.decks1x1) return a.decks1x1 < b.decks1x1 ? 'long-along-front' : 'long-along-depth'
  if (a.total !== b.total) return a.total < b.total ? 'long-along-front' : 'long-along-depth'
  return 'long-along-front'
}

function sharedEdgeMeters(tiles: StageTile[]): number {
  let meters = 0
  for (let i = 0; i < tiles.length; i += 1) {
    for (let j = i + 1; j < tiles.length; j += 1) {
      const a = tiles[i]!
      const b = tiles[j]!
      const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
      const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
      const touchingY = a.y + a.h === b.y || b.y + b.h === a.y
      const touchingX = a.x + a.w === b.x || b.x + b.w === a.x
      if (touchingY && overlapX > 0) meters += overlapX
      else if (touchingX && overlapY > 0) meters += overlapY
    }
  }
  return meters
}

function uniqueCorners(tiles: StageTile[]): number {
  const set = new Set<string>()
  for (const tile of tiles) {
    set.add(`${tile.x},${tile.y}`)
    set.add(`${tile.x + tile.w},${tile.y}`)
    set.add(`${tile.x},${tile.y + tile.h}`)
    set.add(`${tile.x + tile.w},${tile.y + tile.h}`)
  }
  return set.size
}

function junctionCounts(tiles: StageTile[]): { dual: number; quad: number } {
  const vertex = new Map<string, number>()
  const bump = (x: number, y: number) => {
    const key = `${x},${y}`
    vertex.set(key, (vertex.get(key) ?? 0) + 1)
  }
  for (const tile of tiles) {
    bump(tile.x, tile.y)
    bump(tile.x + tile.w, tile.y)
    bump(tile.x, tile.y + tile.h)
    bump(tile.x + tile.w, tile.y + tile.h)
  }
  let dual = 0
  let quad = 0
  for (const count of vertex.values()) {
    if (count === 2) dual += 1
    if (count === 4) quad += 1
  }
  return { dual, quad }
}

function claddingMeters(widthM: number, depthM: number, sides: StageCladdingSides): number {
  if (sides === 'front') return widthM
  if (sides === 'front-sides') return widthM + 2 * depthM
  return 2 * (widthM + depthM)
}

function railingMeters(widthM: number, depthM: number): number {
  return widthM + 2 * depthM
}

function pushBom(bom: StageBomLine[], line: StageBomLine) {
  if (line.quantity > 0) bom.push(line)
}

export function buildStagePlan(input: StagePlanInput): StagePlan | { ok: false; error: string } {
  const requestedWidthM = Number(input.widthM)
  const requestedDepthM = Number(input.depthM)
  if (!Number.isFinite(requestedWidthM) || requestedWidthM <= 0) {
    return { ok: false, error: 'Szerokość sceny (front) musi być większa od zera.' }
  }
  if (!Number.isFinite(requestedDepthM) || requestedDepthM <= 0) {
    return { ok: false, error: 'Głębokość sceny musi być większa od zera.' }
  }
  if (requestedWidthM > 40 || requestedDepthM > 40) {
    return { ok: false, error: 'Wymiar sceny jest za duży (max 40 m).' }
  }

  const widthM = ceilPositiveMeters(requestedWidthM)
  const depthM = ceilPositiveMeters(requestedDepthM)
  const orientationUsed = pickOrientation(widthM, depthM, input.orientation)
  const tiles = packStageTiles(widthM, depthM, orientationUsed === 'long-along-front')
  const score = tileScore(tiles)
  const shared = sharedEdgeMeters(tiles)
  const corners = uniqueCorners(tiles)
  const junctions = junctionCounts(tiles)
  const legs = input.legShare === 'shared-corners' ? corners : score.total * 4
  const deckClamps = shared
  const height = Math.round(input.legHeightCm)
  const clampRows = height > 100 ? 2 : 1
  const dualLegClamps = height >= 60 ? junctions.dual * clampRows : 0
  const quadLegClamps = height >= 60 ? junctions.quad * clampRows : 0
  const braces = height >= 168 ? Math.max(0, (widthM - 1) * (depthM - 1)) : 0
  const claddingM =
    input.claddingMaterial === 'none' ? 0 : claddingMeters(widthM, depthM, input.claddingSides)
  const stairs = input.includeStairs && height >= 40 ? 1 : 0
  const railM = input.includeRailings && height >= 40 ? railingMeters(widthM, depthM) : 0

  const notes: string[] = []
  if (widthM !== requestedWidthM || depthM !== requestedDepthM) {
    notes.push(
      `Podane ${formatMeters(requestedWidthM)} × ${formatMeters(requestedDepthM)} m zaokrąglone w górę do siatki 1 m: ${widthM} × ${depthM} m.`
    )
  }
  notes.push(
    orientationUsed === 'long-along-front'
      ? 'Układ: dłuższy bok podestu 2×1 wzdłuż frontu (publiczność).'
      : 'Układ: dłuższy bok podestu 2×1 w głąb sceny.'
  )
  notes.push(
    input.legShare === 'per-deck'
      ? 'Nogi: 4 na każdy podest (typowa kompletacja magazynowa).'
      : 'Nogi: współdzielone w narożnikach siatki (mniej sztuk, inna kompletacja).'
  )
  if (height >= 60) {
    notes.push('Powyżej 60 cm wysokości: klamry nóg obowiązkowe (stężenie).')
  }
  if (height > 100) {
    notes.push('Powyżej 100 cm: druga linia klamer nóg (ok. 1/3 i 2/3 wysokości).')
  }
  if (height >= 168) {
    notes.push('Od 168 cm: dodatkowe stężenia poziome i ukośne.')
  }
  if (stairs) {
    notes.push(`Schody dobrane do wysokości ${height} cm (stopnie ~20 cm).`)
  }

  const bom: StageBomLine[] = []
  pushBom(bom, {
    key: 'deck-2x1',
    name: 'Podest sceniczny 2×1 m',
    quantity: score.decks2x1,
    unit: 'szt.',
    group: 'decks',
    offer: true,
  })
  pushBom(bom, {
    key: 'deck-1x1',
    name: 'Podest sceniczny 1×1 m',
    quantity: score.decks1x1,
    unit: 'szt.',
    group: 'decks',
    offer: true,
  })
  pushBom(bom, {
    key: 'legs',
    name: `Nogi do podestów ${height} cm`,
    quantity: legs,
    unit: 'szt.',
    group: 'legs',
    offer: true,
  })
  pushBom(bom, {
    key: 'deck-clamps',
    name: 'Klamry / szybkozłączki blatów',
    quantity: deckClamps,
    unit: 'szt.',
    group: 'clamps',
    offer: false,
  })
  pushBom(bom, {
    key: 'dual-leg-clamps',
    name: 'Klamry nóg podwójne',
    quantity: dualLegClamps,
    unit: 'szt.',
    group: 'clamps',
    offer: false,
  })
  pushBom(bom, {
    key: 'quad-leg-clamps',
    name: 'Klamry nóg poczwórne',
    quantity: quadLegClamps,
    unit: 'szt.',
    group: 'clamps',
    offer: false,
  })
  pushBom(bom, {
    key: 'braces',
    name: 'Stężenia ukośne / poziome',
    quantity: braces,
    unit: 'szt.',
    group: 'clamps',
    offer: false,
  })
  if (input.claddingMaterial === 'skirt') {
    pushBom(bom, {
      key: 'cladding',
      name: `Obicie — kotara / falbana (${claddingSidesLabel(input.claddingSides)})`,
      quantity: claddingM,
      unit: 'mb',
      group: 'cladding',
      offer: true,
    })
  }
  if (input.claddingMaterial === 'hard') {
    pushBom(bom, {
      key: 'cladding',
      name: `Obicie — blendy sklejka (${claddingSidesLabel(input.claddingSides)}, h=${height} cm)`,
      quantity: claddingM,
      unit: 'mb',
      group: 'cladding',
      offer: true,
    })
  }
  pushBom(bom, {
    key: 'stairs',
    name: `Schody na scenę (do ${height} cm)`,
    quantity: stairs,
    unit: 'szt.',
    group: 'accessories',
    offer: true,
  })
  pushBom(bom, {
    key: 'railings',
    name: 'Barierki (tył + boki)',
    quantity: railM,
    unit: 'mb',
    group: 'accessories',
    offer: true,
  })

  return {
    version: 1,
    requestedWidthM,
    requestedDepthM,
    widthM,
    depthM,
    orientationUsed,
    tiles,
    claddingMaterial: input.claddingMaterial,
    claddingSides: input.claddingSides,
    claddingMeters: claddingM,
    legHeightCm: height,
    legShare: input.legShare,
    includeStairs: input.includeStairs,
    includeRailings: input.includeRailings,
    counts: {
      decks2x1: score.decks2x1,
      decks1x1: score.decks1x1,
      decksTotal: score.total,
      legs,
      deckClamps,
      dualLegClamps,
      quadLegClamps,
      braces,
      stairs,
      railingMeters: railM,
    },
    notes,
    bom,
  }
}

export function isStagePlan(value: unknown): value is StagePlan {
  if (!value || typeof value !== 'object') return false
  const v = value as StagePlan
  return v.version === 1 && Array.isArray(v.tiles) && Array.isArray(v.bom)
}

export function parseStagePlanJson(raw: string | null | undefined): StagePlan | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    return isStagePlan(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function formatMeters(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? String(value) : value.toLocaleString('pl-PL', { maximumFractionDigits: 2 })
}

export function claddingSidesLabel(sides: StageCladdingSides): string {
  if (sides === 'front') return 'tylko front'
  if (sides === 'front-sides') return 'front + boki'
  return 'cały obwód'
}

export function claddingMaterialLabel(material: StageCladdingMaterial): string {
  if (material === 'skirt') return 'Kotara / falbana'
  if (material === 'hard') return 'Blendy sklejka'
  return 'Bez obicia'
}

/** SVG rzutu z góry. y rośnie w głąb sceny; front (publiczność) na dole. */
export function renderStagePlanSvg(plan: StagePlan, opts?: { widthPx?: number }): string {
  const pad = 36
  const labelH = 22
  const widthPx = opts?.widthPx ?? 560
  const innerW = widthPx - pad * 2
  const scale = innerW / plan.widthM
  const innerH = plan.depthM * scale
  const heightPx = innerH + pad * 2 + labelH
  const toX = (m: number) => pad + m * scale
  const toY = (m: number) => pad + (plan.depthM - m) * scale

  const tiles = plan.tiles
    .map((tile) => {
      const x = toX(tile.x)
      const y = toY(tile.y + tile.h)
      const w = tile.w * scale
      const h = tile.h * scale
      const fill = tile.kind === '2x1' ? '#d7efe0' : '#e8e4d4'
      const stroke = tile.kind === '2x1' ? '#1f6b45' : '#6b5d2a'
      const label = tile.kind === '2x1' ? '2×1' : '1×1'
      const fs = Math.max(9, Math.min(13, Math.min(w, h) * 0.28))
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>
        <text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2 + fs * 0.35).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(0)}" font-family="Arial, sans-serif" fill="#222">${label}</text>`
    })
    .join('\n')

  const dim = `${plan.widthM} × ${plan.depthM} m`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}">
    <rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="#f7f7f4"/>
    ${tiles}
    <text x="${widthPx / 2}" y="${pad + innerH + 18}" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" fill="#444">FRONT / PUBLICZNOŚĆ · ${dim}</text>
  </svg>`
}
