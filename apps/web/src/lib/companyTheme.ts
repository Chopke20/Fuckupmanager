const DEFAULT_PRIMARY_HEX = '#00FF88'

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgbToHsl(rgb: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
  }
  h = Math.round(h * 60)
  if (h < 0) h += 360

  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function normalizeHexColor(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  const isValid = /^#[0-9a-fA-F]{6}$/.test(withHash)
  return isValid ? withHash.toUpperCase() : null
}

function getHexOrDefault(colorHex?: string | null): string {
  return normalizeHexColor(colorHex) ?? DEFAULT_PRIMARY_HEX
}

export function applyCompanyTheme(colorHex?: string | null) {
  if (typeof document === 'undefined') return
  const hex = getHexOrDefault(colorHex)
  const rgb = hexToRgb(hex)
  const hsl = rgbToHsl(rgb)
  const hoverLightness = clamp(hsl.l - 10, 0, 100)

  const root = document.documentElement
  root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`)
  root.style.setProperty('--primary-hover', `${hsl.h} ${hsl.s}% ${hoverLightness}%`)
  root.style.setProperty('--ring', `${hsl.h} ${hsl.s}% ${hsl.l}%`)
  root.style.setProperty('--primary-rgb', `${rgb.r} ${rgb.g} ${rgb.b}`)
}

export function resetCompanyTheme() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.removeProperty('--primary')
  root.style.removeProperty('--primary-hover')
  root.style.removeProperty('--ring')
  root.style.removeProperty('--primary-rgb')
}

export const THEME_DEFAULT_PRIMARY_HEX = DEFAULT_PRIMARY_HEX
