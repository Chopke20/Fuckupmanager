import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Copy, Redo2, RotateCw, Trash2, Undo2 } from 'lucide-react'
import {
  claddingMaterialLabel,
  clampStageDeckSizeM,
  clampStairWidth,
  deckHeightCm,
  edgeSideLabel,
  floorMaterialLabel,
  formatMeters,
  isEdgeSelected,
  toggleSideInSelection,
  STAGE_EDGE_SIDES,
  STAGE_GRID_STEPS_M,
  STAGE_LEG_HEIGHTS_CM,
  STAGE_MAGNET_M,
  STAGE_PLAN_MAX_CUSTOM_M,
  STAGE_PLAN_MIN_CUSTOM_M,
  type StageCladdingMaterial,
  type StageEdgeSide,
  type StageFloorMaterial,
  type StagePlan,
} from '@lama-stage/shared-types'
import StagePlanCanvas, { type StagePlanTool } from './StagePlanCanvas'
import StageBomCatalogTable from './StageBomCatalogTable'
import { useStagePlanEditor } from '../hooks/useStagePlanEditor'
import { useEquipment } from '../../equipment/hooks/useEquipment'
import { listStagePlanRoleMaps } from '../api/stagePlanRoleMaps.api'
import {
  resolveStagePlanOrderLines,
  stagePlanApplyBlockingIssues,
} from '../utils/applyStagePlanToOrder'

export interface StagePlatformVisualizerProps {
  initialPlan?: StagePlan | null
  applyLabel?: string
  onApply?: (plan: StagePlan) => void
  onPlanChange?: (plan: StagePlan) => void
}

const PLACE_TOOLS: Array<{ id: StagePlanTool; label: string; hint: string }> = [
  { id: 'deck-2x1', label: '2×1', hint: 'Klik na rzucie stawia blat 2×1' },
  { id: 'deck-1x1', label: '1×1', hint: 'Klik na rzucie stawia blat 1×1' },
  { id: 'deck-0.5x2', label: '0,5×2', hint: 'Klik na rzucie stawia blat 0,5×2' },
  { id: 'deck-custom', label: 'W×D', hint: 'Klik stawia blat o wpisanych wymiarach' },
]

const EDGE_TOOLS: Array<{ id: StagePlanTool; label: string; hint: string }> = [
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

function ToolGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">
        {label}
      </span>
      {children}
    </div>
  )
}

export default function StagePlatformVisualizer({
  initialPlan = null,
  applyLabel,
  onApply,
  onPlanChange,
}: StagePlatformVisualizerProps) {
  const editor = useStagePlanEditor(initialPlan)
  const [tool, setTool] = useState<StagePlanTool>('select')
  const [rectWidth, setRectWidth] = useState('6')
  const [rectDepth, setRectDepth] = useState('4')
  const [rectAlongFront, setRectAlongFront] = useState(true)
  const [customWidth, setCustomWidth] = useState('0,5')
  const [customDepth, setCustomDepth] = useState('2')
  const { plan } = editor
  const skipInitialPlanChangeRef = useRef(true)
  const customDeckSize = {
    w: clampStageDeckSizeM(parseDim(customWidth) || 0.5),
    h: clampStageDeckSizeM(parseDim(customDepth) || 2),
  }
  const selectedHeights = editor.selectedDeckIds
    .map((id) => plan.decks.find((deck) => deck.id === id))
    .filter((deck): deck is NonNullable<typeof deck> => Boolean(deck))
    .map((deck) => deckHeightCm(deck, plan.legHeightCm))
  const selectedHeight =
    selectedHeights.length > 0 && selectedHeights.every((h) => h === selectedHeights[0])
      ? selectedHeights[0]!
      : null
  const { data: catalogPage } = useEquipment({ limit: 500 })
  const catalog = catalogPage?.data ?? []
  const [roleMaps, setRoleMaps] = useState<
    Array<{
      roleKey: string
      action: 'map' | 'attach' | 'skip'
      equipmentId?: string | null
      attachToRoleKey?: string | null
    }>
  >([])

  useEffect(() => {
    void listStagePlanRoleMaps()
      .then((maps) => setRoleMaps(maps))
      .catch(() => setRoleMaps([]))
  }, [])

  useEffect(() => {
    if (skipInitialPlanChangeRef.current) {
      skipInitialPlanChangeRef.current = false
      return
    }
    onPlanChange?.(plan)
  }, [plan, onPlanChange])

  const activeHint =
    tool === 'select'
      ? 'Przesuwaj blaty; Shift+klik zaznacza wiele. Wysokość ustawiasz po zaznaczeniu.'
      : tool === 'stairs'
        ? 'Klik w krawędź dostawia bieg schodów.'
        : PLACE_TOOLS.find((item) => item.id === tool)?.hint ||
          EDGE_TOOLS.find((item) => item.id === tool)?.hint ||
          ''
  const hasSelection = editor.selectedDeckIds.length > 0

  const handleApplyClick = useCallback(async () => {
    if (!onApply) return
    let maps = roleMaps
    try {
      maps = await listStagePlanRoleMaps()
      setRoleMaps(maps)
    } catch {
      // użyj cache
    }
    const { issues } = resolveStagePlanOrderLines({
      plan,
      maps,
      catalog,
    })
    const blocking = stagePlanApplyBlockingIssues(issues)
    if (blocking.length > 0) {
      window.alert(
        `Nie można dodać do zlecenia — popraw mapowanie (zębatka przy rozpisce):\n` +
          blocking
            .slice(0, 8)
            .map((issue) => {
              if (issue.kind === 'unmapped') return `• brak mapowania: ${issue.line.catalogKey}`
              if (issue.kind === 'duplicate_equipment')
                return `• ten sam sprzęt dla: ${issue.catalogKeys.join(', ')}`
              return `• mapowanie bez sprzętu: ${issue.line.catalogKey}`
            })
            .join('\n')
      )
      return
    }
    onApply(plan)
  }, [catalog, onApply, plan, roleMaps])

  const deckBreakdown = [
    plan.counts.decks2x1 ? `${plan.counts.decks2x1}×2×1` : null,
    plan.counts.decks1x1 ? `${plan.counts.decks1x1}×1×1` : null,
    plan.counts.decks05x2 ? `${plan.counts.decks05x2}×0,5×2` : null,
    plan.counts.decksCustom ? `${plan.counts.decksCustom}×W×D` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
      {/* LEWA — projektowanie */}
      <section className="space-y-3 rounded-lg border border-border bg-surface/40 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">Rzut</h3>
          <p className="text-[11px] text-muted-foreground">{activeHint}</p>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border/80 bg-background/60 px-2.5 py-2">
          <div>
            <label className="mb-0.5 block text-[10px] text-muted-foreground" htmlFor="stage-rect-width">
              Front m
            </label>
            <input
              id="stage-rect-width"
              type="text"
              inputMode="decimal"
              className="w-14 rounded border border-border bg-background px-2 py-1 text-sm tabular-nums"
              value={rectWidth}
              onChange={(event) => setRectWidth(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-muted-foreground" htmlFor="stage-rect-depth">
              Głęb. m
            </label>
            <input
              id="stage-rect-depth"
              type="text"
              inputMode="decimal"
              className="w-14 rounded border border-border bg-background px-2 py-1 text-sm tabular-nums"
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
            onClick={() => editor.fillRect(parseDim(rectWidth), parseDim(rectDepth), rectAlongFront)}
            className="rounded border border-primary px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Ułóż prostokąt
          </button>
          <button
            type="button"
            onClick={editor.clearAll}
            className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
          >
            Wyczyść
          </button>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border/80 bg-background/40 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ToolGroup label="Tryb">
              <button
                type="button"
                onClick={() => setTool('select')}
                className={pillClass(tool === 'select')}
                title="Zaznaczanie i przesuwanie"
              >
                Zaznacz
              </button>
            </ToolGroup>

            <ToolGroup label="Dodaj">
              {PLACE_TOOLS.map((item) => (
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
              <button
                type="button"
                onClick={() => setTool('stairs')}
                className={pillClass(tool === 'stairs')}
                title="Klik w krawędź dostawia bieg schodów"
              >
                Schody
              </button>
            </ToolGroup>

            <ToolGroup label="Krawędź">
              {EDGE_TOOLS.map((item) => (
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
            </ToolGroup>

            <div className="ml-auto flex items-center gap-1">
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
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-1.5">
            <ToolGroup label="Siatka">
              <button
                type="button"
                onClick={() => editor.patch({ snapToGrid: !plan.snapToGrid })}
                className={pillClass(plan.snapToGrid)}
                title={
                  plan.snapToGrid
                    ? 'Siatka włączona'
                    : `Wyłączona — magnet ${Math.round(STAGE_MAGNET_M * 100)} cm`
                }
              >
                {plan.snapToGrid ? 'On' : 'Off'}
              </button>
              {STAGE_GRID_STEPS_M.map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => editor.patch({ gridStepM: step, snapToGrid: true })}
                  className={pillClass(plan.snapToGrid && plan.gridStepM === step)}
                >
                  {formatMeters(step)}
                </button>
              ))}
            </ToolGroup>

            {tool === 'deck-custom' ? (
              <span className="ml-1 flex items-center gap-1.5">
                <label className="text-[10px] text-muted-foreground">
                  W
                  <input
                    type="text"
                    inputMode="decimal"
                    className="ml-1 w-12 rounded border border-border bg-background px-1.5 py-1 text-xs tabular-nums"
                    value={customWidth}
                    onChange={(event) => setCustomWidth(event.target.value)}
                    title={`Szerokość ${STAGE_PLAN_MIN_CUSTOM_M}–${STAGE_PLAN_MAX_CUSTOM_M} m`}
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  D
                  <input
                    type="text"
                    inputMode="decimal"
                    className="ml-1 w-12 rounded border border-border bg-background px-1.5 py-1 text-xs tabular-nums"
                    value={customDepth}
                    onChange={(event) => setCustomDepth(event.target.value)}
                    title={`Głębokość ${STAGE_PLAN_MIN_CUSTOM_M}–${STAGE_PLAN_MAX_CUSTOM_M} m`}
                  />
                </label>
                <span className="text-[10px] text-muted-foreground">m</span>
              </span>
            ) : null}
          </div>
        </div>

        {hasSelection ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2">
            <span className="text-xs font-medium text-foreground">
              Wysokość zaznaczonych
              <span className="ml-1 font-normal text-muted-foreground">
                ({editor.selectedDeckIds.length})
              </span>
            </span>
            {STAGE_LEG_HEIGHTS_CM.map((height) => (
              <button
                key={`sel-h-${height}`}
                type="button"
                onClick={() => editor.setSelectedDeckHeight(height)}
                className={`${pillClass(selectedHeight === height)} tabular-nums`}
              >
                {height}
              </button>
            ))}
            <button
              type="button"
              onClick={() => editor.setSelectedDeckHeight(null)}
              className={pillClass(false)}
              title="Użyj domyślnej wysokości z prawej kolumny"
            >
              jak domyślna
            </button>
            <span className="text-[11px] text-muted-foreground">cm · na rzucie pod wymiarem</span>
          </div>
        ) : null}

        <StagePlanCanvas
          editor={editor}
          tool={tool}
          customDeckSize={customDeckSize}
          onToolDone={() => setTool('select')}
        />

        <p className="text-[11px] text-muted-foreground">
          <span className="text-foreground/80">R</span> obrót ·{' '}
          <span className="text-foreground/80">Del</span> usuń ·{' '}
          <span className="text-foreground/80">Ctrl+D</span> duplikat ·{' '}
          <span className="text-foreground/80">Ctrl+Z</span> cofnij · strzałki = krok siatki
        </p>

        {plan.warnings.length > 0 ? (
          <ul className="space-y-1 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* PRAWA — opcje + overview */}
      <aside className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <div>
          <h3 className="mb-2 text-sm font-semibold tracking-tight">Podsumowanie</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Metric label="Gabaryt" value={`${plan.widthM} × ${plan.depthM} m`} />
            <Metric label="Powierzchnia" value={`${formatMeters(plan.areaM2)} m²`} />
            <Metric
              label="Podesty"
              value={`${plan.counts.decksTotal} szt.${deckBreakdown ? ` · ${deckBreakdown}` : ''}`}
            />
            <Metric label="Nogi" value={`${plan.counts.legs} szt.`} />
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-sm font-semibold tracking-tight">Opcje</h3>

          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium">Domyślna wysokość nóg</div>
              <div className="flex flex-wrap gap-1">
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
                <span className="self-center text-[11px] text-muted-foreground">cm</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Pojedyncze blaty: zaznacz na rzucie i ustaw wysokość po lewej.
              </p>
            </div>

            <div>
              <div className="mb-1 text-xs font-medium">
                Obicie
                {plan.claddingMb > 0 ? (
                  <span className="ml-1 font-normal text-muted-foreground">
                    {formatMeters(plan.claddingMb)} mb · {formatMeters(plan.claddingM2)} m²
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1">
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
              <div className="flex flex-wrap gap-1">
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
                    ? 'brak — narzędzie Schody na rzucie'
                    : `${plan.stairs.length} × ${plan.counts.stepsPerStair} ${
                        plan.counts.stepsPerStair === 1 ? 'stopień' : 'stopnie'
                      }`}
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
                        {index + 1}. {edgeSideLabel(stair.side)} · {formatMeters(stair.posM)} m
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
                        className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-right tabular-nums"
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
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-sm font-semibold tracking-tight">Rozpiska</h3>
          <StageBomCatalogTable plan={plan} />
        </div>

        {plan.notes.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            {plan.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}

        {onApply ? (
          <button
            type="button"
            disabled={plan.counts.decksTotal === 0}
            onClick={() => void handleApplyClick()}
            className="w-full rounded border-2 border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {applyLabel || 'Zastosuj'}
          </button>
        ) : null}
      </aside>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm tabular-nums leading-snug">{value}</div>
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
    <div className="mt-1.5 flex flex-wrap gap-1">
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
                : 'Cała strona; pojedyncze krawędzie — tryb Obicie/Barierki na rzucie'
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
