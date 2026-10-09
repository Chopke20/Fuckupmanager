import { describe, expect, it } from 'vitest'
import {
  cabinetPixels,
  calculateLedScreen,
  emptyLedScreenProject,
  formatAspectLabel,
  metersToCabinetGrid,
  otherSideFromAspect,
  parseAspectRatio,
  parseLedScreenProjectJson,
  serializeLedScreenProject,
  snapCabinetsToMm,
} from './ledScreen'

describe('cabinetPixels', () => {
  it('500 mm / P2.6 ≈ 192 px', () => {
    expect(cabinetPixels(500, 2.6)).toBe(192)
  })

  it('500 mm / P2.97 ≈ 168 px', () => {
    expect(cabinetPixels(500, 2.97)).toBe(168)
  })
})

describe('snapCabinetsToMm', () => {
  it('zaokrągla do najbliższej siatki', () => {
    expect(snapCabinetsToMm(8000, 500)).toBe(16)
    expect(snapCabinetsToMm(7600, 500)).toBe(15)
    expect(snapCabinetsToMm(100, 500)).toBe(1)
  })
})

describe('parseAspectRatio / formatAspectLabel', () => {
  it('parsuje 16:9 i liczbę', () => {
    expect(parseAspectRatio('16:9')).toBeCloseTo(16 / 9, 6)
    expect(parseAspectRatio('1,778')).toBeCloseTo(1.778, 3)
  })

  it('etykietuje znane proporcje', () => {
    expect(formatAspectLabel(16 / 9)).toBe('16:9')
    expect(formatAspectLabel(1)).toBe('1:1')
  })
})

describe('metersToCabinetGrid', () => {
  it('8 × 4,5 m przy 500×500 → 16 × 9', () => {
    const g = metersToCabinetGrid({
      targetWidthM: 8,
      targetHeightM: 4.5,
      cabinetWidthMm: 500,
      cabinetHeightMm: 500,
    })
    expect(g.columns).toBe(16)
    expect(g.rows).toBe(9)
    expect(g.actualWidthM).toBe(8)
    expect(g.actualHeightM).toBe(4.5)
    expect(g.widthDeltaM).toBe(0)
    expect(g.heightDeltaM).toBe(0)
  })
})

describe('otherSideFromAspect', () => {
  it('z szerokości 8 m i 16:9 liczy wysokość 4,5 m', () => {
    expect(otherSideFromAspect({ knownSideM: 8, known: 'width', targetRatio: 16 / 9 })).toBe(4.5)
  })
})

describe('calculateLedScreen', () => {
  it('16×9 kabinetów 500×500 P2.6 = idealne 16:9', () => {
    const r = calculateLedScreen({
      cabinetWidthMm: 500,
      cabinetHeightMm: 500,
      pitchMm: 2.6,
      columns: 16,
      rows: 9,
      targetRatio: 16 / 9,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.cabinetsTotal).toBe(144)
    expect(r.screenWidthM).toBe(8)
    expect(r.screenHeightM).toBe(4.5)
    expect(r.screenPxW).toBe(16 * 192)
    expect(r.screenPxH).toBe(9 * 192)
    expect(r.aspectLabel).toBe('16:9')
    expect(r.deviation.percent).toBe(0)
    expect(r.deviation.heightDeltaMm).toBe(0)
  })

  it('16×8 przy 16:9 pokazuje rozjazd i lepszy układ', () => {
    const r = calculateLedScreen({
      cabinetWidthMm: 500,
      cabinetHeightMm: 500,
      pitchMm: 2.6,
      columns: 16,
      rows: 8,
      targetRatio: 16 / 9,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.deviation.percent).toBeGreaterThan(0)
    expect(r.deviation.betterSameColumns?.rows).toBe(9)
    // Idealna wysokość przy 8 m = 4,5 m → brakuje 500 mm
    expect(r.deviation.heightDeltaMm).toBe(500)
  })

  it('odrzuca brak pitchu', () => {
    const r = calculateLedScreen({
      cabinetWidthMm: 500,
      cabinetHeightMm: 500,
      pitchMm: 0,
      columns: 4,
      rows: 3,
      targetRatio: 16 / 9,
    })
    expect(r.ok).toBe(false)
  })
})

describe('LedScreenProjectPayload', () => {
  it('serializuje i parsuje projekt z wieloma ekranami', () => {
    const project = emptyLedScreenProject()
    const second = {
      ...project.screens[0]!,
      id: 'screen-2',
      label: 'IMAG L',
      columns: 8,
      rows: 4,
      layoutXM: -5,
    }
    const multi = {
      version: 1 as const,
      activeScreenId: second.id,
      screens: [...project.screens, second],
    }
    const raw = serializeLedScreenProject(multi)
    const parsed = parseLedScreenProjectJson(raw)
    expect(parsed?.screens).toHaveLength(2)
    expect(parsed?.activeScreenId).toBe('screen-2')
    expect(parsed?.screens[1]?.label).toBe('IMAG L')
  })
})
