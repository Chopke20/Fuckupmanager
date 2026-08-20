import { useMemo, useState } from 'react'
import {
  STAGE_LEG_HEIGHTS_CM,
  buildStagePlan,
  claddingMaterialLabel,
  claddingSidesLabel,
  formatMeters,
  renderStagePlanSvg,
  type StageCladdingMaterial,
  type StageCladdingSides,
  type StageLegShare,
  type StageOrientation,
  type StagePlan,
} from '@lama-stage/shared-types'

export interface StagePlatformVisualizerProps {
  initialPlan?: StagePlan | null
  applyLabel?: string
  onApply?: (plan: StagePlan) => void
}

function parseDim(raw: string): number {
  const n = Number(raw.trim().replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export default function StagePlatformVisualizer({
  initialPlan = null,
  applyLabel,
  onApply,
}: StagePlatformVisualizerProps) {
  const [widthRaw, setWidthRaw] = useState(initialPlan ? String(initialPlan.requestedWidthM) : '6')
  const [depthRaw, setDepthRaw] = useState(initialPlan ? String(initialPlan.requestedDepthM) : '4')
  const [orientation, setOrientation] = useState<StageOrientation>(
    initialPlan?.orientationUsed ?? 'auto'
  )
  const [claddingMaterial, setCladdingMaterial] = useState<StageCladdingMaterial>(
    initialPlan?.claddingMaterial ?? 'skirt'
  )
  const [claddingSides, setCladdingSides] = useState<StageCladdingSides>(
    initialPlan?.claddingSides ?? 'front-sides'
  )
  const [legHeightCm, setLegHeightCm] = useState(initialPlan?.legHeightCm ?? 60)
  const [legShare, setLegShare] = useState<StageLegShare>(initialPlan?.legShare ?? 'per-deck')
  const [includeStairs, setIncludeStairs] = useState(initialPlan?.includeStairs ?? true)
  const [includeRailings, setIncludeRailings] = useState(initialPlan?.includeRailings ?? true)

  const result = useMemo(
    () =>
      buildStagePlan({
        widthM: parseDim(widthRaw),
        depthM: parseDim(depthRaw),
        orientation,
        claddingMaterial,
        claddingSides,
        legHeightCm,
        legShare,
        includeStairs,
        includeRailings,
      }),
    [
      widthRaw,
      depthRaw,
      orientation,
      claddingMaterial,
      claddingSides,
      legHeightCm,
      legShare,
      includeStairs,
      includeRailings,
    ]
  )

  const plan = 'ok' in result ? null : result
  const error = 'ok' in result ? result.error : null
  const svg = plan ? renderStagePlanSvg(plan) : ''

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <form
        className="space-y-3 rounded-lg border border-border bg-surface p-4 xl:col-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="stage-width">
              Front (szerokość) m
            </label>
            <input
              id="stage-width"
              type="text"
              inputMode="decimal"
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums"
              value={widthRaw}
              onChange={(e) => setWidthRaw(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="stage-depth">
              Głębokość m
            </label>
            <input
              id="stage-depth"
              type="text"
              inputMode="decimal"
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums"
              value={depthRaw}
              onChange={(e) => setDepthRaw(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium">Układ podestów 2×1</div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['auto', 'Auto (najmniej 1×1)'],
                ['long-along-front', '2 m wzdłuż frontu'],
                ['long-along-depth', '2 m w głąb'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOrientation(value)}
                className={`rounded border px-2 py-1 text-xs ${
                  orientation === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium">Wysokość nóg</div>
          <div className="flex flex-wrap gap-1.5">
            {STAGE_LEG_HEIGHTS_CM.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setLegHeightCm(h)}
                className={`rounded border px-2 py-1 text-xs tabular-nums ${
                  legHeightCm === h
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {h}
              </button>
            ))}
            <span className="self-center text-xs text-muted-foreground">cm</span>
          </div>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium">Nogi</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              className="mt-1"
              checked={legShare === 'per-deck'}
              onChange={() => setLegShare('per-deck')}
            />
            <span>
              4 nogi na podest
              <span className="block text-xs text-muted-foreground">Standard magazynowy — każdy blat ze swoim kompletem.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              className="mt-1"
              checked={legShare === 'shared-corners'}
              onChange={() => setLegShare('shared-corners')}
            />
            <span>
              Współdzielone narożniki
              <span className="block text-xs text-muted-foreground">Mniej nóg, jeśli spinacie ramy we wspólnych punktach.</span>
            </span>
          </label>
        </fieldset>

        <div>
          <div className="mb-1 text-xs font-medium">Obicie</div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['none', 'Brak'],
                ['skirt', 'Kotara'],
                ['hard', 'Sklejka'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCladdingMaterial(value)}
                className={`rounded border px-2 py-1 text-xs ${
                  claddingMaterial === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {claddingMaterial !== 'none' && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(
                [
                  ['front', 'Front'],
                  ['front-sides', 'Front + boki'],
                  ['all', 'Cały obwód'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCladdingSides(value)}
                  className={`rounded border px-2 py-1 text-xs ${
                    claddingSides === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeStairs} onChange={(e) => setIncludeStairs(e.target.checked)} />
          Schody na scenę
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeRailings}
            onChange={(e) => setIncludeRailings(e.target.checked)}
          />
          Barierki tył + boki
        </label>

        {onApply && (
          <button
            type="button"
            disabled={!plan}
            onClick={() => plan && onApply(plan)}
            className="w-full rounded border-2 border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {applyLabel || 'Zastosuj'}
          </button>
        )}
      </form>

      <div className="space-y-3 rounded-lg border border-border bg-surface p-4 xl:col-span-3">
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : plan ? (
          <>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Rzut z góry</div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Pokrycie {plan.widthM} × {plan.depthM} m · {plan.counts.decks2x1}× 2×1
                {plan.counts.decks1x1 ? ` · ${plan.counts.decks1x1}× 1×1` : ''} · nogi {plan.counts.legs} szt. ·{' '}
                {claddingMaterialLabel(plan.claddingMaterial)}
                {plan.claddingMeters > 0
                  ? ` ${formatMeters(plan.claddingMeters)} mb (${claddingSidesLabel(plan.claddingSides)})`
                  : ''}
              </p>
            </div>
            <div
              className="overflow-x-auto rounded border border-border bg-background p-2"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 text-left text-xs text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Pozycja</th>
                    <th className="px-2 py-1.5 font-medium text-right">Ilość</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.bom.map((line) => (
                    <tr key={line.key} className="border-t border-border/60">
                      <td className="px-2 py-1.5">{line.name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {line.quantity} {line.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {plan.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  )
}
