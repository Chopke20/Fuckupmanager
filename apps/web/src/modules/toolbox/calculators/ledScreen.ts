/**
 * Kalkulator ekranu LED — siatka kabinetów, piksele, proporcja i rozjazd vs cel.
 * Frontend-only; bez API / magazynu.
 */

export type LedAspectPresetId = '16:9' | '4:3' | '21:9' | '1:1' | 'custom'

export interface LedAspectPreset {
  id: LedAspectPresetId
  label: string
  /** Szerokość względem wysokości (np. 16/9). null = własna. */
  ratio: number | null
}

export const LED_ASPECT_PRESETS: LedAspectPreset[] = [
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '21:9', label: '21:9', ratio: 21 / 9 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: 'custom', label: 'Własna', ratio: null },
]

export interface LedCabinetPreset {
  id: string
  label: string
  widthMm: number
  heightMm: number
  pitchMm: number
}

/** Popularne szafy — tylko skróty; wszystko da się nadpisać ręcznie. */
export const LED_CABINET_PRESETS: LedCabinetPreset[] = [
  { id: '500x500-p2.6', label: '500×500 P2.6', widthMm: 500, heightMm: 500, pitchMm: 2.6 },
  { id: '500x500-p2.9', label: '500×500 P2.9', widthMm: 500, heightMm: 500, pitchMm: 2.97 },
  { id: '500x500-p3.9', label: '500×500 P3.9', widthMm: 500, heightMm: 500, pitchMm: 3.91 },
  { id: '500x1000-p2.6', label: '500×1000 P2.6', widthMm: 500, heightMm: 1000, pitchMm: 2.6 },
  { id: '500x1000-p2.9', label: '500×1000 P2.9', widthMm: 500, heightMm: 1000, pitchMm: 2.97 },
  { id: '640x480-p2.5', label: '640×480 P2.5', widthMm: 640, heightMm: 480, pitchMm: 2.5 },
]

export interface LedScreenInput {
  cabinetWidthMm: number
  cabinetHeightMm: number
  pitchMm: number
  /** Kolumny × wiersze — źródło prawdy dla wyniku. */
  columns: number
  rows: number
  /** Docelowa proporcja szer./wys. (np. 16/9). */
  targetRatio: number
}

export interface LedAspectDeviation {
  /** Faktyczna proporcja szer./wys. */
  actualRatio: number
  targetRatio: number
  /** |actual − target| / target · 100 */
  percent: number
  /** Ile mm dodać (+) / uciąć (−) na wysokości, żeby przy tej szerokości trafić w cel. */
  heightDeltaMm: number
  /** Ile mm dodać (+) / uciąć (−) na szerokości przy tej wysokości. */
  widthDeltaMm: number
  /** Najbliższy układ przy tej samej liczbie kolumn, bliżej proporcji. */
  betterSameColumns: { columns: number; rows: number; percent: number } | null
  /** Najbliższy układ przy tej samej liczbie wierszy. */
  betterSameRows: { columns: number; rows: number; percent: number } | null
}

export interface LedScreenResult {
  ok: true
  cabinetPxW: number
  cabinetPxH: number
  columns: number
  rows: number
  cabinetsTotal: number
  screenWidthMm: number
  screenHeightMm: number
  screenWidthM: number
  screenHeightM: number
  areaM2: number
  screenPxW: number
  screenPxH: number
  actualRatio: number
  aspectLabel: string
  deviation: LedAspectDeviation
}

export type LedScreenCalcResult =
  | LedScreenResult
  | { ok: false; error: string }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Piksele kabinetu: mm / pitch, zaokrąglenie do najbliższej całkowitej. */
export function cabinetPixels(sizeMm: number, pitchMm: number): number {
  if (!(sizeMm > 0) || !(pitchMm > 0)) return 0
  return Math.max(1, Math.round(sizeMm / pitchMm))
}

/** Uproszczona etykieta proporcji (np. 16:9, 1.78:1). */
export function formatAspectLabel(ratio: number): string {
  if (!(ratio > 0) || !Number.isFinite(ratio)) return '—'
  const known: Array<{ a: number; b: number; label: string }> = [
    { a: 16, b: 9, label: '16:9' },
    { a: 4, b: 3, label: '4:3' },
    { a: 21, b: 9, label: '21:9' },
    { a: 1, b: 1, label: '1:1' },
    { a: 3, b: 2, label: '3:2' },
    { a: 5, b: 4, label: '5:4' },
    { a: 32, b: 9, label: '32:9' },
  ]
  for (const k of known) {
    if (Math.abs(ratio - k.a / k.b) < 0.008) return k.label
  }
  return `${round3(ratio)}:1`
}

export function parseAspectRatio(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  if (!t) return null
  const colon = t.split(':')
  if (colon.length === 2) {
    const a = Number(colon[0])
    const b = Number(colon[1])
    if (a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b)) return a / b
    return null
  }
  const n = Number(t)
  return n > 0 && Number.isFinite(n) ? n : null
}

/**
 * Ile kabinetów potrzeba, żeby zbliżyć się do docelowego wymiaru w mm.
 * Zawsze ≥ 1 przy poprawnym kabinecie.
 */
export function snapCabinetsToMm(targetMm: number, cabinetMm: number): number {
  if (!(cabinetMm > 0) || !(targetMm > 0)) return 1
  return Math.max(1, Math.round(targetMm / cabinetMm))
}

function aspectPercent(actual: number, target: number): number {
  if (!(target > 0)) return 0
  return Math.abs(actual - target) / target * 100
}

function scoreLayout(
  columns: number,
  rows: number,
  cabW: number,
  cabH: number,
  targetRatio: number
): number {
  const w = columns * cabW
  const h = rows * cabH
  if (!(h > 0)) return Number.POSITIVE_INFINITY
  return aspectPercent(w / h, targetRatio)
}

function findBetterSameColumns(
  columns: number,
  rows: number,
  cabW: number,
  cabH: number,
  targetRatio: number
): { columns: number; rows: number; percent: number } | null {
  const current = scoreLayout(columns, rows, cabW, cabH, targetRatio)
  let bestRows = rows
  let bestScore = current
  const lo = Math.max(1, rows - 8)
  const hi = rows + 8
  for (let r = lo; r <= hi; r += 1) {
    if (r === rows) continue
    const s = scoreLayout(columns, r, cabW, cabH, targetRatio)
    if (s + 1e-9 < bestScore) {
      bestScore = s
      bestRows = r
    }
  }
  if (bestRows === rows) return null
  return { columns, rows: bestRows, percent: round2(bestScore) }
}

function findBetterSameRows(
  columns: number,
  rows: number,
  cabW: number,
  cabH: number,
  targetRatio: number
): { columns: number; rows: number; percent: number } | null {
  const current = scoreLayout(columns, rows, cabW, cabH, targetRatio)
  let bestCols = columns
  let bestScore = current
  const lo = Math.max(1, columns - 8)
  const hi = columns + 8
  for (let c = lo; c <= hi; c += 1) {
    if (c === columns) continue
    const s = scoreLayout(c, rows, cabW, cabH, targetRatio)
    if (s + 1e-9 < bestScore) {
      bestScore = s
      bestCols = c
    }
  }
  if (bestCols === columns) return null
  return { columns: bestCols, rows, percent: round2(bestScore) }
}

export function calculateLedScreen(input: LedScreenInput): LedScreenCalcResult {
  const {
    cabinetWidthMm,
    cabinetHeightMm,
    pitchMm,
    columns,
    rows,
    targetRatio,
  } = input

  if (!(cabinetWidthMm > 0) || !(cabinetHeightMm > 0)) {
    return { ok: false, error: 'Podaj wymiary kabinetu (mm).' }
  }
  if (!(pitchMm > 0)) {
    return { ok: false, error: 'Podaj pitch P (mm).' }
  }
  if (!(columns >= 1) || !(rows >= 1) || !Number.isFinite(columns) || !Number.isFinite(rows)) {
    return { ok: false, error: 'Liczba kabinetów musi być ≥ 1.' }
  }
  if (!(targetRatio > 0) || !Number.isFinite(targetRatio)) {
    return { ok: false, error: 'Nieprawidłowa proporcja docelowa.' }
  }

  const cols = Math.floor(columns)
  const rws = Math.floor(rows)
  const cabinetPxW = cabinetPixels(cabinetWidthMm, pitchMm)
  const cabinetPxH = cabinetPixels(cabinetHeightMm, pitchMm)
  const screenWidthMm = cols * cabinetWidthMm
  const screenHeightMm = rws * cabinetHeightMm
  const actualRatio = screenWidthMm / screenHeightMm
  const idealHeightMm = screenWidthMm / targetRatio
  const idealWidthMm = screenHeightMm * targetRatio

  const deviation: LedAspectDeviation = {
    actualRatio,
    targetRatio,
    percent: round2(aspectPercent(actualRatio, targetRatio)),
    heightDeltaMm: round2(idealHeightMm - screenHeightMm),
    widthDeltaMm: round2(idealWidthMm - screenWidthMm),
    betterSameColumns: findBetterSameColumns(cols, rws, cabinetWidthMm, cabinetHeightMm, targetRatio),
    betterSameRows: findBetterSameRows(cols, rws, cabinetWidthMm, cabinetHeightMm, targetRatio),
  }

  return {
    ok: true,
    cabinetPxW,
    cabinetPxH,
    columns: cols,
    rows: rws,
    cabinetsTotal: cols * rws,
    screenWidthMm,
    screenHeightMm,
    screenWidthM: round3(screenWidthMm / 1000),
    screenHeightM: round3(screenHeightMm / 1000),
    areaM2: round3((screenWidthMm / 1000) * (screenHeightMm / 1000)),
    screenPxW: cols * cabinetPxW,
    screenPxH: rws * cabinetPxH,
    actualRatio,
    aspectLabel: formatAspectLabel(actualRatio),
    deviation,
  }
}

/**
 * Z docelowych metrów → kolumny/wiersze (snap do siatki).
 * Zwraca też faktyczny rozmiar po snapie.
 */
export function metersToCabinetGrid(params: {
  targetWidthM: number
  targetHeightM: number
  cabinetWidthMm: number
  cabinetHeightMm: number
}): {
  columns: number
  rows: number
  actualWidthM: number
  actualHeightM: number
  widthDeltaM: number
  heightDeltaM: number
} {
  const columns = snapCabinetsToMm(params.targetWidthM * 1000, params.cabinetWidthMm)
  const rows = snapCabinetsToMm(params.targetHeightM * 1000, params.cabinetHeightMm)
  const actualWidthM = round3((columns * params.cabinetWidthMm) / 1000)
  const actualHeightM = round3((rows * params.cabinetHeightMm) / 1000)
  return {
    columns,
    rows,
    actualWidthM,
    actualHeightM,
    widthDeltaM: round3(actualWidthM - params.targetWidthM),
    heightDeltaM: round3(actualHeightM - params.targetHeightM),
  }
}

/** Jedna krawędź + proporcja → druga krawędź w metrach. */
export function otherSideFromAspect(params: {
  knownSideM: number
  /** 'width' = znamy szerokość, liczymy wysokość */
  known: 'width' | 'height'
  targetRatio: number
}): number {
  if (!(params.knownSideM > 0) || !(params.targetRatio > 0)) return 0
  if (params.known === 'width') return round3(params.knownSideM / params.targetRatio)
  return round3(params.knownSideM * params.targetRatio)
}

export function formatMm(mm: number): string {
  if (!Number.isFinite(mm)) return '—'
  const abs = Math.abs(mm)
  if (abs >= 1000) return `${round3(mm / 1000)} m`
  return `${round2(mm)} mm`
}

export function formatPx(n: number): string {
  return `${Math.round(n).toLocaleString('pl-PL')} px`
}
