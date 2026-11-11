import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Copy, Download, Plus, Settings2, Trash2 } from 'lucide-react'
import {
  LED_ASPECT_PRESETS,
  LED_CABINET_PRESETS,
  calculateScreenFromSpec,
  createDefaultLedScreen,
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
import LedScreenRoleMapModal from './LedScreenRoleMapModal'
import { useEquipment } from '../../equipment/hooks/useEquipment'
import { listStagePlanRoleMaps } from '../api/stagePlanRoleMaps.api'
import {
  LED_SCREEN_CATALOG_KEY_LABELS,
  ledScreenBomLines,
} from '../utils/ledScreenPlanSet'
import {
  resolveLedScreenOrderLines,
  ledScreenApplyBlockingIssues,
} from '../utils/applyLedScreenToOrder'

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

function segmentBtn(active: boolean): string {
  return `px-2 py-1 text-xs transition-colors ${
    active
      ? 'bg-primary/15 text-primary'
      : 'text-muted-foreground hover:bg-background hover:text-foreground'
  }`
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
  compactHeader: _compactHeader,
  fillHeight = false,
  onApply,
  applyBusy = false,
  onDirtyChange,
}: {
  project: LedScreenProjectPayload
  onChange: (next: LedScreenProjectPayload) => void
  logoUrl?: string | null
  projectName?: string
  compactHeader?: boolean
  fillHeight?: boolean
  onApply?: (project: LedScreenProjectPayload) => void | Promise<void>
  applyBusy?: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  void _compactHeader
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
  const [rightTab, setRightTab] = useState<'config' | 'bom'>('config')
  const [roleMapOpen, setRoleMapOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [roleMaps, setRoleMaps] = useState<
    Array<{
      roleKey: string
      action: 'map' | 'attach' | 'skip'
      equipmentId?: string | null
      attachToRoleKey?: string | null
    }>
  >([])
  const { data: catalogPage } = useEquipment({ limit: 500 })
  const catalog = catalogPage?.data ?? []

  useEffect(() => {
    void listStagePlanRoleMaps()
      .then((maps) => setRoleMaps(maps))
      .catch(() => setRoleMaps([]))
  }, [roleMapOpen])

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

  const bom = useMemo(() => ledScreenBomLines(project), [project])
  const orderPreview = useMemo(
    () =>
      resolveLedScreenOrderLines({
        project,
        maps: roleMaps,
        catalog,
      }),
    [project, roleMaps, catalog]
  )
  const blocking = useMemo(
    () => ledScreenApplyBlockingIssues(orderPreview.issues),
    [orderPreview.issues]
  )
  const skippedCount = bom.filter((line) => {
    const mapped = orderPreview.lines.some((l) => l.catalogKey === line.catalogKey)
    if (mapped) return false
    const map = roleMaps.find((m) => m.roleKey === line.catalogKey)
    return map?.action === 'skip'
  }).length
  const needsMapping = bom.length > 0 && (roleMaps.length === 0 || blocking.length > 0)

  const applyButtonLabel = useMemo(() => {
    const lines = orderPreview.lines
    if (lines.length === 0) return 'Dodaj do zlecenia'
    if (lines.length === 1) {
      const l = lines[0]!
      return `Dodaj do zlecenia: ${l.quantity} ${l.unit === 'szt.' ? 'szt.' : l.unit}`
    }
    const screen = lines.find((l) => l.catalogKey === 'led-screen')
    if (screen) return `Dodaj do zlecenia: ${screen.quantity} m² ekranu (+ ${lines.length - 1} poz.)`
    return `Dodaj do zlecenia: ${lines.length} pozycji`
  }, [orderPreview.lines])

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
    setConfirmRemove(false)
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

  const handleApplyClick = async () => {
    if (!onApply) return
    setApplyError(null)
    let maps = roleMaps
    try {
      maps = await listStagePlanRoleMaps()
      setRoleMaps(maps)
    } catch {
      // cache
    }
    const preview = resolveLedScreenOrderLines({ project, maps, catalog })
    const block = ledScreenApplyBlockingIssues(preview.issues)
    if (block.length > 0) {
      setApplyError(
        'Nie można dodać LED — ustaw Mapowanie (ekran / stabilizacja / procesor).'
      )
      setRightTab('bom')
      return
    }
    await onApply(project)
    onDirtyChange?.(false)
  }

  const preventSubmit = (e: FormEvent) => e.preventDefault()

  if (!active) {
    return <p className="text-sm text-muted-foreground">Brak ekranów w projekcie.</p>
  }

  const projectCabinets = project.screens.reduce((acc, s) => {
    const r = calculateScreenFromSpec(s)
    return acc + (r.ok ? r.cabinetsTotal : 0)
  }, 0)
  const projectArea = project.screens.reduce((acc, s) => {
    const r = calculateScreenFromSpec(s)
    return acc + (r.ok ? r.areaM2 : 0)
  }, 0)

  const fieldLabel = 'mb-0.5 block text-[10px] text-muted-foreground'
  const fieldInput =
    'w-full rounded border border-border bg-background px-2 py-1 text-xs tabular-nums'

  const configForm = (
    <form onSubmit={preventSubmit} className="space-y-2">
      <div>
        <label className={fieldLabel} htmlFor="led-label">
          Nazwa ekranu
        </label>
        <input
          id="led-label"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={labelRaw}
          onChange={(e) => setLabelRaw(e.target.value)}
        />
      </div>

      <div>
        <div className="mb-0.5 text-[10px] text-muted-foreground">Preset kabinetu</div>
        <div className="inline-flex max-w-full flex-wrap overflow-hidden rounded-md border border-border">
          {LED_CABINET_PRESETS.map((preset, index) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={`${segmentBtn(activePreset === preset.id)} ${
                index > 0 ? 'border-l border-border' : ''
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className={fieldLabel} htmlFor="cab-w">
            Kab. szer. mm
          </label>
          <input
            id="cab-w"
            type="text"
            inputMode="decimal"
            className={fieldInput}
            value={cabWRaw}
            onChange={(e) => {
              setActivePreset(null)
              setCabWRaw(e.target.value)
            }}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="cab-h">
            Kab. wys. mm
          </label>
          <input
            id="cab-h"
            type="text"
            inputMode="decimal"
            className={fieldInput}
            value={cabHRaw}
            onChange={(e) => {
              setActivePreset(null)
              setCabHRaw(e.target.value)
            }}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="pitch">
            Pitch P mm
          </label>
          <input
            id="pitch"
            type="text"
            inputMode="decimal"
            className={fieldInput}
            value={pitchRaw}
            onChange={(e) => {
              setActivePreset(null)
              setPitchRaw(e.target.value)
            }}
          />
        </div>
      </div>

      <div>
        <div className="mb-0.5 flex items-baseline justify-between">
          <span className="text-[10px] text-muted-foreground">Proporcja</span>
          {result.ok ? (
            <span className="text-[11px] font-medium tabular-nums">{result.aspectLabel}</span>
          ) : null}
        </div>
        <div className="inline-flex max-w-full flex-wrap overflow-hidden rounded-md border border-border">
          {LED_ASPECT_PRESETS.map((preset, index) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setAspectId(preset.id)}
              className={`${segmentBtn(aspectId === preset.id)} ${
                index > 0 ? 'border-l border-border' : ''
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
            className={`mt-1.5 ${fieldInput}`}
            value={customAspectRaw}
            onChange={(e) => setCustomAspectRaw(e.target.value)}
          />
        ) : null}
      </div>

      <div>
        <div className="mb-0.5 text-[10px] text-muted-foreground">Wymiary ekranu</div>
        <div className="inline-flex max-w-full flex-wrap overflow-hidden rounded-md border border-border">
          {(
            [
              ['cabinets', 'Kabinety'],
              ['meters', 'Metry'],
              ['widthAspect', 'Szer.+prop.'],
              ['heightAspect', 'Wys.+prop.'],
            ] as const
          ).map(([id, label], index) => (
            <button
              key={id}
              type="button"
              onClick={() => setSizeMode(id)}
              className={`${segmentBtn(sizeMode === id)} ${index > 0 ? 'border-l border-border' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {sizeMode === 'cabinets' ? (
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className={fieldLabel} htmlFor="cols">
              Kolumny
            </label>
            <input
              id="cols"
              type="number"
              min={1}
              step={1}
              className={fieldInput}
              value={colsRaw}
              onChange={(e) => setColsRaw(e.target.value)}
            />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="rows">
              Wiersze
            </label>
            <input
              id="rows"
              type="number"
              min={1}
              step={1}
              className={fieldInput}
              value={rowsRaw}
              onChange={(e) => setRowsRaw(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {sizeMode === 'meters' ? (
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className={fieldLabel} htmlFor="target-w">
              Szerokość (m)
            </label>
            <input
              id="target-w"
              type="text"
              inputMode="decimal"
              className={fieldInput}
              value={targetWRaw}
              onChange={(e) => setTargetWRaw(e.target.value)}
            />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="target-h">
              Wysokość (m)
            </label>
            <input
              id="target-h"
              type="text"
              inputMode="decimal"
              className={fieldInput}
              value={targetHRaw}
              onChange={(e) => setTargetHRaw(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {sizeMode === 'widthAspect' ? (
        <div>
          <label className={fieldLabel} htmlFor="target-w">
            Docelowa szerokość (m)
          </label>
          <input
            id="target-w"
            type="text"
            inputMode="decimal"
            className={fieldInput}
            value={targetWRaw}
            onChange={(e) => setTargetWRaw(e.target.value)}
          />
        </div>
      ) : null}

      {sizeMode === 'heightAspect' ? (
        <div>
          <label className={fieldLabel} htmlFor="target-h">
            Docelowa wysokość (m)
          </label>
          <input
            id="target-h"
            type="text"
            inputMode="decimal"
            className={fieldInput}
            value={targetHRaw}
            onChange={(e) => setTargetHRaw(e.target.value)}
          />
        </div>
      ) : null}

      {gridFromMeters ? (
        <p className="rounded border border-border bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">
          Snap: {gridFromMeters.columns}×{gridFromMeters.rows} → {gridFromMeters.actualWidthM} ×{' '}
          {gridFromMeters.actualHeightM} m
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className={fieldLabel} htmlFor="layout-x">
            Pozycja X (m)
          </label>
          <input
            id="layout-x"
            type="text"
            inputMode="decimal"
            className={fieldInput}
            value={layoutXRaw}
            onChange={(e) => setLayoutXRaw(e.target.value)}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="layout-y">
            Pozycja Y (m)
          </label>
          <input
            id="layout-y"
            type="text"
            inputMode="decimal"
            className={fieldInput}
            value={layoutYRaw}
            onChange={(e) => setLayoutYRaw(e.target.value)}
          />
        </div>
      </div>

      {result.ok && result.deviation.percent > 0.5 ? (
        <div className="space-y-1 rounded border border-warning/30 bg-warning/5 p-2 text-xs">
          <Row
            label="Δ proporcji"
            value={`${result.deviation.percent.toFixed(2)} %`}
            emphasize
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
              className="w-full rounded border border-border px-2 py-1 text-left text-[11px] hover:border-primary/40"
            >
              Bliżej przy {result.deviation.betterSameColumns.columns}×
              {result.deviation.betterSameColumns.rows}
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  )

  const bomPanel = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">Rozpiska LED</span>
        <button
          type="button"
          onClick={() => setRoleMapOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium ${
            needsMapping
              ? 'border-warning bg-warning/15 text-warning'
              : 'border-primary/50 bg-primary/10 text-primary'
          }`}
        >
          <Settings2 size={14} />
          Mapowanie
          {needsMapping ? ' · ustaw' : ''}
        </button>
      </div>
      {needsMapping ? (
        <p className="rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
          Ustaw mapowanie ekranu / stabilizacji / procesora przed dodaniem do zlecenia.
        </p>
      ) : null}
      {bom.length === 0 ? (
        <p className="text-xs text-muted-foreground">Dodaj ekran, żeby zobaczyć rozpiskę.</p>
      ) : (
        <div className="overflow-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">Pozycja</th>
                <th className="w-20 whitespace-nowrap px-2 py-1.5 text-right font-medium">Ilość</th>
                <th className="px-2 py-1.5 font-medium">W zleceniu</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((line) => {
                const mapped = orderPreview.lines.find((l) => l.catalogKey === line.catalogKey)
                const map = roleMaps.find((m) => m.roleKey === line.catalogKey)
                const skipped = map?.action === 'skip'
                return (
                  <tr key={line.catalogKey} className="border-t border-border/60">
                    <td className="px-2 py-1.5">
                      {line.name}
                      <div className="text-[10px] text-muted-foreground">
                        {LED_SCREEN_CATALOG_KEY_LABELS[line.catalogKey] ?? line.catalogKey}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                      {line.quantity}&nbsp;{line.unit}
                    </td>
                    <td className="px-2 py-1.5 text-xs">
                      {mapped ? (
                        <span className="text-primary">
                          ✓ w zleceniu
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            {mapped.equipment.name}
                          </span>
                        </span>
                      ) : skipped ? (
                        <span className="text-muted-foreground/70">tylko plan</span>
                      ) : (
                        <span className="text-warning">— brak mapowania</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div
      className={`grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] xl:items-stretch ${
        fillHeight ? 'h-full min-h-0 overflow-hidden' : ''
      }`}
    >
      <section
        className={`flex flex-col gap-1.5 rounded-lg border border-border/80 bg-background/50 p-2.5 ${
          fillHeight ? 'h-full min-h-0 overflow-hidden' : ''
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold">Scena</span>
          {project.screens.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange({ ...project, activeScreenId: s.id })}
              className={`rounded border px-2 py-1 text-xs ${
                s.id === active.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={addScreen}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs"
          >
            <Plus size={12} /> Dodaj
          </button>
          <button
            type="button"
            onClick={duplicateActive}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs"
          >
            <Copy size={12} /> Duplikuj
          </button>
          {confirmRemove ? (
            <span className="flex items-center gap-1 text-[11px]">
              <span className="text-muted-foreground">Usunąć {active.label}?</span>
              <button
                type="button"
                className="rounded border border-red-500/50 px-1.5 py-0.5 text-red-400"
                onClick={removeActive}
              >
                Tak
              </button>
              <button
                type="button"
                className="rounded border border-border px-1.5 py-0.5"
                onClick={() => setConfirmRemove(false)}
              >
                Nie
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              disabled={project.screens.length <= 1}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-red-400 disabled:opacity-40"
            >
              <Trash2 size={12} /> Usuń
            </button>
          )}
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={exportBusy || !result.ok}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
            >
              <Download size={14} />
              {exportBusy ? '…' : 'PNG'}
            </button>
            {exportMenuOpen ? (
              <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-background"
                  onClick={() => void onExport('active')}
                >
                  Tylko aktywny
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-background"
                  onClick={() => void onExport('all-separate')}
                >
                  Wszystkie osobno
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-background"
                  onClick={() => void onExport('combined-canvas')}
                >
                  Pełen canvas
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {exportError ? (
          <p className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-400">
            {exportError}
          </p>
        ) : null}

        <div
          className={`relative overflow-hidden rounded-md border border-border bg-background ${
            fillHeight ? 'min-h-0 flex-1' : 'h-[380px] min-h-[240px]'
          }`}
        >
          <LedScreenCssPreview
            fillContainer
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
        </div>
        <p className="shrink-0 text-[11px] text-foreground/80">
          Przeciągaj ekrany · snap 0,25 m · etykieta: rozmiar / siatka / pitch
        </p>
      </section>

      <aside
        className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface ${
          fillHeight ? 'h-full' : ''
        }`}
      >
        <div className="shrink-0 border-b border-border px-2.5 py-1.5 text-[11px] tabular-nums">
          {result.ok ? (
            <>
              <span className="font-medium">
                {result.screenWidthM}×{result.screenHeightM} m
              </span>
              <span className="text-muted-foreground"> · </span>
              {result.areaM2} m²
              <span className="text-muted-foreground"> · </span>
              {result.columns}×{result.rows}
              <span className="text-muted-foreground"> · </span>
              {formatPx(result.screenPxW)}×{formatPx(result.screenPxH)} px
            </>
          ) : (
            <span className="text-red-400">{result.error}</span>
          )}
          <div className="text-[10px] text-muted-foreground">
            Projekt: {projectCabinets} kab. · {projectArea.toFixed(2)} m² · {project.screens.length}{' '}
            ekr.
          </div>
        </div>

        <div className="flex shrink-0 border-b border-border">
          <button
            type="button"
            className={`flex-1 px-2.5 py-1.5 text-xs font-medium ${
              rightTab === 'config'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
            onClick={() => setRightTab('config')}
          >
            Konfiguracja
          </button>
          <button
            type="button"
            className={`flex-1 px-2.5 py-1.5 text-xs font-medium ${
              rightTab === 'bom'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
            onClick={() => setRightTab('bom')}
          >
            Rozpiska ({bom.length})
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5">
          {rightTab === 'config' ? configForm : bomPanel}
        </div>

        {onApply ? (
          <div className="shrink-0 space-y-1.5 border-t border-border bg-surface px-2.5 py-2 shadow-[0_-6px_16px_rgba(0,0,0,0.2)]">
            <div className="rounded border border-border bg-background/70 px-2 py-1.5 text-[11px]">
              <div className="mb-0.5 font-medium">Po zastosowaniu</div>
              {orderPreview.lines.length === 0 ? (
                <p className="text-muted-foreground">Brak pozycji — ustaw Mapowanie.</p>
              ) : (
                <ul className="max-h-[4.5rem] space-y-0.5 overflow-y-auto overscroll-contain">
                  {orderPreview.lines.map((line) => (
                    <li key={line.catalogKey} className="flex justify-between gap-2">
                      <span className="truncate">{line.equipment.name}</span>
                      <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {line.quantity} {line.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {skippedCount > 0 ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Pominięte: {skippedCount} (tylko plan)
                </p>
              ) : null}
              {needsMapping ? (
                <p className="mt-0.5 text-[10px] text-warning">Brak mapowania części pozycji</p>
              ) : null}
            </div>
            {applyError ? (
              <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                {applyError}
              </p>
            ) : null}
            <button
              type="button"
              disabled={applyBusy || project.screens.length === 0}
              onClick={() => void handleApplyClick()}
              className="w-full rounded border-2 border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {applyBusy ? 'Zapis…' : applyButtonLabel}
            </button>
          </div>
        ) : null}
      </aside>

      <LedScreenRoleMapModal
        open={roleMapOpen}
        project={project}
        onClose={() => setRoleMapOpen(false)}
        onSaved={() => {
          void listStagePlanRoleMaps()
            .then(setRoleMaps)
            .catch(() => undefined)
        }}
      />
    </div>
  )
}
