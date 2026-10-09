/**
 * Profesjonalna pixel mapa LED — PNG 1:1 (1 px obrazu = 1 dioda).
 */

import {
  LED_PIXEL_MAP_MAX_EDGE,
  calculateScreenFromSpec,
  type LedScreenResult,
  type LedScreenSpec,
} from './ledScreen'

export interface LedPixelMapOptions {
  projectName?: string
  /** URL logo (np. branding firmy). Brak → tekst LAMA STAGE. */
  logoUrl?: string | null
  /** tech = siatka + numery; clean = siatka + logo + slate */
  variant?: 'tech' | 'clean'
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

export function pixelMapTooLarge(result: LedScreenResult): boolean {
  return result.screenPxW > LED_PIXEL_MAP_MAX_EDGE || result.screenPxH > LED_PIXEL_MAP_MAX_EDGE
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

  const variant = options.variant ?? 'tech'
  const canvas = document.createElement('canvas')
  canvas.width = calc.screenPxW
  canvas.height = calc.screenPxH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D niedostępne.')

  const cabW = calc.cabinetPxW
  const cabH = calc.cabinetPxH

  // Tło + naprzemienne kabinety
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let r = 0; r < calc.rows; r += 1) {
    for (let c = 0; c < calc.columns; c += 1) {
      const x = c * cabW
      const y = r * cabH
      const alt = (r + c) % 2 === 0
      ctx.fillStyle = alt ? '#1a1a1a' : '#141414'
      ctx.fillRect(x, y, cabW, cabH)
    }
  }

  // Siatka kabinetów (1 px)
  ctx.strokeStyle = '#3d3d3d'
  ctx.lineWidth = 1
  for (let c = 0; c <= calc.columns; c += 1) {
    const x = Math.min(c * cabW, canvas.width - 1) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }
  for (let r = 0; r <= calc.rows; r += 1) {
    const y = Math.min(r * cabH, canvas.height - 1) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
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
        ctx.fillText(tag, c * cabW + 4, r * cabH + 4)
      }
    }
  }

  // Crosshair
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  ctx.strokeStyle = '#e8e8e8'
  ctx.lineWidth = Math.max(1, Math.round(Math.min(canvas.width, canvas.height) / 800))
  const arm = Math.min(canvas.width, canvas.height) * 0.08
  ctx.beginPath()
  ctx.moveTo(cx - arm, cy)
  ctx.lineTo(cx + arm, cy)
  ctx.moveTo(cx, cy - arm)
  ctx.lineTo(cx, cy + arm)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, arm * 0.35, 0, Math.PI * 2)
  ctx.stroke()

  // Logo
  const logo = options.logoUrl ? await loadImage(options.logoUrl) : null
  const logoMaxW = canvas.width * 0.28
  const logoMaxH = canvas.height * 0.18
  drawLogoOrWordmark(ctx, logo, cx, cy, logoMaxW, logoMaxH)

  // Slate / burn-in
  const slateH = Math.max(28, Math.min(72, Math.round(canvas.height * 0.045)))
  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.fillRect(0, canvas.height - slateH, canvas.width, slateH)
  const slateFont = Math.max(11, Math.round(slateH * 0.42))
  const name = (options.projectName || screen.label || 'LED').trim()
  const slate = [
    name,
    `${calc.screenPxW}×${calc.screenPxH} px`,
    `P${calc.ok ? screen.pitchMm : '?'}`,
    `${calc.screenWidthM}×${calc.screenHeightM} m`,
    `${calc.columns}×${calc.rows} kab.`,
    new Date().toLocaleDateString('pl-PL'),
  ].join('  ·  ')
  drawCenteredText(ctx, slate, cx, canvas.height - slateH / 2, canvas.width * 0.96, '#f0f0f0', slateFont)

  // Ramka zewnętrzna
  ctx.strokeStyle = '#f5f5f5'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)

  return { canvas, result: calc }
}

export async function downloadLedPixelMapPng(
  screen: LedScreenSpec,
  options: LedPixelMapOptions = {}
): Promise<LedScreenResult> {
  const { canvas, result } = await renderLedPixelMapCanvas(screen, options)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Nie udało się zbudować PNG.'))), 'image/png')
  })
  const safeLabel = (screen.label || 'LED').replace(/[^\w\sąćęłńóśźżĄĆĘŁŃÓŚŹŻ-]/g, '').trim() || 'LED'
  const name = `PixelMap-${safeLabel}-${result.screenPxW}x${result.screenPxH}px.png`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return result
}
