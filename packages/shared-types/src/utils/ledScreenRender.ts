/**
 * Rzut LED → SVG (podgląd UI / PDF). Bez DOM/React.
 */

import {
  calculateScreenFromSpec,
  type LedScreenProjectPayload,
  type LedScreenSpec,
} from './ledScreen'

export type LedPlanTheme = 'dark' | 'print'

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function palette(theme: LedPlanTheme) {
  if (theme === 'print') {
    return {
      bg: '#ffffff',
      grid: '#e5e7eb',
      gridMajor: '#d1d5db',
      screenFill: '#111827',
      screenStroke: '#374151',
      label: '#f9fafb',
      muted: '#d1d5db',
      border: '#9ca3af',
    }
  }
  return {
    bg: '#0b0b0f',
    grid: 'rgba(255,255,255,0.08)',
    gridMajor: 'rgba(255,255,255,0.16)',
    screenFill: '#1a1a22',
    screenStroke: '#22c55e',
    label: '#ffffff',
    muted: 'rgba(255,255,255,0.7)',
    border: 'rgba(255,255,255,0.25)',
  }
}

function screenMetrics(screen: LedScreenSpec) {
  const calc = calculateScreenFromSpec(screen)
  if (!calc.ok) return null
  return {
    id: screen.id,
    x: screen.layoutXM,
    y: screen.layoutYM,
    w: calc.screenWidthM,
    h: calc.screenHeightM,
    columns: calc.columns,
    rows: calc.rows,
    pitchMm: screen.pitchMm,
    label: screen.label,
  }
}

/** SVG rzutu projektu LED (wszystkie ekrany na scenie). */
export function renderLedScreenSvg(
  project: LedScreenProjectPayload,
  opts?: { widthPx?: number; theme?: LedPlanTheme; activeScreenId?: string | null }
): string {
  const theme = opts?.theme ?? 'print'
  const widthPx = opts?.widthPx ?? 640
  const colors = palette(theme)
  const screens = project.screens
    .map((s) => screenMetrics(s))
    .filter((s): s is NonNullable<typeof s> => !!s)

  if (screens.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="120" viewBox="0 0 ${widthPx} 120"><rect width="100%" height="100%" fill="${colors.bg}"/><text x="16" y="64" fill="${colors.border}" font-family="Arial,sans-serif" font-size="14">Brak ekranów</text></svg>`
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of screens) {
    minX = Math.min(minX, s.x)
    minY = Math.min(minY, s.y)
    maxX = Math.max(maxX, s.x + s.w)
    maxY = Math.max(maxY, s.y + s.h)
  }
  const pad = 0.75
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad
  const worldW = Math.max(1, maxX - minX)
  const worldH = Math.max(1, maxY - minY)
  const heightPx = Math.max(160, Math.round((widthPx * worldH) / worldW))
  const sx = widthPx / worldW
  const sy = heightPx / worldH

  const toX = (m: number) => (m - minX) * sx
  const toY = (m: number) => (m - minY) * sy

  const gridLines: string[] = []
  const x0 = Math.floor(minX)
  const x1 = Math.ceil(maxX)
  const y0 = Math.floor(minY)
  const y1 = Math.ceil(maxY)
  for (let x = x0; x <= x1; x += 1) {
    const major = x % 1 === 0
    gridLines.push(
      `<line x1="${toX(x)}" y1="${toY(minY)}" x2="${toX(x)}" y2="${toY(maxY)}" stroke="${
        major ? colors.gridMajor : colors.grid
      }" stroke-width="${major ? 1.2 : 0.6}"/>`
    )
  }
  for (let y = y0; y <= y1; y += 1) {
    const major = y % 1 === 0
    gridLines.push(
      `<line x1="${toX(minX)}" y1="${toY(y)}" x2="${toX(maxX)}" y2="${toY(y)}" stroke="${
        major ? colors.gridMajor : colors.grid
      }" stroke-width="${major ? 1.2 : 0.6}"/>`
    )
  }

  const boxes = screens
    .map((s) => {
      const active = opts?.activeScreenId != null && opts.activeScreenId === s.id
      const stroke = active ? colors.screenStroke : colors.border
      const cabW = s.w / s.columns
      const cabH = s.h / s.rows
      const cabinetLines: string[] = []
      for (let c = 1; c < s.columns; c += 1) {
        const xx = toX(s.x + c * cabW)
        cabinetLines.push(
          `<line x1="${xx}" y1="${toY(s.y)}" x2="${xx}" y2="${toY(s.y + s.h)}" stroke="${colors.muted}" stroke-width="0.5" opacity="0.35"/>`
        )
      }
      for (let r = 1; r < s.rows; r += 1) {
        const yy = toY(s.y + r * cabH)
        cabinetLines.push(
          `<line x1="${toX(s.x)}" y1="${yy}" x2="${toX(s.x + s.w)}" y2="${yy}" stroke="${colors.muted}" stroke-width="0.5" opacity="0.35"/>`
        )
      }
      return `
      <g>
        <rect x="${toX(s.x)}" y="${toY(s.y)}" width="${s.w * sx}" height="${s.h * sy}" fill="${colors.screenFill}" stroke="${stroke}" stroke-width="2" rx="2"/>
        ${cabinetLines.join('')}
        <text x="${toX(s.x) + 6}" y="${toY(s.y) + 14}" fill="${colors.label}" font-family="Arial,sans-serif" font-size="11" font-weight="600">${escapeXml(s.label)}</text>
        <text x="${toX(s.x) + 6}" y="${toY(s.y + s.h) - 18}" fill="${colors.label}" font-family="Arial,sans-serif" font-size="11" font-weight="600">${s.w} × ${s.h} m</text>
        <text x="${toX(s.x) + 6}" y="${toY(s.y + s.h) - 4}" fill="${colors.muted}" font-family="Arial,sans-serif" font-size="10">${s.columns}×${s.rows} · P${s.pitchMm}</text>
      </g>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">
  <rect width="100%" height="100%" fill="${colors.bg}"/>
  ${gridLines.join('')}
  ${boxes}
</svg>`
}
