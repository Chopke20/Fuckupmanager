/**
 * Profesjonalna pixel mapa LED — PNG 1:1 (1 px obrazu = 1 dioda).
 * Tryby: pojedynczy ekran · wszystkie osobno · pełen canvas (layout).
 */

import {
  LED_PIXEL_MAP_MAX_EDGE,
  calculateScreenFromSpec,
  type LedScreenResult,
  type LedScreenSpec,
} from './ledScreen'

export type LedPixelMapExportMode = 'active' | 'all-separate' | 'combined-canvas'

export interface LedPixelMapOptions {
  projectName?: string
  /** URL logo (np. branding firmy). Brak → tekst LAMA STAGE. */
  logoUrl?: string | null
  /** tech = siatka + numery; clean = siatka + logo + slate */
  variant?: 'tech' | 'clean'
  /** Dla canvas łączonego: rysuj slate na całym płótnie. */
  combinedSlate?: boolean
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

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fillStyle: string,
  fontPx: number
) {
  ctx.fillStyle = fillStyle
  ctx.font = `600 ${fontPx}px "Space Grotesk", Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y, maxWidth)
}

function drawLogoOrWordmark(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number
) {
  if (img && img.naturalWidth > 0) {
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
    return
  }
  const fontPx = Math.max(24, Math.min(maxW * 0.12, maxH * 0.28, 120))
  drawCenteredText(ctx, 'LAMA STAGE', cx, cy, maxW * 0.9, '#f5f5f5', fontPx)
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

/** Rysuje jeden ekran w (0,0) lokalnym — bez slate całego projektu. */
function paintScreenContent(
  ctx: CanvasRenderingContext2D,
  screen: LedScreenSpec,
  calc: LedScreenResult,
  options: LedPixelMapOptions,
  logo: HTMLImageElement | null,
  originX: number,
  originY: number
) {
  const variant = options.variant ?? 'tech'
  const cabW = calc.cabinetPxW
  const cabH = calc.cabinetPxH
  const w = calc.screenPxW
  const h = calc.screenPxH

  for (let r = 0; r < calc.rows; r += 1) {
    for (let c = 0; c < calc.columns; c += 1) {
      const x = originX + c * cabW
      const y = originY + r * cabH
      const alt = (r + c) % 2 === 0
      ctx.fillStyle = alt ? '#1a1a1a' : '#141414'
      ctx.fillRect(x, y, cabW, cabH)
    }
  }

  ctx.strokeStyle = '#3d3d3d'
  ctx.lineWidth = 1
  for (let c = 0; c <= calc.columns; c += 1) {
    const x = originX + Math.min(c * cabW, w - 1) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, originY)
    ctx.lineTo(x, originY + h)
    ctx.stroke()
  }
  for (let r = 0; r <= calc.rows; r += 1) {
    const y = originY + Math.min(r * cabH, h - 1) + 0.5
    ctx.beginPath()
    ctx.moveTo(originX, y)
    ctx.lineTo(originX + w, y)
    ctx.stroke()
  }

  if (variant === 'tech') {
    const labelPx = Math.max(10, Math.min(cabW, cabH) * 0.18)
    ctx.fillStyle = '#8a8a8a'
    ctx.font = `500 ${labelPx}px ui-monospace, monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (let r = 0; r < calc.rows; r += 1) {
      for (let c = 0; c < calc.columns; c += 1) {
        const tag = `${String.fromCharCode(65 + (r % 26))}${c + 1}`
        ctx.fillText(tag, originX + c * cabW + 4, originY + r * cabH + 4)
      }
    }
    // Etykieta ekranu w lewym dolnym rogu kabinetu (czytelna na canvasie łączonym)
    const titlePx = Math.max(14, Math.min(cabW, cabH) * 0.22)
    ctx.fillStyle = '#e8e8e8'
    ctx.font = `600 ${titlePx}px "Space Grotesk", Arial, sans-serif`
    ctx.fillText(screen.label, originX + 8, originY + 8 + labelPx + 4)
  }

  const cx = originX + w / 2
  const cy = originY + h / 2
  ctx.strokeStyle = '#e8e8e8'
  ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) / 800))
  const arm = Math.min(w, h) * 0.08
  ctx.beginPath()
  ctx.moveTo(cx - arm, cy)
  ctx.lineTo(cx + arm, cy)
  ctx.moveTo(cx, cy - arm)
  ctx.lineTo(cx, cy + arm)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, arm * 0.35, 0, Math.PI * 2)
  ctx.stroke()

  drawLogoOrWordmark(ctx, logo, cx, cy, w * 0.28, h * 0.18)

  ctx.strokeStyle = '#f5f5f5'
  ctx.lineWidth = 2
  ctx.strokeRect(originX + 1, originY + 1, w - 2, h - 2)
}

function paintSlate(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lines: string[]
) {
  const slateH = Math.max(28, Math.min(72, Math.round(height * 0.045)))
  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.fillRect(0, height - slateH, width, slateH)
  const slateFont = Math.max(11, Math.round(slateH * 0.42))
  drawCenteredText(
    ctx,
    lines.filter(Boolean).join('  ·  '),
    width / 2,
    height - slateH / 2,
    width * 0.96,
    '#f0f0f0',
    slateFont
  )
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

  const logo = options.logoUrl ? await loadImage(options.logoUrl) : null
  paintScreenContent(ctx, screen, calc, options, logo, 0, 0)

  const name = (options.projectName || screen.label || 'LED').trim()
  paintSlate(ctx, canvas.width, canvas.height, [
    name,
    `${calc.screenPxW}×${calc.screenPxH} px`,
    `P${screen.pitchMm}`,
    `${calc.screenWidthM}×${calc.screenHeightM} m`,
    `${calc.columns}×${calc.rows} kab.`,
    new Date().toLocaleDateString('pl-PL'),
  ])

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

/** Każdy ekran jako osobny PNG (kolejno). */
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
    // Krótka przerwa — przeglądarki czasem gubią kolejne downloady
    await new Promise((r) => setTimeout(r, 280))
  }
  return count
}

/**
 * Pozycja ekranu na wspólnym canvasie 1:1.
 * Metry layoutu → px przy pitchu danego ekranu (przy tym samym P odstępy są fizycznie poprawne).
 */
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

/** Jeden PNG: wszystkie ekrany na czarnym canvasie wg pozycji layoutu. */
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

  const logo = options.logoUrl ? await loadImage(options.logoUrl) : null
  for (const { screen, calc, x, y } of placements) {
    paintScreenContent(ctx, screen, calc, options, logo, x, y)
  }

  const pitches = [...new Set(screens.map((s) => s.pitchMm))]
  const name = (options.projectName || 'LED layout').trim()
  paintSlate(ctx, widthPx, heightPx, [
    name,
    `${widthPx}×${heightPx} px`,
    `${screens.length} ekran${screens.length === 1 ? '' : 'y'}`,
    pitches.length === 1 ? `P${pitches[0]}` : `P: ${pitches.join('/')}`,
    new Date().toLocaleDateString('pl-PL'),
  ])

  const safe = safeFilePart(name)
  await canvasToDownload(canvas, `PixelMap-CANVAS-${safe}-${widthPx}x${heightPx}px.png`)
  return { widthPx, heightPx, screenCount: screens.length }
}
