/**
 * Profesjonalna pixel mapa LED (wzór diagnostyczny):
 * kolorowe kabinety, row/col, X + koła, nazwa, TL, wymiary, logo Lama.
 * Tryby: aktywny · wszystkie osobno · pełen canvas.
 */

import {
  LED_PIXEL_MAP_MAX_EDGE,
  calculateScreenFromSpec,
  type LedScreenResult,
  type LedScreenSpec,
} from './ledScreen'

export type LedPixelMapExportMode = 'active' | 'all-separate' | 'combined-canvas'

/** Domyślne logo na mapach (białe na ciemnym tle kabinetów). */
export const LED_PIXELMAP_DEFAULT_LOGO_URL = '/lama-logo-pixelmap.png'

export interface LedPixelMapOptions {
  projectName?: string
  /** URL logo. null = bez logo; undefined = domyślne Lama. */
  logoUrl?: string | null
  variant?: 'tech' | 'clean'
  /** Pozycja TL tego ekranu na łączonym canvasie (px). */
  canvasOriginPx?: { x: number; y: number }
}

/** Paleta kabinetów — sąsiednie komórki mają różne kolory (mapowanie / swapped tiles). */
const CABINET_PALETTE = [
  '#5c1a2e', // maroon
  '#1a3d3a', // teal dark
  '#2a1a4a', // purple
  '#1a2a4a', // navy
  '#3d3a1a', // olive
  '#1a4a2a', // forest
  '#4a2a1a', // brown
  '#1a4a4a', // cyan dark
  '#3a1a4a', // violet
  '#2a4a1a', // lime dark
  '#4a1a3a', // magenta dark
  '#1a3a4a', // steel
]

function cabinetColor(row: number, col: number): string {
  // Unika sąsiedztwa tego samego koloru w 4-kierunkach lepiej niż prosty (r+c)%n
  const idx = (row * 3 + col * 5) % CABINET_PALETTE.length
  return CABINET_PALETTE[idx]!
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function resolveLogo(options: LedPixelMapOptions): Promise<HTMLImageElement | null> {
  if (options.logoUrl === null) return null
  const url = options.logoUrl || LED_PIXELMAP_DEFAULT_LOGO_URL
  return loadImage(url)
}

function drawTextShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fill: string,
  font: string
) {
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillText(text, x + 3, y + 3, maxWidth)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y, maxWidth)
}

function drawLogoWatermark(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number
) {
  if (!img || img.naturalWidth <= 0) return
  const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  ctx.save()
  // Prawdziwy znak wodny: duży, niska krycie, pod geometrią/nazwą
  ctx.globalAlpha = 0.22
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
  ctx.restore()
}

function canvasToDownload(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Nie udało się zbudować PNG.'))
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      resolve()
    }, 'image/png')
  })
}

function safeFilePart(raw: string): string {
  return raw.replace(/[^\w\sąćęłńóśźżĄĆĘŁŃÓŚŹŻ-]/g, '').trim() || 'LED'
}

export function pixelMapTooLarge(result: LedScreenResult): boolean {
  return result.screenPxW > LED_PIXEL_MAP_MAX_EDGE || result.screenPxH > LED_PIXEL_MAP_MAX_EDGE
}

function strokeCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  lineWidth: number
) {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
}

/**
 * Wzorcowa mapa diagnostyczna jednego ekranu (jak Grid-Main / Grid-L / Grid-R).
 */
function paintScreenContent(
  ctx: CanvasRenderingContext2D,
  screen: LedScreenSpec,
  calc: LedScreenResult,
  options: LedPixelMapOptions,
  logo: HTMLImageElement | null,
  originX: number,
  originY: number
) {
  const cabW = calc.cabinetPxW
  const cabH = calc.cabinetPxH
  const w = calc.screenPxW
  const h = calc.screenPxH
  const line = Math.max(1, Math.round(Math.min(w, h) / 900))

  // 1) Kolorowe kabinety
  for (let r = 0; r < calc.rows; r += 1) {
    for (let c = 0; c < calc.columns; c += 1) {
      const x = originX + c * cabW
      const y = originY + r * cabH
      ctx.fillStyle = cabinetColor(r, c)
      ctx.fillRect(x, y, cabW, cabH)
      ctx.strokeStyle = '#c9a227'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, cabW - 1, cabH - 1)
    }
  }

  const cx = originX + w / 2
  const cy = originY + h / 2

  // 2) Znak wodny logo — pod geometrią i nazwą
  drawLogoWatermark(ctx, logo, cx, cy, w * 0.52, h * 0.4)

  // 3) Etykiety row,col (1-index) — lewy górny róg kabinetu
  const coordPx = Math.max(11, Math.min(cabW, cabH) * 0.16)
  ctx.font = `600 ${coordPx}px ui-monospace, Consolas, monospace`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#ffffff'
  for (let r = 0; r < calc.rows; r += 1) {
    for (let c = 0; c < calc.columns; c += 1) {
      ctx.fillText(`${r + 1},${c + 1}`, originX + c * cabW + 4, originY + r * cabH + 3)
    }
  }

  // TL na łączonym canvasie
  if (options.canvasOriginPx) {
    const tlPx = Math.max(coordPx, Math.min(cabW, cabH) * 0.2)
    ctx.font = `700 ${tlPx}px ui-monospace, Consolas, monospace`
    ctx.fillStyle = '#ffe566'
    ctx.fillText(
      `TL:${options.canvasOriginPx.x},${options.canvasOriginPx.y}`,
      originX + 4,
      originY + 3 + coordPx + 2
    )
  }

  // 4) Geometria: X + koło środkowe + koła narożne (orientacja RGBY)
  const x0 = originX
  const y0 = originY
  const x1 = originX + w
  const y1 = originY + h

  ctx.strokeStyle = '#5ec8d8'
  ctx.lineWidth = line
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.moveTo(x1, y0)
  ctx.lineTo(x0, y1)
  ctx.stroke()

  const mainR = Math.min(w, h) * 0.42
  strokeCircle(ctx, cx, cy, mainR, '#ffffff', line)

  const cornerR = Math.min(cabW, cabH) * 0.38
  // TL red, TR green, BL blue, BR yellow — jak we wzorcu
  strokeCircle(ctx, originX + cabW / 2, originY + cabH / 2, cornerR, '#e53935', line)
  strokeCircle(
    ctx,
    originX + (calc.columns - 0.5) * cabW,
    originY + cabH / 2,
    cornerR,
    '#43a047',
    line
  )
  strokeCircle(
    ctx,
    originX + cabW / 2,
    originY + (calc.rows - 0.5) * cabH,
    cornerR,
    '#1e88e5',
    line
  )
  strokeCircle(
    ctx,
    originX + (calc.columns - 0.5) * cabW,
    originY + (calc.rows - 0.5) * cabH,
    cornerR,
    '#fdd835',
    line
  )

  // 5) Nazwa ekranu na środku (nad znakiem wodnym)
  const titlePx = Math.max(28, Math.min(w * 0.09, h * 0.14, 160))
  drawTextShadow(
    ctx,
    screen.label,
    cx,
    cy,
    w * 0.9,
    '#ffe566',
    `800 ${titlePx}px "Space Grotesk", Arial Black, sans-serif`
  )

  // 6) Wymiary px — lewy dolny róg (żółty)
  const dimPx = Math.max(12, Math.min(w, h) * 0.028, 28)
  ctx.font = `700 ${dimPx}px ui-monospace, Consolas, monospace`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = '#ffe566'
  ctx.fillText(`${w}x${h}`, originX + 6, originY + h - 6)

  // 7) Ramka ekranu
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = Math.max(2, line)
  ctx.strokeRect(originX + 1, originY + 1, w - 2, h - 2)
}

export async function renderLedPixelMapCanvas(
  screen: LedScreenSpec,
  options: LedPixelMapOptions = {}
): Promise<{ canvas: HTMLCanvasElement; result: LedScreenResult }> {
  const calc = calculateScreenFromSpec(screen)
  if (!calc.ok) {
    throw new Error(calc.error)
  }
  if (pixelMapTooLarge(calc)) {
    throw new Error(
      `Rozdzielczość ${calc.screenPxW}×${calc.screenPxH} przekracza limit ${LED_PIXEL_MAP_MAX_EDGE} px — zmniejsz siatkę.`
    )
  }

  const canvas = document.createElement('canvas')
  canvas.width = calc.screenPxW
  canvas.height = calc.screenPxH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D niedostępne.')

  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const logo = await resolveLogo(options)
  paintScreenContent(ctx, screen, calc, options, logo, 0, 0)

  return { canvas, result: calc }
}

export async function downloadLedPixelMapPng(
  screen: LedScreenSpec,
  options: LedPixelMapOptions = {}
): Promise<LedScreenResult> {
  const { canvas, result } = await renderLedPixelMapCanvas(screen, options)
  const safeLabel = safeFilePart(screen.label || 'LED')
  await canvasToDownload(
    canvas,
    `PixelMap-${safeLabel}-${result.screenPxW}x${result.screenPxH}px.png`
  )
  return result
}

export async function downloadAllLedPixelMapsPng(
  screens: LedScreenSpec[],
  options: LedPixelMapOptions = {}
): Promise<number> {
  let count = 0
  for (const screen of screens) {
    await downloadLedPixelMapPng(screen, {
      ...options,
      projectName: options.projectName
        ? `${options.projectName} · ${screen.label}`
        : screen.label,
    })
    count += 1
    await new Promise((r) => setTimeout(r, 280))
  }
  return count
}

export function screenLayoutOriginPx(
  screen: LedScreenSpec,
  originXM: number,
  originYM: number
): { x: number; y: number; calc: LedScreenResult } {
  const calc = calculateScreenFromSpec(screen)
  if (!calc.ok) {
    throw new Error(calc.error)
  }
  const x = Math.round(((screen.layoutXM - originXM) * 1000) / screen.pitchMm)
  const y = Math.round(((screen.layoutYM - originYM) * 1000) / screen.pitchMm)
  return { x, y, calc }
}

export function combinedPixelMapBounds(screens: LedScreenSpec[]): {
  originXM: number
  originYM: number
  widthPx: number
  heightPx: number
  placements: Array<{ screen: LedScreenSpec; calc: LedScreenResult; x: number; y: number }>
} {
  if (screens.length === 0) {
    throw new Error('Brak ekranów.')
  }
  let originXM = Infinity
  let originYM = Infinity
  for (const s of screens) {
    originXM = Math.min(originXM, s.layoutXM)
    originYM = Math.min(originYM, s.layoutYM)
  }

  const placements: Array<{ screen: LedScreenSpec; calc: LedScreenResult; x: number; y: number }> =
    []
  let widthPx = 0
  let heightPx = 0
  for (const screen of screens) {
    const { x, y, calc } = screenLayoutOriginPx(screen, originXM, originYM)
    if (pixelMapTooLarge(calc)) {
      throw new Error(
        `Ekran „${screen.label}” (${calc.screenPxW}×${calc.screenPxH}) przekracza limit ${LED_PIXEL_MAP_MAX_EDGE} px.`
      )
    }
    placements.push({ screen, calc, x, y })
    widthPx = Math.max(widthPx, x + calc.screenPxW)
    heightPx = Math.max(heightPx, y + calc.screenPxH)
  }

  if (widthPx > LED_PIXEL_MAP_MAX_EDGE || heightPx > LED_PIXEL_MAP_MAX_EDGE) {
    throw new Error(
      `Pełen canvas ${widthPx}×${heightPx} przekracza limit ${LED_PIXEL_MAP_MAX_EDGE} px — zbliż ekrany lub zmniejsz siatki.`
    )
  }

  return { originXM, originYM, widthPx, heightPx, placements }
}

export async function downloadCombinedLedPixelMapPng(
  screens: LedScreenSpec[],
  options: LedPixelMapOptions = {}
): Promise<{ widthPx: number; heightPx: number; screenCount: number }> {
  const { widthPx, heightPx, placements } = combinedPixelMapBounds(screens)
  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D niedostępne.')

  ctx.fillStyle = '#050505'
  ctx.fillRect(0, 0, widthPx, heightPx)

  const logo = await resolveLogo(options)
  for (const { screen, calc, x, y } of placements) {
    paintScreenContent(
      ctx,
      screen,
      calc,
      { ...options, canvasOriginPx: { x, y } },
      logo,
      x,
      y
    )
  }

  // Globalny wymiar całego canvasu — lewy dolny róg
  const dimPx = Math.max(14, Math.min(widthPx, heightPx) * 0.02, 32)
  ctx.font = `700 ${dimPx}px ui-monospace, Consolas, monospace`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = '#ffe566'
  ctx.fillText(`${widthPx}x${heightPx}`, 8, heightPx - 8)

  const name = (options.projectName || 'LED layout').trim()
  const safe = safeFilePart(name)
  await canvasToDownload(canvas, `PixelMap-CANVAS-${safe}-${widthPx}x${heightPx}px.png`)
  return { widthPx, heightPx, screenCount: screens.length }
}
