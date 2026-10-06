import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  LED_ASPECT_PRESETS,
  LED_CABINET_PRESETS,
  calculateLedScreen,
  formatMm,
  formatPx,
  metersToCabinetGrid,
  otherSideFromAspect,
  parseAspectRatio,
  type LedAspectPresetId,
} from '../calculators/ledScreen'

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

function AspectPreview({
  widthMm,
  heightMm,
  targetRatio,
}: {
  widthMm: number
  heightMm: number
  targetRatio: number
}) {
  if (!(widthMm > 0) || !(heightMm > 0) || !(targetRatio > 0)) return null
  const box = 220
  const pad = 12
  const maxW = box - pad * 2
  const maxH = box - pad * 2
  const scale = Math.min(maxW / widthMm, maxH / heightMm)
  const w = widthMm * scale
  const h = heightMm * scale
  const idealH = widthMm / targetRatio
  const idealScale = Math.min(maxW / widthMm, maxH / Math.max(heightMm, idealH))
  const iw = widthMm * idealScale
  const ih = idealH * idealScale
  const ox = (box - Math.max(w, iw)) / 2
  const oy = (box - Math.max(h, ih)) / 2

  return (
    <svg viewBox={`0 0 ${box} ${box}`} className="h-56 w-full rounded border border-border bg-background">
      <rect
        x={ox + (Math.max(w, iw) - iw) / 2}
        y={oy + (Math.max(h, ih) - ih) / 2}
        width={iw}
        height={ih}
        fill="none"
        stroke="currentColor"
        strokeDasharray="4 3"
        className="text-muted-foreground/50"
        strokeWidth={1.5}
      />
      <rect
        x={ox + (Math.max(w, iw) - w) / 2}
        y={oy + (Math.max(h, ih) - h) / 2}
        width={w}
        height={h}
        fill="currentColor"
        className="text-primary/25"
        stroke="currentColor"
        strokeWidth={2}
      />
      <text x={box / 2} y={box - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
        pełny = ekran · przerywany = proporcja docelowa
      </text>
    </svg>
  )
}

type SizeMode = 'cabinets' | 'meters' | 'widthAspect' | 'heightAspect'

export default function LedScreenCalculatorPage({ publicMode = false }: { publicMode?: boolean }) {
  const [cabWRaw, setCabWRaw] = useState('500')
  const [cabHRaw, setCabHRaw] = useState('500')
  const [pitchRaw, setPitchRaw] = useState('2.6')
  const [colsRaw, setColsRaw] = useState('16')
  const [rowsRaw, setRowsRaw] = useState('9')
  const [targetWRaw, setTargetWRaw] = useState('8')
  const [targetHRaw, setTargetHRaw] = useState('4.5')
  const [sizeMode, setSizeMode] = useState<SizeMode>('cabinets')
  const [aspectId, setAspectId] = useState<LedAspectPresetId>('16:9')
  const [customAspectRaw, setCustomAspectRaw] = useState('16:9')
  const [activePreset, setActivePreset] = useState<string | null>('500x500-p2.6')

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

  const result = useMemo(
    () =>
      calculateLedScreen({
        cabinetWidthMm: cabinetWidthMm > 0 ? cabinetWidthMm : 0,
        cabinetHeightMm: cabinetHeightMm > 0 ? cabinetHeightMm : 0,
        pitchMm: pitchMm > 0 ? pitchMm : 0,
        columns,
        rows,
        targetRatio,
      }),
    [cabinetWidthMm, cabinetHeightMm, pitchMm, columns, rows, targetRatio]
  )

  const applyPreset = (id: string) => {
    const preset = LED_CABINET_PRESETS.find((p) => p.id === id)
    if (!preset) return
    setActivePreset(id)
    setCabWRaw(String(preset.widthMm))
    setCabHRaw(String(preset.heightMm))
    setPitchRaw(String(preset.pitchMm))
  }

  const preventSubmit = (e: FormEvent) => {
    e.preventDefault()
  }

  const applyBetter = (cols: number, rws: number) => {
    setSizeMode('cabinets')
    setColsRaw(String(cols))
    setRowsRaw(String(rws))
  }

  return (
    <div className="space-y-6">
      <div>
        {publicMode ? (
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Lama Stage · narzędzie</p>
        ) : (
          <Link
            to="/toolbox"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Toolbox
          </Link>
        )}
        <h1 className="mt-2 text-2xl font-bold">Kalkulator ekranu LED</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Kabinet + pitch → siatka, metry, piksele i rozjazd od 16:9 (albo innej proporcji). Wynik zawsze na
          całych kabinetach.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <form
          onSubmit={preventSubmit}
          className="space-y-4 rounded-lg border border-border bg-surface p-4 xl:col-span-2"
        >
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
            <div className="mb-1.5 text-xs font-medium">Jak podajesz ekran</div>
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
              {gridFromMeters.widthDeltaM !== 0 || gridFromMeters.heightDeltaM !== 0
                ? ` (Δ ${gridFromMeters.widthDeltaM >= 0 ? '+' : ''}${gridFromMeters.widthDeltaM} m × ${gridFromMeters.heightDeltaM >= 0 ? '+' : ''}${gridFromMeters.heightDeltaM} m)`
                : ''}
            </p>
          ) : null}
        </form>

        <div className="space-y-4 rounded-lg border border-border bg-surface p-4 xl:col-span-3">
          {!result.ok ? (
            <p className="text-sm text-red-400">{result.error}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Wynik</h2>
                  <Row label="Kabinety" value={`${result.columns} × ${result.rows} = ${result.cabinetsTotal} szt.`} emphasize />
                  <Row
                    label="Rozmiar"
                    value={`${result.screenWidthM} × ${result.screenHeightM} m`}
                    emphasize
                  />
                  <Row label="Powierzchnia" value={`${result.areaM2} m²`} />
                  <Row
                    label="Piksele"
                    value={`${formatPx(result.screenPxW)} × ${formatPx(result.screenPxH)}`}
                    emphasize
                  />
                  <Row
                    label="Kabinet px"
                    value={`${result.cabinetPxW} × ${result.cabinetPxH}`}
                    muted
                  />
                  <Row label="Proporcja" value={`${result.aspectLabel} (${result.actualRatio.toFixed(3)})`} />
                </div>
                <AspectPreview
                  widthMm={result.screenWidthMm}
                  heightMm={result.screenHeightMm}
                  targetRatio={targetRatio}
                />
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
                    </span>{' '}
                    (Δ {result.deviation.betterSameColumns.percent.toFixed(2)} %)
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
                    </span>{' '}
                    (Δ {result.deviation.betterSameRows.percent.toFixed(2)} %)
                  </button>
                ) : null}
                {result.deviation.percent < 0.05 ? (
                  <p className="text-xs text-muted-foreground">Układ siedzi w zadanej proporcji.</p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
