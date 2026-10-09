import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Copy, Download, Plus, Trash2 } from 'lucide-react'
import {
  LED_ASPECT_PRESETS,
  LED_CABINET_PRESETS,
  calculateScreenFromSpec,
  createDefaultLedScreen,
  formatMm,
  formatPx,
  metersToCabinetGrid,
  otherSideFromAspect,
  parseAspectRatio,
  type LedAspectPresetId,
  type LedScreenProjectPayload,
  type LedScreenSpec,
} from '../calculators/ledScreen'
import {
  downloadAllLedPixelMapsPng,
  downloadCombinedLedPixelMapPng,
  downloadLedPixelMapPng,
  pixelMapTooLarge,
  type LedPixelMapExportMode,
} from '../calculators/ledPixelMap'
import LedScreenCssPreview from './LedScreenCssPreview'

function parseNum(raw: string): number {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return NaN
  const value = Number(normalized)
  return Number.isFinite(value) ? value : NaN
}

function Row({
  label,
  value,
  emphasize,
  muted,
}: {
  label: string
  value: string
  emphasize?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={muted ? 'text-muted-foreground' : 'text-foreground'}>{label}</span>
      <span className={`tabular-nums ${emphasize ? 'font-semibold text-primary' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  )
}

type SizeMode = 'cabinets' | 'meters' | 'widthAspect' | 'heightAspect'

function closestAspectId(ratio: number): LedAspectPresetId {
  for (const p of LED_ASPECT_PRESETS) {
    if (p.ratio != null && Math.abs(p.ratio - ratio) < 0.008) return p.id
  }
  return 'custom'
}

export default function LedScreensWorkspace({
  project,
  onChange,
  logoUrl,
  projectName,
  compactHeader,
}: {
  project: LedScreenProjectPayload
  onChange: (next: LedScreenProjectPayload) => void
  logoUrl?: string | null
  projectName?: string
  compactHeader?: boolean
}) {
  const active =
    project.screens.find((s) => s.id === project.activeScreenId) ?? project.screens[0] ?? null

  const [cabWRaw, setCabWRaw] = useState('500')
  const [cabHRaw, setCabHRaw] = useState('500')
  const [pitchRaw, setPitchRaw] = useState('2.6')
  const [colsRaw, setColsRaw] = useState('16')
  const [rowsRaw, setRowsRaw] = useState('9')
  const [targetWRaw, setTargetWRaw] = useState('8')
  const [targetHRaw, setTargetHRaw] = useState('4.5')
  const [layoutXRaw, setLayoutXRaw] = useState('0')
  const [layoutYRaw, setLayoutYRaw] = useState('0')
  const [labelRaw, setLabelRaw] = useState('Main')
  const [sizeMode, setSizeMode] = useState<SizeMode>('cabinets')
  const [aspectId, setAspectId] = useState<LedAspectPresetId>('16:9')
  const [customAspectRaw, setCustomAspectRaw] = useState('16:9')
  const [activePreset, setActivePreset] = useState<string | null>('500x500-p2.6')
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  // Sync form from active screen when selection changes
  useEffect(() => {
    if (!active) return
    setCabWRaw(String(active.cabinetWidthMm))
    setCabHRaw(String(active.cabinetHeightMm))
    setPitchRaw(String(active.pitchMm))
    setColsRaw(String(active.columns))
    setRowsRaw(String(active.rows))
    setLayoutXRaw(String(active.layoutXM))
    setLayoutYRaw(String(active.layoutYM))
    setLabelRaw(active.label)
    setAspectId(closestAspectId(active.targetRatio))
    setCustomAspectRaw(String(active.targetRatio))
    setActivePreset(null)
    setSizeMode('cabinets')
    const wM = (active.columns * active.cabinetWidthMm) / 1000
    const hM = (active.rows * active.cabinetHeightMm) / 1000
    setTargetWRaw(String(wM))
    setTargetHRaw(String(hM))
  }, [active?.id])

  const targetRatio = useMemo(() => {
    if (aspectId === 'custom') return parseAspectRatio(customAspectRaw) ?? 16 / 9
    return LED_ASPECT_PRESETS.find((p) => p.id === aspectId)?.ratio ?? 16 / 9
  }, [aspectId, customAspectRaw])

  const cabinetWidthMm = parseNum(cabWRaw)
  const cabinetHeightMm = parseNum(cabHRaw)
  const pitchMm = parseNum(pitchRaw)

  const gridFromMeters = useMemo(() => {
    if (!(cabinetWidthMm > 0) || !(cabinetHeightMm > 0)) return null
    if (sizeMode === 'meters') {
      const tw = parseNum(targetWRaw)
      const th = parseNum(targetHRaw)
      if (!(tw > 0) || !(th > 0)) return null
      return metersToCabinetGrid({
        targetWidthM: tw,
        targetHeightM: th,
        cabinetWidthMm,
        cabinetHeightMm,
      })
    }
    if (sizeMode === 'widthAspect') {
      const tw = parseNum(targetWRaw)
      if (!(tw > 0)) return null
      const th = otherSideFromAspect({ knownSideM: tw, known: 'width', targetRatio })
      return metersToCabinetGrid({
        targetWidthM: tw,
        targetHeightM: th,
        cabinetWidthMm,
        cabinetHeightMm,
      })
    }
    if (sizeMode === 'heightAspect') {
      const th = parseNum(targetHRaw)
      if (!(th > 0)) return null
      const tw = otherSideFromAspect({ knownSideM: th, known: 'height', targetRatio })
      return metersToCabinetGrid({
        targetWidthM: tw,
        targetHeightM: th,
        cabinetWidthMm,
        cabinetHeightMm,
      })
    }
    return null
  }, [sizeMode, targetWRaw, targetHRaw, cabinetWidthMm, cabinetHeightMm, targetRatio])

  const columns =
    sizeMode === 'cabinets' ? Math.max(1, Math.floor(parseNum(colsRaw) || 1)) : gridFromMeters?.columns ?? 1
  const rows =
    sizeMode === 'cabinets' ? Math.max(1, Math.floor(parseNum(rowsRaw) || 1)) : gridFromMeters?.rows ?? 1

  const patchActive = (patch: Partial<LedScreenSpec>) => {
    if (!active) return
    onChange({
      ...project,
      screens: project.screens.map((s) => (s.id === active.id ? { ...s, ...patch } : s)),
    })
  }

  // Push form → model
  useEffect(() => {
    if (!active) return
    const layoutXM = Number.isFinite(parseNum(layoutXRaw)) ? parseNum(layoutXRaw) : 0
    const layoutYM = Number.isFinite(parseNum(layoutYRaw)) ? parseNum(layoutYRaw) : 0
    const next: Partial<LedScreenSpec> = {
      label: labelRaw.trim() || 'Ekran',
      cabinetWidthMm: cabinetWidthMm > 0 ? cabinetWidthMm : active.cabinetWidthMm,
      cabinetHeightMm: cabinetHeightMm > 0 ? cabinetHeightMm : active.cabinetHeightMm,
      pitchMm: pitchMm > 0 ? pitchMm : active.pitchMm,
      columns,
      rows,
      targetRatio,
      layoutXM,
      layoutYM,
    }
    const same =
      active.label === next.label &&
      active.cabinetWidthMm === next.cabinetWidthMm &&
      active.cabinetHeightMm === next.cabinetHeightMm &&
      active.pitchMm === next.pitchMm &&
      active.columns === next.columns &&
      active.rows === next.rows &&
      active.targetRatio === next.targetRatio &&
      active.layoutXM === next.layoutXM &&
      active.layoutYM === next.layoutYM
    if (!same) patchActive(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cabWRaw,
    cabHRaw,
    pitchRaw,
    colsRaw,
    rowsRaw,
    targetRatio,
    columns,
    rows,
    layoutXRaw,
    layoutYRaw,
    labelRaw,
    sizeMode,
    gridFromMeters,
  ])

  const result = active ? calculateScreenFromSpec(active) : { ok: false as const, error: 'Brak ekranu' }

  const applyPreset = (id: string) => {
    const preset = LED_CABINET_PRESETS.find((p) => p.id === id)
    if (!preset) return
    setActivePreset(id)
    setCabWRaw(String(preset.widthMm))
    setCabHRaw(String(preset.heightMm))
    setPitchRaw(String(preset.pitchMm))
  }

  const addScreen = () => {
    const n = project.screens.length + 1
    const screen = createDefaultLedScreen({
      label: `Ekran ${n}`,
      layoutXM: n > 1 ? (n - 1) * 0.5 : 0,
      layoutYM: 0,
    })
    onChange({
      version: 1,
      activeScreenId: screen.id,
      screens: [...project.screens, screen],
    })
  }

  const duplicateActive = () => {
    if (!active) return
    const copy = createDefaultLedScreen({
      ...active,
      id: undefined,
      label: `${active.label} (kopia)`,
      layoutXM: active.layoutXM + 0.5,
    })
    onChange({
      ...project,
      activeScreenId: copy.id,
      screens: [...project.screens, copy],
    })
  }

  const removeActive = () => {
    if (project.screens.length <= 1 || !active) return
    const screens = project.screens.filter((s) => s.id !== active.id)
    onChange({
      version: 1,
      activeScreenId: screens[0]!.id,
      screens,
    })
  }

  const applyBetter = (cols: number, rws: number) => {
    setSizeMode('cabinets')
    setColsRaw(String(cols))
    setRowsRaw(String(rws))
  }

  const onExport = async (mode: LedPixelMapExportMode) => {
    if (!active || !result.ok) return
    setExportMenuOpen(false)
    setExportBusy(true)
    setExportError(null)
    const baseName = projectName?.trim() || 'Projekt LED'
    try {
      // logoUrl z props = override; brak = domyślne logo Lama na mapie
      const mapOpts = { logoUrl, variant: 'tech' as const }
      if (mode === 'active') {
        if (pixelMapTooLarge(result)) {
          throw new Error(`Za duża rozdzielczość (${result.screenPxW}×${result.screenPxH}).`)
        }
        await downloadLedPixelMapPng(active, {
          ...mapOpts,
          projectName: `${baseName} · ${active.label}`,
        })
      } else if (mode === 'all-separate') {
        await downloadAllLedPixelMapsPng(project.screens, {
          ...mapOpts,
          projectName: baseName,
        })
      } else {
        await downloadCombinedLedPixelMapPng(project.screens, {
          ...mapOpts,
          projectName: baseName,
        })
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export nieudany.')
    } finally {
      setExportBusy(false)
    }
  }

  const preventSubmit = (e: FormEvent) => e.preventDefault()

  if (!active) {
    return <p className="text-sm text-muted-foreground">Brak ekranów w projekcie.</p>
  }

  return (
    <div className="space-y-4">
      {!compactHeader ? null : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {project.screens.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange({ ...project, activeScreenId: s.id })}
              className={`rounded border px-2.5 py-1 text-xs ${
                s.id === active.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={addScreen}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-primary/40"
        >
          <Plus size={12} /> Dodaj ekran
        </button>
        <button
          type="button"
          onClick={duplicateActive}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-primary/40"
        >
          <Copy size={12} /> Duplikuj
        </button>
        <button
          type="button"
          onClick={removeActive}
          disabled={project.screens.length <= 1}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-red-400 hover:border-red-400/50 disabled:opacity-40"
        >
          <Trash2 size={12} /> Usuń
        </button>
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setExportMenuOpen((open) => !open)}
            disabled={exportBusy || !result.ok}
            className="inline-flex items-center gap-1.5 rounded border-2 border-primary px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Download size={14} />
            {exportBusy ? 'Generuję…' : 'Pixel mapa PNG'}
          </button>
          {exportMenuOpen ? (
            <div className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-xs hover:bg-surface-2"
                onClick={() => void onExport('active')}
              >
                <span className="font-medium">Tylko aktywny</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {active.label} — jeden PNG 1:1
                </span>
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-xs hover:bg-surface-2"
                onClick={() => void onExport('all-separate')}
              >
                <span className="font-medium">Wszystkie osobno</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {project.screens.length} plików PNG (po jednym na ekran)
                </span>
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-xs hover:bg-surface-2"
                onClick={() => void onExport('combined-canvas')}
              >
                <span className="font-medium">Pełen canvas</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  Jeden PNG — wszystkie ekrany wg pozycji na scenie
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {exportError ? (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-400">
          {exportError}
        </p>
      ) : null}

      <LedScreenCssPreview
        screens={project.screens}
        activeScreenId={active.id}
        onSelectScreen={(id) => onChange({ ...project, activeScreenId: id })}
        onMoveScreen={(id, layoutXM, layoutYM) => {
          onChange({
            ...project,
            activeScreenId: id,
            screens: project.screens.map((s) =>
              s.id === id ? { ...s, layoutXM, layoutYM } : s
            ),
          })
          if (id === active.id) {
            setLayoutXRaw(String(layoutXM))
            setLayoutYRaw(String(layoutYM))
          }
        }}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <form
          onSubmit={preventSubmit}
          className="space-y-4 rounded-lg border border-border bg-surface p-4 xl:col-span-2"
        >
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="led-label">
              Nazwa ekranu
            </label>
            <input
              id="led-label"
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={labelRaw}
              onChange={(e) => setLabelRaw(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium">Preset kabinetu</div>
            <div className="flex flex-wrap gap-1.5">
              {LED_CABINET_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={`rounded border px-2 py-1 text-xs ${
                    activePreset === preset.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="cab-w">
                Kabinet szer. mm
              </label>
              <input
                id="cab-w"
                type="text"
                inputMode="decimal"
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={cabWRaw}
                onChange={(e) => {
                  setActivePreset(null)
                  setCabWRaw(e.target.value)
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="cab-h">
                Kabinet wys. mm
              </label>
              <input
                id="cab-h"
                type="text"
                inputMode="decimal"
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={cabHRaw}
                onChange={(e) => {
                  setActivePreset(null)
                  setCabHRaw(e.target.value)
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="pitch">
                Pitch P mm
              </label>
              <input
                id="pitch"
                type="text"
                inputMode="decimal"
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={pitchRaw}
                onChange={(e) => {
                  setActivePreset(null)
                  setPitchRaw(e.target.value)
                }}
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium">Proporcja odniesienia</div>
            <div className="flex flex-wrap gap-1.5">
              {LED_ASPECT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAspectId(preset.id)}
                  className={`rounded border px-2 py-1 text-xs ${
                    aspectId === preset.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {aspectId === 'custom' ? (
              <input
                type="text"
                inputMode="decimal"
                aria-label="Własna proporcja"
                placeholder="16:9 albo 1.78"
                className="mt-2 w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums"
                value={customAspectRaw}
                onChange={(e) => setCustomAspectRaw(e.target.value)}
              />
            ) : null}
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium">Wymiary ekranu</div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['cabinets', 'Kabinety X×Y'],
                  ['meters', 'Metry W×H'],
                  ['widthAspect', 'Szer. + proporcja'],
                  ['heightAspect', 'Wys. + proporcja'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSizeMode(id)}
                  className={`rounded border px-2 py-1 text-xs ${
                    sizeMode === id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {sizeMode === 'cabinets' ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="cols">
                  Kolumny
                </label>
                <input
                  id="cols"
                  type="number"
                  min={1}
                  step={1}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={colsRaw}
                  onChange={(e) => setColsRaw(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="rows">
                  Wiersze
                </label>
                <input
                  id="rows"
                  type="number"
                  min={1}
                  step={1}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={rowsRaw}
                  onChange={(e) => setRowsRaw(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {sizeMode === 'meters' || sizeMode === 'widthAspect' ? (
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="target-w">
                Docelowa szerokość (m)
              </label>
              <input
                id="target-w"
                type="text"
                inputMode="decimal"
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={targetWRaw}
                onChange={(e) => setTargetWRaw(e.target.value)}
              />
            </div>
          ) : null}

          {sizeMode === 'meters' || sizeMode === 'heightAspect' ? (
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="target-h">
                Docelowa wysokość (m)
              </label>
              <input
                id="target-h"
                type="text"
                inputMode="decimal"
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={targetHRaw}
                onChange={(e) => setTargetHRaw(e.target.value)}
              />
            </div>
          ) : null}

          {gridFromMeters ? (
            <p className="rounded border border-border bg-background/50 px-2.5 py-2 text-xs text-muted-foreground">
              Snap do siatki: {gridFromMeters.columns}×{gridFromMeters.rows} →{' '}
              {gridFromMeters.actualWidthM} × {gridFromMeters.actualHeightM} m
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="layout-x">
                Pozycja X (m)
              </label>
              <input
                id="layout-x"
                type="text"
                inputMode="decimal"
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums"
                value={layoutXRaw}
                onChange={(e) => setLayoutXRaw(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="layout-y">
                Pozycja Y (m)
              </label>
              <input
                id="layout-y"
                type="text"
                inputMode="decimal"
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums"
                value={layoutYRaw}
                onChange={(e) => setLayoutYRaw(e.target.value)}
              />
            </div>
          </div>
        </form>

        <div className="space-y-4 rounded-lg border border-border bg-surface p-4 xl:col-span-3">
          {!result.ok ? (
            <p className="text-sm text-red-400">{result.error}</p>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Wynik — {active.label}</h2>
                <Row
                  label="Kabinety"
                  value={`${result.columns} × ${result.rows} = ${result.cabinetsTotal} szt.`}
                  emphasize
                />
                <Row label="Rozmiar" value={`${result.screenWidthM} × ${result.screenHeightM} m`} emphasize />
                <Row label="Powierzchnia" value={`${result.areaM2} m²`} />
                <Row
                  label="Piksele"
                  value={`${formatPx(result.screenPxW)} × ${formatPx(result.screenPxH)}`}
                  emphasize
                />
                <Row label="Kabinet px" value={`${result.cabinetPxW} × ${result.cabinetPxH}`} muted />
                <Row label="Proporcja" value={`${result.aspectLabel} (${result.actualRatio.toFixed(3)})`} />
              </div>

              <div className="space-y-2 rounded border border-border bg-background/40 p-3">
                <h2 className="text-sm font-semibold">Rozjazd vs proporcja docelowa</h2>
                <Row
                  label="Δ procent"
                  value={`${result.deviation.percent.toFixed(2)} %`}
                  emphasize={result.deviation.percent > 0.5}
                />
                <Row
                  label="Żeby trafić: wysokość"
                  value={
                    result.deviation.heightDeltaMm === 0
                      ? 'OK'
                      : `${result.deviation.heightDeltaMm > 0 ? '+' : ''}${formatMm(result.deviation.heightDeltaMm)}`
                  }
                />
                <Row
                  label="Żeby trafić: szerokość"
                  value={
                    result.deviation.widthDeltaMm === 0
                      ? 'OK'
                      : `${result.deviation.widthDeltaMm > 0 ? '+' : ''}${formatMm(result.deviation.widthDeltaMm)}`
                  }
                />
                {result.deviation.betterSameColumns ? (
                  <button
                    type="button"
                    onClick={() =>
                      applyBetter(
                        result.deviation.betterSameColumns!.columns,
                        result.deviation.betterSameColumns!.rows
                      )
                    }
                    className="mt-1 w-full rounded border border-border px-2.5 py-1.5 text-left text-xs hover:border-primary/40 hover:bg-primary/5"
                  >
                    Przy {result.deviation.betterSameColumns.columns} kolumnach bliżej:{' '}
                    <span className="font-medium text-primary">
                      {result.deviation.betterSameColumns.columns}×{result.deviation.betterSameColumns.rows}
                    </span>
                  </button>
                ) : null}
                {result.deviation.betterSameRows ? (
                  <button
                    type="button"
                    onClick={() =>
                      applyBetter(
                        result.deviation.betterSameRows!.columns,
                        result.deviation.betterSameRows!.rows
                      )
                    }
                    className="w-full rounded border border-border px-2.5 py-1.5 text-left text-xs hover:border-primary/40 hover:bg-primary/5"
                  >
                    Przy {result.deviation.betterSameRows.rows} wierszach bliżej:{' '}
                    <span className="font-medium text-primary">
                      {result.deviation.betterSameRows.columns}×{result.deviation.betterSameRows.rows}
                    </span>
                  </button>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground">
                Suma projektu:{' '}
                {project.screens.reduce((acc, s) => {
                  const r = calculateScreenFromSpec(s)
                  return acc + (r.ok ? r.cabinetsTotal : 0)
                }, 0)}{' '}
                kabinetów ·{' '}
                {project.screens
                  .reduce((acc, s) => {
                    const r = calculateScreenFromSpec(s)
                    return acc + (r.ok ? r.areaM2 : 0)
                  }, 0)
                  .toFixed(2)}{' '}
                m²
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
