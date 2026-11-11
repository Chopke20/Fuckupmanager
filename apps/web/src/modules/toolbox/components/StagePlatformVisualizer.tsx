import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Check,
  ChevronDown,
  Copy,
  HelpCircle,
  Redo2,
  RotateCw,
  Trash2,
  Undo2,
} from 'lucide-react'
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
import StageBomCatalogTable, { type StageBomPreview } from './StageBomCatalogTable'
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
  onDirtyChange?: (dirty: boolean) => void
}

const PLACE_TOOLS: Array<{
  id: StagePlanTool
  label: string
  hint: string
  icon: { w: number; h: number }
}> = [
  { id: 'deck-2x1', label: '2×1', hint: 'Klik na rzucie stawia blat 2×1', icon: { w: 18, h: 9 } },
  { id: 'deck-1x1', label: '1×1', hint: 'Klik na rzucie stawia blat 1×1', icon: { w: 10, h: 10 } },
  { id: 'deck-0.5x2', label: '0,5×2', hint: 'Klik na rzucie stawia blat 0,5×2', icon: { w: 6, h: 14 } },
  { id: 'deck-custom', label: 'W×D', hint: 'Klik stawia blat o wpisanych wymiarach', icon: { w: 12, h: 8 } },
]

function parseDim(raw: string): number {
  const value = Number(raw.trim().replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(value) ? value : NaN
}

function segmentBtn(active: boolean): string {
  return `px-2 py-1 text-xs tabular-nums transition-colors ${
    active
      ? 'bg-primary/15 text-primary'
      : 'text-muted-foreground hover:bg-background hover:text-foreground'
  }`
}

function toolBtn(active: boolean): string {
  return `inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
    active
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border text-muted-foreground hover:text-foreground'
  }`
}

function DeckIcon({ w, h }: { w: number; h: number }) {
  return (
    <span
      className="inline-block rounded-[2px] border border-current opacity-80"
      style={{ width: w, height: h }}
      aria-hidden
    />
  )
}

export default function StagePlatformVisualizer({
  initialPlan = null,
  applyLabel,
  onApply,
  onPlanChange,
  onDirtyChange,
}: StagePlatformVisualizerProps) {
  const editor = useStagePlanEditor(initialPlan)
  const [tool, setTool] = useState<StagePlanTool>('select')
  const [rectWidth, setRectWidth] = useState('6')
  const [rectDepth, setRectDepth] = useState('4')
  const [rectAlongFront, setRectAlongFront] = useState(true)
  const [customWidth, setCustomWidth] = useState('0,5')
  const [customDepth, setCustomDepth] = useState('2')
  const [layoutOpen, setLayoutOpen] = useState(() => !(initialPlan?.decks?.length))
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [gridOpen, setGridOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [assumptionsOpen, setAssumptionsOpen] = useState(false)
  const [rightTab, setRightTab] = useState<'config' | 'bom'>('config')
  const [confirmClear, setConfirmClear] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [bomPreview, setBomPreview] = useState<StageBomPreview | null>(null)
  const [dirty, setDirty] = useState(false)
  const baselineRef = useRef(JSON.stringify(initialPlan ?? null))
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
    const nextDirty = JSON.stringify(plan) !== baselineRef.current
    setDirty(nextDirty)
    onDirtyChange?.(nextDirty)
    onPlanChange?.(plan)
  }, [plan, onPlanChange, onDirtyChange])

  const activeHint = useMemo(() => {
    if (tool === 'select') {
      return hasSelectionText(editor.selectedDeckIds.length)
    }
    if (tool === 'stairs') return 'Schody: kliknij krawędź blatu, żeby dodać'
    if (tool === 'cladding') return 'Obicie: kliknij krawędź, żeby włączyć lub wyłączyć'
    if (tool === 'railings') return 'Barierki: kliknij krawędź, żeby włączyć lub wyłączyć'
    const place = PLACE_TOOLS.find((item) => item.id === tool)
    return place?.hint ?? ''
  }, [tool, editor.selectedDeckIds.length])

  const hasSelection = editor.selectedDeckIds.length > 0
  const maxDeckHeight = useMemo(() => {
    if (plan.decks.length === 0) return plan.legHeightCm
    return Math.max(...plan.decks.map((d) => deckHeightCm(d, plan.legHeightCm)), plan.legHeightCm)
  }, [plan.decks, plan.legHeightCm])

  const clampWarning =
    maxDeckHeight > 60
      ? maxDeckHeight >= 168
        ? 'Od 168 cm: dodatkowe stężenia poziome i ukośne; klamry nóg obowiązkowe.'
        : maxDeckHeight > 100
          ? 'Powyżej 100 cm: druga linia klamer nóg; klamry obowiązkowe.'
          : 'Powyżej 60 cm wysokości klamry nóg są obowiązkowe (stężenie).'
      : null

  const assumptionNotes = plan.notes.filter(
    (note) =>
      !note.includes('Powyżej 60') &&
      !note.includes('Powyżej 100') &&
      !note.includes('Od 168') &&
      !note.startsWith('Gabaryt') &&
      !note.startsWith('Obicie') &&
      !note.startsWith('Barierki') &&
      !note.includes('Siatka')
  )

  const handleApplyClick = useCallback(async () => {
    if (!onApply) return
    setApplyError(null)
    let maps = roleMaps
    try {
      maps = await listStagePlanRoleMaps()
      setRoleMaps(maps)
    } catch {
      // cache
    }
    const { issues } = resolveStagePlanOrderLines({
      plan,
      maps,
      catalog,
    })
    const blocking = stagePlanApplyBlockingIssues(issues)
    if (blocking.length > 0) {
      setApplyError(
        `Nie można dodać do zlecenia — popraw mapowanie:\n` +
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
      setRightTab('bom')
      return
    }
    onApply(plan)
    baselineRef.current = JSON.stringify(plan)
    setDirty(false)
    onDirtyChange?.(false)
  }, [catalog, onApply, onDirtyChange, plan, roleMaps])

  const applyButtonLabel = useMemo(() => {
    const lines = bomPreview?.lines ?? []
    if (lines.length === 0) return applyLabel || 'Dodaj do zlecenia'
    const deckLine = lines.find(
      (line) =>
        line.catalogKey.startsWith('deck-') ||
        line.equipment.name.toLowerCase().includes('podest')
    )
    if (deckLine && lines.length === 1) {
      const qty = formatMeters(deckLine.quantity)
      return `Dodaj do zlecenia: ${qty} ${
        deckLine.unit === 'szt.' ? (Number(deckLine.quantity) === 1 ? 'podest' : 'podestów') : deckLine.unit
      }`
    }
    if (deckLine && lines.every((l) => l.catalogKey.startsWith('deck-') || l.sourceKeys.some((k) => k.startsWith('deck-')))) {
      return `Dodaj do zlecenia: ${formatMeters(deckLine.quantity)} podestów`
    }
    if (lines.length === 1) {
      return `Dodaj do zlecenia: ${formatMeters(lines[0]!.quantity)} ${lines[0]!.unit}`
    }
    return `Dodaj do zlecenia: ${lines.length} pozycji`
  }, [applyLabel, bomPreview?.lines])

  const unmappedWarn =
    bomPreview && bomPreview.unmappedOfferCount > 0
      ? `${bomPreview.unmappedOfferCount} pozycji oferty bez mapowania`
      : null

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] xl:items-stretch">
      {/* LEWA */}
      <section className="flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-lg border border-border/80 bg-background/50 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTool('select')}
            className={toolBtn(tool === 'select')}
          >
            Zaznacz
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setAddMenuOpen((v) => !v)}
              className={toolBtn(PLACE_TOOLS.some((t) => t.id === tool))}
            >
              Dodaj blat
              <ChevronDown size={12} />
            </button>
            {addMenuOpen ? (
              <div className="absolute left-0 z-20 mt-1 min-w-[10rem] overflow-hidden rounded-md border border-border bg-surface shadow-lg">
                {PLACE_TOOLS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-background"
                    onClick={() => {
                      setTool(item.id)
                      setAddMenuOpen(false)
                    }}
                  >
                    <DeckIcon w={item.icon.w} h={item.icon.h} />
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setTool('stairs')}
            className={toolBtn(tool === 'stairs')}
          >
            Schody
          </button>
          <button
            type="button"
            onClick={() => setTool('cladding')}
            className={toolBtn(tool === 'cladding')}
          >
            Obicie
          </button>
          <button
            type="button"
            onClick={() => setTool('railings')}
            className={toolBtn(tool === 'railings')}
          >
            Barierki
          </button>

          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => setGridOpen((v) => !v)}
                className={toolBtn(plan.snapToGrid)}
                title="Siatka"
              >
                Siatka {plan.snapToGrid ? formatMeters(plan.gridStepM) : 'off'}
              </button>
              {gridOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-border bg-surface p-2 shadow-lg">
                  <button
                    type="button"
                    className={`mb-1 w-full rounded border px-2 py-1 text-xs ${
                      plan.snapToGrid ? 'border-primary text-primary' : 'border-border'
                    }`}
                    onClick={() => editor.patch({ snapToGrid: !plan.snapToGrid })}
                  >
                    {plan.snapToGrid ? 'Włączona' : 'Wyłączona'}
                  </button>
                  <div className="flex flex-wrap gap-1">
                    {STAGE_GRID_STEPS_M.map((step) => (
                      <button
                        key={step}
                        type="button"
                        className={`rounded border px-2 py-0.5 text-[11px] ${
                          plan.snapToGrid && plan.gridStepM === step
                            ? 'border-primary text-primary'
                            : 'border-border text-muted-foreground'
                        }`}
                        onClick={() => {
                          editor.patch({ gridStepM: step, snapToGrid: true })
                          setGridOpen(false)
                        }}
                      >
                        {formatMeters(step)} m
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Magnet {Math.round(STAGE_MAGNET_M * 100)} cm bez siatki
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {tool === 'deck-custom' ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="text-muted-foreground">
              W
              <input
                type="text"
                inputMode="decimal"
                className="ml-1 w-12 rounded border border-border bg-background px-1.5 py-1 tabular-nums"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                title={`${STAGE_PLAN_MIN_CUSTOM_M}–${STAGE_PLAN_MAX_CUSTOM_M} m`}
              />
            </label>
            <label className="text-muted-foreground">
              D
              <input
                type="text"
                inputMode="decimal"
                className="ml-1 w-12 rounded border border-border bg-background px-1.5 py-1 tabular-nums"
                value={customDepth}
                onChange={(e) => setCustomDepth(e.target.value)}
              />
            </label>
            <span className="text-muted-foreground">m</span>
          </div>
        ) : null}

        {layoutOpen || plan.decks.length === 0 ? (
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-border/70 bg-surface/40 px-2.5 py-2">
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
                onChange={(e) => setRectWidth(e.target.value)}
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
                onChange={(e) => setRectDepth(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setRectAlongFront((v) => !v)}
              className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              title="Orientacja blatów 2×1"
            >
              {rectAlongFront ? 'Dłuższy bok: front' : 'Dłuższy bok: w głąb'}
            </button>
            <button
              type="button"
              onClick={() => {
                editor.fillRect(parseDim(rectWidth), parseDim(rectDepth), rectAlongFront)
                setLayoutOpen(false)
              }}
              className="rounded border border-primary px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
            >
              Ułóż prostokąt
            </button>
            {confirmClear ? (
              <span className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">Wyczyścić rzut?</span>
                <button
                  type="button"
                  className="rounded border border-red-500/50 px-1.5 py-0.5 text-red-400"
                  onClick={() => {
                    editor.clearAll()
                    setConfirmClear(false)
                    setLayoutOpen(true)
                  }}
                >
                  Tak
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-1.5 py-0.5 text-muted-foreground"
                  onClick={() => setConfirmClear(false)}
                >
                  Nie
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="ml-auto rounded border border-border/60 px-2 py-1 text-xs text-muted-foreground/80 hover:border-red-500/40 hover:text-red-400"
              >
                Wyczyść…
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLayoutOpen(true)}
              className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Nowy układ…
            </button>
          </div>
        )}

        <div className="flex items-center gap-1">
          <IconAction title="Cofnij (Ctrl+Z)" onClick={editor.undo} disabled={!editor.canUndo}>
            <Undo2 size={15} />
          </IconAction>
          <IconAction title="Ponów" onClick={editor.redo} disabled={!editor.canRedo}>
            <Redo2 size={15} />
          </IconAction>
          <IconAction title="Obróć (R)" onClick={editor.rotateSelected} disabled={!hasSelection}>
            <RotateCw size={15} />
          </IconAction>
          <IconAction title="Duplikuj (Ctrl+D)" onClick={editor.duplicateSelected} disabled={!hasSelection}>
            <Copy size={15} />
          </IconAction>
          <IconAction
            title="Usuń (Del)"
            onClick={editor.deleteSelected}
            disabled={!hasSelection && !editor.selectedStairId}
            danger
          >
            <Trash2 size={15} />
          </IconAction>
        </div>

        {/* Stała wysokość paska zaznaczenia — bez skakania layoutu */}
        <div className="min-h-[4.75rem] shrink-0">
          {hasSelection ? (
            <div className="rounded-md border border-primary/35 bg-primary/5 px-2.5 py-2">
              <div className="mb-1 text-xs font-medium">
                Zaznaczenie ({editor.selectedDeckIds.length})
              </div>
              <div className="mb-1 text-[10px] text-muted-foreground">Wysokość nóg</div>
              <div className="inline-flex max-w-full flex-wrap overflow-hidden rounded-md border border-border">
                {STAGE_LEG_HEIGHTS_CM.map((height, index) => (
                  <button
                    key={`sel-h-${height}`}
                    type="button"
                    onClick={() => editor.setSelectedDeckHeight(height)}
                    className={`${segmentBtn(selectedHeight === height)} ${
                      index > 0 ? 'border-l border-border' : ''
                    }`}
                  >
                    {height}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => editor.setSelectedDeckHeight(null)}
                  className={`${segmentBtn(false)} border-l border-border`}
                  title="Jak domyślna planu"
                >
                  domyślna
                </button>
              </div>
              <span className="ml-1 text-[11px] text-muted-foreground">cm</span>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border/50 px-2.5 py-2 text-[11px] text-muted-foreground">
              Zaznacz blat na rzucie, żeby ustawić wysokość nóg.
            </div>
          )}
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-background">
          <StagePlanCanvas
            editor={editor}
            tool={tool}
            customDeckSize={customDeckSize}
            onToolDone={() => setTool('select')}
            sparseLabels
            showOuterDimensions
            fillContainer
          />
        </div>

        <div className="flex items-start gap-2 rounded-md border border-border/60 bg-surface/30 px-2.5 py-1.5">
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-foreground/85">{activeHint}</p>
          <div className="relative shrink-0">
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => setHelpOpen((v) => !v)}
              aria-label="Skróty klawiszowe"
            >
              <HelpCircle size={15} />
            </button>
            {helpOpen ? (
              <div className="absolute bottom-full right-0 z-20 mb-1 w-56 rounded-md border border-border bg-surface p-2 text-[11px] text-muted-foreground shadow-lg">
                <div>R — obrót</div>
                <div>Del — usuń</div>
                <div>Ctrl+D — duplikat</div>
                <div>Ctrl+Z — cofnij</div>
                <div>Strzałki — krok siatki</div>
                <div>Shift+klik — wiele blatów</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 bg-amber-400/90" /> Obicie
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 bg-sky-400/90" /> Barierki
          </span>
          <span>Etykieta blatu tylko przy innej wysokości</span>
        </div>

        {plan.warnings.length > 0 ? (
          <ul className="space-y-1 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* PRAWA */}
      <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
        <div className="shrink-0 border-b border-border px-3 py-2 text-xs tabular-nums text-foreground/90">
          <span className="font-medium">
            {plan.widthM}×{plan.depthM} m
          </span>
          <span className="text-muted-foreground"> · </span>
          {formatMeters(plan.areaM2)} m²
          <span className="text-muted-foreground"> · </span>
          {plan.counts.decksTotal} pod.
          <span className="text-muted-foreground"> · </span>
          {plan.counts.legs} nóg
        </div>

        <div className="flex shrink-0 border-b border-border">
          <button
            type="button"
            className={`flex-1 px-3 py-2 text-xs font-medium ${
              rightTab === 'config'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setRightTab('config')}
          >
            Konfiguracja
          </button>
          <button
            type="button"
            className={`flex-1 px-3 py-2 text-xs font-medium ${
              rightTab === 'bom'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setRightTab('bom')}
          >
            Rozpiska ({plan.bom.length})
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <div className={rightTab === 'bom' ? 'block' : 'hidden'}>
            <StageBomCatalogTable
              plan={plan}
              hideApplyPreview
              onPreviewChange={setBomPreview}
            />
          </div>
          {rightTab === 'config' ? (
            <>
              <ConfigSection
                label="Domyślna wysokość nóg"
                value={`${plan.legHeightCm} cm`}
              >
                <div className="inline-flex max-w-full flex-wrap overflow-hidden rounded-md border border-border">
                  {STAGE_LEG_HEIGHTS_CM.map((height, index) => (
                    <button
                      key={height}
                      type="button"
                      onClick={() => editor.patch({ legHeightCm: height })}
                      className={`${segmentBtn(plan.legHeightCm === height)} ${
                        index > 0 ? 'border-l border-border' : ''
                      }`}
                    >
                      {height}
                    </button>
                  ))}
                </div>
              </ConfigSection>

              <ConfigSection
                label="Obicie"
                value={
                  plan.claddingMaterial === 'none'
                    ? claddingMaterialLabel('none')
                    : `${claddingMaterialLabel(plan.claddingMaterial)} · ${formatMeters(plan.claddingMb)} mb · ${formatMeters(plan.claddingM2)} m²`
                }
              >
                <div className="inline-flex overflow-hidden rounded-md border border-border">
                  {(['none', 'skirt', 'hips'] as StageCladdingMaterial[]).map((material, index) => (
                    <button
                      key={material}
                      type="button"
                      onClick={() => editor.patch({ claddingMaterial: material })}
                      className={`${segmentBtn(plan.claddingMaterial === material)} ${
                        index > 0 ? 'border-l border-border' : ''
                      }`}
                    >
                      {claddingMaterialLabel(material)}
                    </button>
                  ))}
                </div>
                <EdgeChips
                  plan={plan}
                  target="cladding"
                  disabled={plan.claddingMaterial === 'none'}
                  onToggle={(side) =>
                    editor.patch({
                      cladding: toggleSideInSelection(plan.cladding, side, plan.edges),
                    })
                  }
                />
              </ConfigSection>

              <ConfigSection
                label="Podłoga"
                value={
                  plan.floorMaterial === 'none'
                    ? floorMaterialLabel('none')
                    : `${floorMaterialLabel(plan.floorMaterial)} · ${formatMeters(plan.areaM2)} m²`
                }
              >
                <div className="inline-flex overflow-hidden rounded-md border border-border">
                  {(['none', 'carpet', 'hips'] as StageFloorMaterial[]).map((material, index) => (
                    <button
                      key={material}
                      type="button"
                      onClick={() => editor.patch({ floorMaterial: material })}
                      className={`${segmentBtn(plan.floorMaterial === material)} ${
                        index > 0 ? 'border-l border-border' : ''
                      }`}
                    >
                      {floorMaterialLabel(material)}
                    </button>
                  ))}
                </div>
              </ConfigSection>

              <ConfigSection
                label="Barierki"
                value={
                  plan.railingMb > 0 ? `${formatMeters(plan.railingMb)} mb` : 'brak'
                }
              >
                <EdgeChips
                  plan={plan}
                  target="railings"
                  onToggle={(side) =>
                    editor.patch({
                      railings: toggleSideInSelection(plan.railings, side, plan.edges),
                    })
                  }
                />
              </ConfigSection>

              <ConfigSection
                label="Schody"
                value={
                  plan.stairs.length === 0
                    ? 'brak'
                    : `${plan.stairs.length} × ${plan.counts.stepsPerStair} st.`
                }
              >
                {plan.stairs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Narzędzie Schody na rzucie — klik w krawędź.
                  </p>
                ) : (
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
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </ConfigSection>

              {clampWarning ? (
                <p className="rounded border border-warning/40 bg-warning/10 px-2.5 py-2 text-xs text-warning">
                  {clampWarning}
                </p>
              ) : null}

              {assumptionNotes.length > 0 ? (
                <div>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setAssumptionsOpen((v) => !v)}
                  >
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${assumptionsOpen ? 'rotate-180' : ''}`}
                    />
                    Założenia obliczeń
                  </button>
                  {assumptionsOpen ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                      {assumptionNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Sticky apply bar */}
        {onApply ? (
          <div className="shrink-0 space-y-2 border-t border-border bg-surface px-3 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
            <div className="rounded border border-border bg-background/70 px-2.5 py-2 text-xs">
              <div className="mb-1 font-medium text-foreground">Po zastosowaniu</div>
              {(bomPreview?.lines.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">Brak pozycji do dodania — ustaw Mapowanie.</p>
              ) : (
                <ul className="space-y-0.5">
                  {bomPreview!.lines.map((line) => (
                    <li key={line.catalogKey} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{line.equipment.name}</span>
                      <span className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">
                        {formatMeters(line.quantity)} {line.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {(bomPreview?.skippedCount ?? 0) > 0 ? (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Pominięte: {bomPreview!.skippedCount} pozycji (tylko plan)
                </p>
              ) : null}
              {unmappedWarn ? (
                <p className="mt-1 text-[11px] text-warning">{unmappedWarn}</p>
              ) : null}
            </div>

            {applyError ? (
              <p className="whitespace-pre-wrap rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
                {applyError}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] ${
                  dirty ? 'text-warning' : 'text-muted-foreground'
                }`}
              >
                {dirty ? 'Niezapisane zmiany' : 'Zapisano'}
              </span>
              <button
                type="button"
                disabled={plan.counts.decksTotal === 0}
                onClick={() => void handleApplyClick()}
                className="ml-auto rounded border-2 border-primary px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                {applyButtonLabel}
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

function hasSelectionText(count: number): string {
  if (count > 0) return `Zaznaczono ${count} — ustaw wysokość w panelu Zaznaczenie`
  return 'Zaznacz i przeciągaj blaty. Shift+klik zaznacza wiele.'
}

function IconAction({
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded border border-border/80 bg-background px-1.5 py-1 disabled:opacity-35 ${
        danger
          ? 'text-foreground/80 hover:border-red-500/40 hover:text-red-400'
          : 'text-foreground/85 hover:border-primary/40 hover:text-primary'
      }`}
    >
      {children}
    </button>
  )
}

function ConfigSection({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-right text-xs font-medium tabular-nums text-foreground">{value}</span>
      </div>
      {children}
    </div>
  )
}

function EdgeChips({
  plan,
  target,
  onToggle,
  disabled,
}: {
  plan: StagePlan
  target: 'cladding' | 'railings'
  onToggle: (side: StageEdgeSide) => void
  disabled?: boolean
}) {
  const selection = target === 'cladding' ? plan.cladding : plan.railings
  return (
    <div className={`mt-1.5 flex flex-wrap gap-1 ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
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
            disabled={disabled || sideEdges.length === 0}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
              active
                ? 'border-primary/60 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground'
            }`}
          >
            {active ? <Check size={10} /> : null}
            {edgeSideLabel(side)}
            {partial ? ' ·' : ''}
          </button>
        )
      })}
    </div>
  )
}
