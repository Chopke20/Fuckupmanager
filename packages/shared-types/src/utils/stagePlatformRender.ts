/**
 * Rysunek planu sceny.
 *
 * Ten sam plan trafia na ekran w aplikacji (ciemny motyw, kolor firmowy) i na
 * wydruk PDF (jasny motyw), dlatego kolory są zdefiniowane w jednym miejscu i
 * wybierane parametrem. Funkcje geometrii rysunku (siatka, nogi, barierki,
 * schody) są wspólne dla renderera tekstowego i dla interaktywnego płótna w
 * React — płótno nie może korzystać ze stringa, ale liczy to samo.
 */

import { STAGE_TOL_M, subtractIntervals, type StageEdge } from './stagePlatformGeometry'
import {
  STAGE_STEP_TREAD_M,
  edgeSelectionLabel,
  formatMeters,
  selectedEdges,
  stageStairDepthM,
  stageStairSteps,
  type StagePlan,
  type StageStair,
} from './stagePlatformPlan'

export type StagePlanTheme = 'dark' | 'print'

export interface StagePalette {
  bg: string
  grid: string
  deckFill: string
  deckAltFill: string
  deckStroke: string
  cladding: string
  outlineIdle: string
  railing: string
  leg: string
  stairFill: string
  stairStroke: string
  text: string
  textDim: string
  danger: string
}

/**
 * Ciemna paleta bierze akcent z tokenu firmowego `--primary`, więc rysunek
 * podąża za kolorem firmy tak jak reszta aplikacji. W PDF zmiennych CSS nie
 * ma, dlatego wydruk ma własne, jawne kolory.
 *
 * Uwaga: `var()` nie działa w atrybutach prezentacyjnych SVG (`stroke="…"`),
 * tylko w deklaracji `style`. Dlatego kolor akcentu jest zawsze podawany
 * stylem — i renderer tekstowy, i płótno w React robią to tak samo.
 */
export const STAGE_PALETTES: Record<StagePlanTheme, StagePalette> = {
  dark: {
    bg: '#141414',
    grid: '#242424',
    deckFill: '#1f1f1f',
    deckAltFill: '#2a2a2a',
    deckStroke: '#3d3d3d',
    cladding: 'hsl(var(--primary, 145 100% 50%))',
    outlineIdle: '#4d4d4d',
    railing: '#9a9a9a',
    leg: '#5f5f5f',
    stairFill: '#262626',
    stairStroke: '#4d4d4d',
    text: '#e5e5e5',
    textDim: '#8a8a8a',
    danger: '#ff3333',
  },
  print: {
    bg: '#ffffff',
    grid: '#ededed',
    deckFill: '#f6f6f6',
    deckAltFill: '#eeece2',
    deckStroke: '#9a9a9a',
    cladding: '#1a1a1a',
    outlineIdle: '#c9c9c9',
    railing: '#555555',
    leg: '#a8a8a8',
    stairFill: '#f0f0f0',
    stairStroke: '#8a8a8a',
    text: '#222222',
    textDim: '#666666',
    danger: '#a83232',
  },
}

export const STAGE_RAILING_OFFSET_M = 0.14
export const STAGE_LEG_INSET_M = 0.09

export interface StageViewport {
  widthPx: number
  heightPx: number
  labelHeightPx: number
  pad: number
  scale: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  /** Metry → piksele w osi poziomej. */
  toX: (m: number) => number
  /** Metry → piksele w osi pionowej (front na dole rysunku). */
  toY: (m: number) => number
  /** Piksele → metry w osi poziomej. */
  fromX: (px: number) => number
  /** Piksele → metry w osi pionowej. */
  fromY: (px: number) => number
}

interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Obszar rysunku obejmuje podesty razem z wysięgiem schodów i pasem na
 * barierki, żeby nic nie wychodziło poza kadr.
 */
export function stagePlanViewport(
  plan: StagePlan,
  opts?: { widthPx?: number; pad?: number; minSpanM?: number }
): StageViewport {
  const pad = opts?.pad ?? 34
  const widthPx = opts?.widthPx ?? 640
  const labelHeightPx = 20
  const minSpan = opts?.minSpanM ?? 4

  let minX = 0
  let minY = 0
  let maxX = minSpan
  let maxY = minSpan

  if (plan.decks.length > 0) {
    minX = Infinity
    minY = Infinity
    maxX = -Infinity
    maxY = -Infinity
    for (const deck of plan.decks) {
      minX = Math.min(minX, deck.x)
      minY = Math.min(minY, deck.y)
      maxX = Math.max(maxX, deck.x + deck.w)
      maxY = Math.max(maxY, deck.y + deck.h)
    }
  }

  const stairDepth = stageStairDepthM(plan.legHeightCm)
  for (const stair of plan.stairs) {
    if (stair.side === 'front') minY = Math.min(minY, stair.atM - stairDepth)
    if (stair.side === 'back') maxY = Math.max(maxY, stair.atM + stairDepth)
    if (stair.side === 'left') minX = Math.min(minX, stair.atM - stairDepth)
    if (stair.side === 'right') maxX = Math.max(maxX, stair.atM + stairDepth)
  }

  const margin = 0.3
  minX -= margin
  minY -= margin
  maxX += margin
  maxY += margin

  if (maxX - minX < minSpan) maxX = minX + minSpan
  if (maxY - minY < minSpan) maxY = minY + minSpan

  const scale = (widthPx - pad * 2) / (maxX - minX)
  const heightPx = pad * 2 + (maxY - minY) * scale + labelHeightPx

  return {
    widthPx,
    heightPx,
    labelHeightPx,
    pad,
    scale,
    minX,
    minY,
    maxX,
    maxY,
    toX: (m: number) => pad + (m - minX) * scale,
    toY: (m: number) => pad + (maxY - m) * scale,
    fromX: (px: number) => (px - pad) / scale + minX,
    fromY: (px: number) => maxY - (px - pad) / scale,
  }
}

/** Linie siatki w metrach, dociągnięte do kroku planu. */
export function stageGridLines(viewport: StageViewport, stepM: number): Segment[] {
  const step = Number.isFinite(stepM) && stepM > 0 ? stepM : 1
  // Przy drobnym kroku i dużej scenie rysowanie każdej linii zabija czytelność.
  const effective = (viewport.maxX - viewport.minX) / step > 80 ? step * 4 : step
  const lines: Segment[] = []
  // Twardy limit chroni przed zawieszeniem rysunku, gdyby plan miał
  // absurdalne współrzędne po ręcznej edycji JSON-a.
  const limit = 400
  const startX = Math.ceil(viewport.minX / effective) * effective
  for (let x = startX; x <= viewport.maxX && lines.length < limit; x += effective) {
    lines.push({ x1: x, y1: viewport.minY, x2: x, y2: viewport.maxY })
  }
  const startY = Math.ceil(viewport.minY / effective) * effective
  for (let y = startY; y <= viewport.maxY && lines.length < limit * 2; y += effective) {
    lines.push({ x1: viewport.minX, y1: y, x2: viewport.maxX, y2: y })
  }
  return lines
}

/** Nogi: cztery na każdy podest, wsunięte od narożnika, nigdy współdzielone. */
export function stageLegDots(plan: StagePlan): Array<{ x: number; y: number }> {
  const inset = STAGE_LEG_INSET_M
  return plan.decks.flatMap((deck) => [
    { x: deck.x + inset, y: deck.y + inset },
    { x: deck.x + deck.w - inset, y: deck.y + inset },
    { x: deck.x + inset, y: deck.y + deck.h - inset },
    { x: deck.x + deck.w - inset, y: deck.y + deck.h - inset },
  ])
}

function outwardOffset(side: StageEdge['side'], distance: number): { dx: number; dy: number } {
  if (side === 'front') return { dx: 0, dy: -distance }
  if (side === 'back') return { dx: 0, dy: distance }
  if (side === 'left') return { dx: -distance, dy: 0 }
  return { dx: distance, dy: 0 }
}

/**
 * Odcinki barierek: zaznaczone krawędzie odsunięte na zewnątrz konturu,
 * z przerwami w miejscach, gdzie stoją schody.
 */
export function stageRailingSegments(plan: StagePlan): Segment[] {
  const segments: Segment[] = []
  for (const edge of selectedEdges(plan.railings, plan.edges)) {
    const horizontal = edge.side === 'front' || edge.side === 'back'
    const at = horizontal ? edge.y1 : edge.x1
    const start = horizontal ? edge.x1 : edge.y1
    const end = horizontal ? edge.x2 : edge.y2
    const cuts = plan.stairs
      .filter(
        (stair) => stair.side === edge.side && Math.abs(stair.atM - at) <= STAGE_TOL_M
      )
      .map((stair): [number, number] => [stair.posM, stair.posM + stair.widthM])
    const { dx, dy } = outwardOffset(edge.side, STAGE_RAILING_OFFSET_M)
    for (const [from, to] of subtractIntervals([start, end], cuts)) {
      segments.push(
        horizontal
          ? { x1: from + dx, y1: at + dy, x2: to + dx, y2: at + dy }
          : { x1: at + dx, y1: from + dy, x2: at + dx, y2: to + dy }
      )
    }
  }
  return segments
}

export interface StageStairShape {
  rect: Rect
  steps: Segment[]
}

/** Bieg schodów jako prostokąt wychodzący poza kontur plus linie stopni. */
export function stageStairShape(stair: StageStair, legHeightCm: number): StageStairShape {
  const depth = stageStairDepthM(legHeightCm)
  const count = stageStairSteps(legHeightCm)
  const steps: Segment[] = []

  if (stair.side === 'front' || stair.side === 'back') {
    const outward = stair.side === 'front' ? -1 : 1
    const y = stair.side === 'front' ? stair.atM - depth : stair.atM
    for (let i = 1; i < count; i += 1) {
      const at = stair.atM + outward * i * STAGE_STEP_TREAD_M
      steps.push({ x1: stair.posM, y1: at, x2: stair.posM + stair.widthM, y2: at })
    }
    return { rect: { x: stair.posM, y, w: stair.widthM, h: depth }, steps }
  }

  const outward = stair.side === 'left' ? -1 : 1
  const x = stair.side === 'left' ? stair.atM - depth : stair.atM
  for (let i = 1; i < count; i += 1) {
    const at = stair.atM + outward * i * STAGE_STEP_TREAD_M
    steps.push({ x1: at, y1: stair.posM, x2: at, y2: stair.posM + stair.widthM })
  }
  return { rect: { x, y: stair.posM, w: depth, h: stair.widthM }, steps }
}

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fixed(value: number): string {
  return value.toFixed(1)
}

/**
 * Rzut z góry jako string SVG — używany w PDF i w podglądzie dokumentu.
 * Edytor renderuje własne elementy React, bo na stringu nie da się przeciągać.
 */
export function renderStagePlanSvg(
  plan: StagePlan,
  opts?: { widthPx?: number; theme?: StagePlanTheme }
): string {
  const theme = opts?.theme ?? 'dark'
  const palette = STAGE_PALETTES[theme]
  const viewport = stagePlanViewport(plan, { widthPx: opts?.widthPx ?? 640 })
  const { toX, toY } = viewport

  const grid = stageGridLines(viewport, plan.snapToGrid ? plan.gridStepM : 1)
    .map(
      (line) =>
        `<line x1="${fixed(toX(line.x1))}" y1="${fixed(toY(line.y1))}" x2="${fixed(toX(line.x2))}" y2="${fixed(toY(line.y2))}" stroke="${palette.grid}" stroke-width="1"/>`
    )
    .join('')

  const decks = plan.decks
    .map((deck) => {
      const w = deck.w * viewport.scale
      const h = deck.h * viewport.scale
      const x = toX(deck.x)
      const y = toY(deck.y + deck.h)
      const fill = deck.kind === '2x1' ? palette.deckFill : palette.deckAltFill
      const fontSize = Math.max(8, Math.min(13, Math.min(w, h) * 0.26))
      const label =
        Math.min(w, h) < 18
          ? ''
          : `<text x="${fixed(x + w / 2)}" y="${fixed(y + h / 2 + fontSize * 0.35)}" text-anchor="middle" font-size="${fontSize.toFixed(0)}" font-family="Arial, sans-serif" fill="${palette.textDim}">${deck.kind === '2x1' ? '2×1' : '1×1'}</text>`
      return `<rect x="${fixed(x)}" y="${fixed(y)}" width="${fixed(w)}" height="${fixed(h)}" fill="${fill}" stroke="${palette.deckStroke}" stroke-width="1.1"/>${label}`
    })
    .join('')

  const legRadius = Math.max(1.4, Math.min(2.6, viewport.scale * 0.045))
  const legs = stageLegDots(plan)
    .map(
      (dot) =>
        `<circle cx="${fixed(toX(dot.x))}" cy="${fixed(toY(dot.y))}" r="${legRadius.toFixed(1)}" fill="${palette.leg}"/>`
    )
    .join('')

  const claddingActive = plan.claddingMaterial !== 'none'
  const claddingKeys = new Set(
    claddingActive ? selectedEdges(plan.cladding, plan.edges).map((edge) => edge.key) : []
  )
  const outline = plan.edges
    .map((edge) => {
      const clad = claddingKeys.has(edge.key)
      return `<line x1="${fixed(toX(edge.x1))}" y1="${fixed(toY(edge.y1))}" x2="${fixed(toX(edge.x2))}" y2="${fixed(toY(edge.y2))}" style="stroke:${clad ? palette.cladding : palette.outlineIdle}" stroke-width="${clad ? 3 : 1.4}" stroke-linecap="square"/>`
    })
    .join('')

  const railings = stageRailingSegments(plan)
    .map(
      (segment) =>
        `<line x1="${fixed(toX(segment.x1))}" y1="${fixed(toY(segment.y1))}" x2="${fixed(toX(segment.x2))}" y2="${fixed(toY(segment.y2))}" stroke="${palette.railing}" stroke-width="1.7" stroke-dasharray="5 3"/>`
    )
    .join('')

  const stairs = plan.stairs
    .map((stair) => {
      const shape = stageStairShape(stair, plan.legHeightCm)
      const rect = `<rect x="${fixed(toX(shape.rect.x))}" y="${fixed(toY(shape.rect.y + shape.rect.h))}" width="${fixed(shape.rect.w * viewport.scale)}" height="${fixed(shape.rect.h * viewport.scale)}" fill="${palette.stairFill}" stroke="${palette.stairStroke}" stroke-width="1"/>`
      const steps = shape.steps
        .map(
          (step) =>
            `<line x1="${fixed(toX(step.x1))}" y1="${fixed(toY(step.y1))}" x2="${fixed(toX(step.x2))}" y2="${fixed(toY(step.y2))}" stroke="${palette.stairStroke}" stroke-width="1"/>`
        )
        .join('')
      return rect + steps
    })
    .join('')

  const summary = [
    plan.decks.length > 0 ? `${plan.widthM} × ${plan.depthM} m` : 'brak podestów',
    plan.areaM2 > 0 ? `${formatMeters(plan.areaM2)} m²` : '',
    `nogi ${plan.legHeightCm} cm`,
    plan.claddingMb > 0
      ? `obicie ${formatMeters(plan.claddingMb)} mb / ${formatMeters(plan.claddingM2)} m²`
      : '',
    plan.railingMb > 0 ? `barierki ${formatMeters(plan.railingMb)} mb` : '',
    plan.stairs.length > 0 ? `schody ${plan.stairs.length}×` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const caption = `FRONT / PUBLICZNOŚĆ · ${summary}`
  const captionY = viewport.heightPx - 7

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fixed(viewport.widthPx)} ${fixed(viewport.heightPx)}" width="${fixed(viewport.widthPx)}" height="${fixed(viewport.heightPx)}">
    <rect x="0" y="0" width="${fixed(viewport.widthPx)}" height="${fixed(viewport.heightPx)}" fill="${palette.bg}"/>
    ${grid}${decks}${legs}${outline}${railings}${stairs}
    <text x="${fixed(viewport.widthPx / 2)}" y="${fixed(captionY)}" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" fill="${palette.textDim}">${escapeXml(caption)}</text>
  </svg>`
}

/** Legenda rysunku — potrzebna głównie w PDF, gdzie nie ma panelu obok. */
export function stagePlanLegend(plan: StagePlan): Array<{ label: string; value: string }> {
  const legend: Array<{ label: string; value: string }> = [
    { label: 'Podesty', value: `${plan.counts.decksTotal} szt. (${plan.counts.decks2x1}× 2×1, ${plan.counts.decks1x1}× 1×1)` },
    { label: 'Nogi', value: `${plan.counts.legs} szt. · ${plan.legHeightCm} cm` },
    { label: 'Powierzchnia', value: `${formatMeters(plan.areaM2)} m²` },
  ]
  if (plan.claddingMb > 0) {
    legend.push({
      label: 'Obicie',
      value: `${formatMeters(plan.claddingMb)} mb / ${formatMeters(plan.claddingM2)} m² · ${edgeSelectionLabel(plan.cladding, plan.edges)}`,
    })
  }
  if (plan.floorMaterial !== 'none') {
    legend.push({ label: 'Podłoga', value: `${formatMeters(plan.areaM2)} m²` })
  }
  if (plan.stairs.length > 0) {
    legend.push({
      label: 'Schody',
      value: `${plan.stairs.length} × ${plan.counts.stepsPerStair} stopni`,
    })
  }
  if (plan.railingMb > 0) {
    legend.push({
      label: 'Barierki',
      value: `${formatMeters(plan.railingMb)} mb · ${edgeSelectionLabel(plan.railings, plan.edges)}`,
    })
  }
  return legend
}
