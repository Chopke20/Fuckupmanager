import { useState } from 'react'
import { Copy, Redo2, RotateCw, Trash2, Undo2 } from 'lucide-react'
import {
  claddingMaterialLabel,
  clampStairWidth,
  edgeSideLabel,
  floorMaterialLabel,
  formatMeters,
  isEdgeSelected,
  toggleSideInSelection,
  STAGE_EDGE_SIDES,
  STAGE_GRID_STEPS_M,
  STAGE_LEG_HEIGHTS_CM,
  STAGE_MAGNET_M,
  type StageCladdingMaterial,
  type StageEdgeSide,
  type StageFloorMaterial,
  type StagePlan,
} from '@lama-stage/shared-types'
import StagePlanCanvas, { type StagePlanTool } from './StagePlanCanvas'
import { useStagePlanEditor } from '../hooks/useStagePlanEditor'

export interface StagePlatformVisualizerProps {
  initialPlan?: StagePlan | null
  applyLabel?: string
  onApply?: (plan: StagePlan) => void
}

const TOOLS: Array<{ id: StagePlanTool; label: string; hint: string }> = [
  { id: 'select', label: 'Zaznacz', hint: 'Klikaj i przeciągaj podesty' },
  { id: 'deck-2x1', label: '+ 2×1', hint: 'Klik na rzucie stawia blat 2×1' },
  { id: 'deck-1x1', label: '+ 1×1', hint: 'Klik na rzucie stawia blat 1×1' },
  { id: 'stairs', label: '+ Schody', hint: 'Klik w krawędź dostawia bieg schodów' },
  { id: 'cladding', label: 'Obicie', hint: 'Klik w krawędź włącza lub wyłącza obicie' },
  { id: 'railings', label: 'Barierki', hint: 'Klik w krawędź włącza lub wyłącza barierkę' },
]

function parseDim(raw: string): number {
  const value = Number(raw.trim().replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(value) ? value : NaN
}

function pillClass(active: boolean): string {
  return `rounded border px-2 py-1 text-xs ${
    active
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border text-muted-foreground hover:text-foreground'
  }`
}

export default function StagePlatformVisualizer({
  initialPlan = null,
  applyLabel,
  onApply,
}: StagePlatformVisualizerProps) {
  const editor = useStagePlanEditor(initialPlan)
  const [tool, setTool] = useState<StagePlanTool>('select')
  const [rectWidth, setRectWidth] = useState('6')
  const [rectDepth, setRectDepth] = useState('4')
  const [rectAlongFront, setRectAlongFront] = useState(true)
  const { plan } = editor

  const activeTool = TOOLS.find((item) => item.id === tool)
  const hasSelection = editor.selectedDeckIds.length > 0

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="space-y-3 xl:col-span-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTool(item.id)}
              className={pillClass(tool === item.id)}
              title={item.hint}
            >
              {item.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={editor.undo}
            disabled={!editor.canUndo}
            className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            title="Cofnij (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={editor.redo}
            disabled={!editor.canRedo}
            className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            title="Ponów (Ctrl+Shift+Z)"
          >
            <Redo2 size={14} />
          </button>
          <button
            type="button"
            onClick={editor.rotateSelected}
            disabled={!hasSelection}
            className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            title="Obróć o 90° (R)"
          >
            <RotateCw size={14} />
          </button>
          <button
            type="button"
            onClick={editor.duplicateSelected}
            disabled={!hasSelection}
            className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            title="Duplikuj (Ctrl+D)"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={editor.deleteSelected}
            disabled={!hasSelection && !editor.selectedStairId}
            className="rounded border border-border p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
            title="Usuń (Delete)"
          >
            <Trash2 size={14} />
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={() => editor.patch({ snapToGrid: !plan.snapToGrid })}
            className={pillClass(plan.snapToGrid)}
            title={
              plan.snapToGrid
                ? 'Siatka włączona — blaty łapią się do kroku'
                : `Siatka wyłączona — blaty dociągane do sąsiada w promieniu ${Math.round(STAGE_MAGNET_M * 100)} cm`
            }
          >
            Siatka
          </button>
          {STAGE_GRID_STEPS_M.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => editor.patch({ gridStepM: step, snapToGrid: true })}
              className={pillClass(plan.snapToGrid && plan.gridStepM === step)}
            >
              {formatMeters(step)} m
            </button>
          ))}
        </div>

        <StagePlanCanvas editor={editor} tool={tool} />

        <p className="text-xs text-muted-foreground">
          {activeTool?.hint}. Skróty: <span className="text-foreground">R</span> obrót,{' '}
          <span className="text-foreground">Del</span> usuń,{' '}
          <span className="text-foreground">Ctrl+D</span> duplikat,{' '}
          <span className="text-foreground">Ctrl+Z</span> cofnij, strzałki przesuwają o krok
          siatki. Shift + klik zaznacza wiele blatów.
        </p>

        {plan.warnings.length > 0 ? (
          <ul className="space-y-1 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-end gap-2 rounded border border-border bg-surface p-3">
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="stage-rect-width">
              Front m
            </label>
            <input
              id="stage-rect-width"
              type="text"
              inputMode="decimal"
              className="w-16 rounded border border-border bg-background px-2 py-1 text-sm tabular-nums"
              value={rectWidth}
              onChange={(event) => setRectWidth(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="stage-rect-depth">
              Głębokość m
            </label>
            <input
              id="stage-rect-depth"
              type="text"
              inputMode="decimal"
              className="w-16 rounded border border-border bg-background px-2 py-1 text-sm tabular-nums"
              value={rectDepth}
              onChange={(event) => setRectDepth(event.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setRectAlongFront((value) => !value)}
            className={pillClass(false)}
            title="Kierunek dłuższego boku blatów 2×1"
          >
            {rectAlongFront ? '2 m wzdłuż frontu' : '2 m w głąb'}
          </button>
          <button
            type="button"
            onClick={() =>
              editor.fillRect(parseDim(rectWidth), parseDim(rectDepth), rectAlongFront)
            }
            className="rounded border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Ułóż prostokąt
          </button>
          <button
            type="button"
            onClick={editor.clearAll}
            className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
          >
            Wyczyść rzut
          </button>
          <p className="w-full text-xs text-muted-foreground">
            Prostokąt to punkt startowy — dalej dostawiaj i przesuwaj blaty ręcznie, żeby
            zrobić kształt nieregularny.
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-surface p-4 xl:col-span-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="Gabaryt" value={`${plan.widthM} × ${plan.depthM} m`} />
          <Metric label="Powierzchnia" value={`${formatMeters(plan.areaM2)} m²`} />
          <Metric
            label="Podesty"
            value={`${plan.counts.decksTotal} szt. (${plan.counts.decks2x1}× 2×1, ${plan.counts.decks1x1}× 1×1)`}
          />
          <Metric label="Nogi" value={`${plan.counts.legs} szt.`} />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium">Wysokość nóg</div>
          <div className="flex flex-wrap gap-1.5">
            {STAGE_LEG_HEIGHTS_CM.map((height) => (
              <button
                key={height}
                type="button"
                onClick={() => editor.patch({ legHeightCm: height })}
                className={`${pillClass(plan.legHeightCm === height)} tabular-nums`}
              >
                {height}
              </button>
            ))}
            <span className="self-center text-xs text-muted-foreground">cm</span>
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium">
            Obicie boków
            {plan.claddingMb > 0 ? (
              <span className="ml-1 font-normal text-muted-foreground">
                {formatMeters(plan.claddingMb)} mb · {formatMeters(plan.claddingM2)} m²
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['none', 'skirt', 'hips'] as StageCladdingMaterial[]).map((material) => (
              <button
                key={material}
                type="button"
                onClick={() => editor.patch({ claddingMaterial: material })}
                className={pillClass(plan.claddingMaterial === material)}
              >
                {claddingMaterialLabel(material)}
              </button>
            ))}
          </div>
          {plan.claddingMaterial !== 'none' ? (
            <SideToggles
              plan={plan}
              target="cladding"
              onToggle={(side) =>
                editor.patch({
                  cladding: toggleSideInSelection(plan.cladding, side, plan.edges),
                })
              }
            />
          ) : null}
        </div>

        <div>
          <div className="mb-1 text-xs font-medium">
            Podłoga
            {plan.floorMaterial !== 'none' && plan.areaM2 > 0 ? (
              <span className="ml-1 font-normal text-muted-foreground">
                {formatMeters(plan.areaM2)} m²
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['none', 'carpet', 'hips'] as StageFloorMaterial[]).map((material) => (
              <button
                key={material}
                type="button"
                onClick={() => editor.patch({ floorMaterial: material })}
                className={pillClass(plan.floorMaterial === material)}
              >
                {floorMaterialLabel(material)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium">
            Barierki
            {plan.railingMb > 0 ? (
              <span className="ml-1 font-normal text-muted-foreground">
                {formatMeters(plan.railingMb)} mb
              </span>
            ) : null}
          </div>
          <SideToggles
            plan={plan}
            target="railings"
            onToggle={(side) =>
              editor.patch({
                railings: toggleSideInSelection(plan.railings, side, plan.edges),
              })
            }
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium">
            Schody
            <span className="ml-1 font-normal text-muted-foreground">
              {plan.stairs.length === 0
                ? 'brak — narzędziem „+ Schody” klikaj w krawędzie'
                : `${plan.stairs.length} × ${plan.counts.stepsPerStair} stopni`}
            </span>
          </div>
          {plan.stairs.length > 0 ? (
            <ul className="space-y-1">
              {plan.stairs.map((stair, index) => (
                <li
                  key={stair.id}
                  className={`flex items-center gap-2 rounded border px-2 py-1 text-xs ${
                    editor.selectedStairId === stair.id
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => editor.selectStair(stair.id)}
                    className="flex-1 text-left text-muted-foreground hover:text-foreground"
                  >
                    {index + 1}. {edgeSideLabel(stair.side)} ·{' '}
                    {formatMeters(stair.posM)} m
                  </button>
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    max="4"
                    value={stair.widthM}
                    onChange={(event) => {
                      const widthM = clampStairWidth(Number(event.target.value))
                      editor.commit((prev) => ({
                        ...prev,
                        stairs: prev.stairs.map((item) =>
                          item.id === stair.id ? { ...item, widthM } : item
                        ),
                      }))
                    }}
                    className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-right tabular-nums"
                    aria-label="Szerokość biegu w metrach"
                  />
                  <span className="text-muted-foreground">m</span>
                  <button
                    type="button"
                    onClick={() =>
                      editor.commit((prev) => ({
                        ...prev,
                        stairs: prev.stairs.filter((item) => item.id !== stair.id),
                      }))
                    }
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Usuń bieg schodów"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-xs text-muted-foreground">
                <th className="px-2 py-1.5 font-medium">Pozycja</th>
                <th className="px-2 py-1.5 text-right font-medium">Ilość</th>
              </tr>
            </thead>
            <tbody>
              {plan.bom.map((line) => (
                <tr key={line.key} className="border-t border-border/60">
                  <td className="px-2 py-1.5">{line.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatMeters(line.quantity)} {line.unit}
                  </td>
                </tr>
              ))}
              {plan.bom.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-xs text-muted-foreground" colSpan={2}>
                    Ułóż podesty na rzucie, żeby zobaczyć wykaz.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {plan.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>

        {onApply ? (
          <button
            type="button"
            disabled={plan.counts.decksTotal === 0}
            onClick={() => onApply(plan)}
            className="w-full rounded border-2 border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {applyLabel || 'Zastosuj'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-background px-2 py-1.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="tabular-nums">{value}</div>
    </div>
  )
}

function SideToggles({
  plan,
  target,
  onToggle,
}: {
  plan: StagePlan
  target: 'cladding' | 'railings'
  onToggle: (side: StageEdgeSide) => void
}) {
  const selection = target === 'cladding' ? plan.cladding : plan.railings
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {STAGE_EDGE_SIDES.map((side) => {
        const sideEdges = plan.edges.filter((edge) => edge.side === side)
        const active = sideEdges.some((edge) => isEdgeSelected(selection, edge))
        const partial =
          active && sideEdges.some((edge) => !isEdgeSelected(selection, edge))
        return (
          <button
            key={side}
            type="button"
            onClick={() => onToggle(side)}
            className={pillClass(active)}
            title={
              sideEdges.length === 0
                ? 'Ta strona nie ma krawędzi w tym układzie'
                : 'Klik przełącza całą stronę; pojedyncze krawędzie klikasz na rzucie'
            }
          >
            {edgeSideLabel(side)}
            {partial ? ' ·' : ''}
          </button>
        )
      })}
    </div>
  )
}
