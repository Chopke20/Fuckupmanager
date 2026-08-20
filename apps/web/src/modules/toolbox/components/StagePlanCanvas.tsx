import { useCallback, useMemo, useRef, useState } from 'react'
import {
  createStageDeck,
  createStageStair,
  isEdgeSelected,
  roundM,
  snapToStep,
  stageGridLines,
  stageLegDots,
  stagePlanViewport,
  stageRailingSegments,
  stageStairShape,
  toggleEdgeInSelection,
  STAGE_DEFAULT_STAIR_WIDTH_M,
  STAGE_MAGNET_M,
  STAGE_PALETTES,
  type StageEdge,
  type StageViewport,
} from '@lama-stage/shared-types'
import { resolveDeckPosition, type StagePlanEditor } from '../hooks/useStagePlanEditor'

export type StagePlanTool =
  | 'select'
  | 'deck-2x1'
  | 'deck-1x1'
  | 'stairs'
  | 'cladding'
  | 'railings'

const CANVAS_WIDTH_PX = 760
const DRAG_THRESHOLD_M = 0.03

interface DragState {
  kind: 'decks' | 'stair'
  startX: number
  startY: number
  moved: boolean
  decks: Array<{ id: string; x: number; y: number }>
  primaryId: string | null
  stairId: string | null
  stairStart: number
}

export default function StagePlanCanvas({
  editor,
  tool,
}: {
  editor: StagePlanEditor
  tool: StagePlanTool
}) {
  const { plan } = editor
  const palette = STAGE_PALETTES.dark
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const frozenViewport = useRef<StageViewport | null>(null)
  const [dragging, setDragging] = useState(false)

  const computedViewport = useMemo(
    () => stagePlanViewport(plan, { widthPx: CANVAS_WIDTH_PX }),
    [plan]
  )
  // Kadr przestaje się dopasowywać w trakcie przeciągania — inaczej rysunek
  // uciekałby pod kursorem, gdy blat wychodzi poza dotychczasowy obszar.
  const viewport = dragging && frozenViewport.current ? frozenViewport.current : computedViewport
  const edgeToolActive = tool === 'cladding' || tool === 'railings' || tool === 'stairs'
  const addingDeck = tool === 'deck-2x1' || tool === 'deck-1x1'

  const pointToMeters = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const rect = svg.getBoundingClientRect()
      if (rect.width === 0) return { x: 0, y: 0 }
      const ratio = viewport.widthPx / rect.width
      return {
        x: viewport.fromX((event.clientX - rect.left) * ratio),
        y: viewport.fromY((event.clientY - rect.top) * ratio),
      }
    },
    [viewport]
  )

  const snapAlongEdge = useCallback(
    (value: number) =>
      plan.snapToGrid ? snapToStep(value, plan.gridStepM) : roundM(value),
    [plan.snapToGrid, plan.gridStepM]
  )

  const handleBackgroundPointerDown = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      if (addingDeck) {
        const kind = tool === 'deck-2x1' ? '2x1' : '1x1'
        const width = kind === '2x1' ? 2 : 1
        const point = pointToMeters(event)
        editor.commit((prev) => ({
          ...prev,
          decks: [
            ...prev.decks,
            createStageDeck(
              kind,
              snapAlongEdge(point.x - width / 2),
              snapAlongEdge(point.y - 0.5)
            ),
          ],
        }))
        return
      }
      editor.selectDecks([])
      editor.selectStair(null)
    },
    [addingDeck, editor, pointToMeters, snapAlongEdge, tool]
  )

  const handleDeckPointerDown = useCallback(
    (event: React.PointerEvent<SVGRectElement>, deckId: string) => {
      if (tool !== 'select') return
      event.stopPropagation()
      const already = editor.selectedDeckIds.includes(deckId)
      const nextSelection = event.shiftKey
        ? already
          ? editor.selectedDeckIds.filter((id) => id !== deckId)
          : [...editor.selectedDeckIds, deckId]
        : already
          ? editor.selectedDeckIds
          : [deckId]
      editor.selectDecks(nextSelection)
      editor.selectStair(null)

      const moving = nextSelection.includes(deckId) ? nextSelection : [deckId]
      const point = pointToMeters(event)
      dragRef.current = {
        kind: 'decks',
        startX: point.x,
        startY: point.y,
        moved: false,
        decks: plan.decks
          .filter((deck) => moving.includes(deck.id))
          .map((deck) => ({ id: deck.id, x: deck.x, y: deck.y })),
        primaryId: deckId,
        stairId: null,
        stairStart: 0,
      }
      frozenViewport.current = computedViewport
      setDragging(true)
      svgRef.current?.setPointerCapture(event.pointerId)
    },
    [computedViewport, editor, plan.decks, pointToMeters, tool]
  )

  const handleStairPointerDown = useCallback(
    (event: React.PointerEvent<SVGRectElement>, stairId: string) => {
      if (tool !== 'select') return
      event.stopPropagation()
      const stair = plan.stairs.find((item) => item.id === stairId)
      if (!stair) return
      editor.selectStair(stairId)
      editor.selectDecks([])
      const point = pointToMeters(event)
      dragRef.current = {
        kind: 'stair',
        startX: point.x,
        startY: point.y,
        moved: false,
        decks: [],
        primaryId: null,
        stairId,
        stairStart: stair.posM,
      }
      frozenViewport.current = computedViewport
      setDragging(true)
      svgRef.current?.setPointerCapture(event.pointerId)
    },
    [computedViewport, editor, plan.stairs, pointToMeters, tool]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current
      if (!drag) return
      const point = pointToMeters(event)
      const deltaX = point.x - drag.startX
      const deltaY = point.y - drag.startY
      if (!drag.moved) {
        if (Math.abs(deltaX) < DRAG_THRESHOLD_M && Math.abs(deltaY) < DRAG_THRESHOLD_M) return
        drag.moved = true
        editor.beginChange()
      }

      if (drag.kind === 'stair' && drag.stairId) {
        const stair = plan.stairs.find((item) => item.id === drag.stairId)
        if (!stair) return
        const along = stair.side === 'front' || stair.side === 'back' ? deltaX : deltaY
        const posM = snapAlongEdge(drag.stairStart + along)
        editor.preview((prev) => ({
          ...prev,
          stairs: prev.stairs.map((item) =>
            item.id === drag.stairId ? { ...item, posM } : item
          ),
        }))
        return
      }

      const primary =
        drag.decks.find((deck) => deck.id === drag.primaryId) ?? drag.decks[0]
      if (!primary) return
      const primaryDeck = plan.decks.find((deck) => deck.id === primary.id)
      if (!primaryDeck) return
      const movingIds = new Set(drag.decks.map((deck) => deck.id))
      const neighbours = plan.decks.filter((deck) => !movingIds.has(deck.id))

      const targetX = resolveDeckPosition(
        primary.x + deltaX,
        primaryDeck.w,
        neighbours.map((deck) => ({ start: deck.x, size: deck.w })),
        plan.snapToGrid,
        plan.gridStepM,
        STAGE_MAGNET_M
      )
      const targetY = resolveDeckPosition(
        primary.y + deltaY,
        primaryDeck.h,
        neighbours.map((deck) => ({ start: deck.y, size: deck.h })),
        plan.snapToGrid,
        plan.gridStepM,
        STAGE_MAGNET_M
      )
      const shiftX = targetX - primary.x
      const shiftY = targetY - primary.y

      editor.preview((prev) => ({
        ...prev,
        decks: prev.decks.map((deck) => {
          const start = drag.decks.find((item) => item.id === deck.id)
          if (!start) return deck
          return { ...deck, x: roundM(start.x + shiftX), y: roundM(start.y + shiftY) }
        }),
      }))
    },
    [editor, plan.decks, plan.gridStepM, plan.snapToGrid, plan.stairs, pointToMeters, snapAlongEdge]
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    frozenViewport.current = null
    setDragging(false)
    svgRef.current?.releasePointerCapture?.(event.pointerId)
  }, [])

  const handleEdgePointerDown = useCallback(
    (event: React.PointerEvent<SVGLineElement>, edge: StageEdge) => {
      event.stopPropagation()
      if (tool === 'cladding') {
        editor.commit((prev) => ({
          ...prev,
          // Klik w krawędź przy „bez obicia” byłby bez efektu — materiał
          // domyślny włącza się sam, operator zmieni go w panelu.
          claddingMaterial: prev.claddingMaterial === 'none' ? 'skirt' : prev.claddingMaterial,
          cladding: toggleEdgeInSelection(prev.cladding, edge),
        }))
        return
      }
      if (tool === 'railings') {
        editor.commit((prev) => ({
          ...prev,
          railings: toggleEdgeInSelection(prev.railings, edge),
        }))
        return
      }
      if (tool !== 'stairs') return
      const horizontal = edge.side === 'front' || edge.side === 'back'
      const point = pointToMeters(event)
      const along = horizontal ? point.x : point.y
      const start = horizontal ? edge.x1 : edge.y1
      const end = horizontal ? edge.x2 : edge.y2
      const width = Math.min(STAGE_DEFAULT_STAIR_WIDTH_M, edge.lengthM)
      const posM = Math.min(
        Math.max(snapAlongEdge(along - width / 2), start),
        roundM(end - width)
      )
      const stair = createStageStair(edge.side, horizontal ? edge.y1 : edge.x1, posM, width)
      editor.commit((prev) => ({ ...prev, stairs: [...prev.stairs, stair] }))
      editor.selectStair(stair.id)
    },
    [editor, pointToMeters, snapAlongEdge, tool]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = plan.snapToGrid ? plan.gridStepM : 0.25
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) editor.redo()
        else editor.undo()
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === 'd') {
        event.preventDefault()
        editor.duplicateSelected()
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === 'a') {
        event.preventDefault()
        editor.selectAll()
        return
      }
      if (key === 'r') {
        event.preventDefault()
        editor.rotateSelected()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        editor.deleteSelected()
        return
      }
      if (event.key === 'Escape') {
        editor.selectDecks([])
        editor.selectStair(null)
        return
      }
      const nudges: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      }
      const nudge = nudges[event.key]
      if (nudge) {
        event.preventDefault()
        editor.nudgeSelected(nudge[0], nudge[1])
      }
    },
    [editor, plan.gridStepM, plan.snapToGrid]
  )

  const { toX, toY, scale } = viewport
  const gridLines = stageGridLines(viewport, plan.snapToGrid ? plan.gridStepM : 1)
  const legDots = stageLegDots(plan)
  const legRadius = Math.max(1.3, Math.min(2.6, scale * 0.045))
  const railings = stageRailingSegments(plan)
  const claddingActive = plan.claddingMaterial !== 'none'

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="rounded border border-border bg-background outline-none focus:border-primary/60"
      aria-label="Rzut sceny — edytor podestów"
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewport.widthPx} ${viewport.heightPx}`}
        width="100%"
        style={{ display: 'block', height: 'auto', touchAction: 'none' }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <rect
          x={0}
          y={0}
          width={viewport.widthPx}
          height={viewport.heightPx}
          fill={palette.bg}
          onPointerDown={handleBackgroundPointerDown}
          style={{ cursor: addingDeck ? 'copy' : 'default' }}
        />

        {gridLines.map((line, index) => (
          <line
            key={`grid-${index}`}
            x1={toX(line.x1)}
            y1={toY(line.y1)}
            x2={toX(line.x2)}
            y2={toY(line.y2)}
            stroke={palette.grid}
            strokeWidth={1}
            pointerEvents="none"
          />
        ))}

        {plan.decks.map((deck) => {
          const selected = editor.selectedDeckIds.includes(deck.id)
          const width = deck.w * scale
          const height = deck.h * scale
          const fontSize = Math.max(8, Math.min(13, Math.min(width, height) * 0.26))
          return (
            <g key={deck.id}>
              <rect
                x={toX(deck.x)}
                y={toY(deck.y + deck.h)}
                width={width}
                height={height}
                fill={deck.kind === '2x1' ? palette.deckFill : palette.deckAltFill}
                strokeWidth={selected ? 2 : 1.1}
                onPointerDown={(event) => handleDeckPointerDown(event, deck.id)}
                style={{
                  stroke: selected ? palette.cladding : palette.deckStroke,
                  cursor: tool === 'select' ? 'move' : addingDeck ? 'copy' : 'default',
                }}
                pointerEvents={tool === 'select' ? 'auto' : 'none'}
              />
              {Math.min(width, height) >= 18 ? (
                <text
                  x={toX(deck.x) + width / 2}
                  y={toY(deck.y + deck.h) + height / 2 + fontSize * 0.35}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fill={palette.textDim}
                  pointerEvents="none"
                >
                  {deck.kind === '2x1' ? '2×1' : '1×1'}
                </text>
              ) : null}
            </g>
          )
        })}

        {legDots.map((dot, index) => (
          <circle
            key={`leg-${index}`}
            cx={toX(dot.x)}
            cy={toY(dot.y)}
            r={legRadius}
            fill={palette.leg}
            pointerEvents="none"
          />
        ))}

        {plan.edges.map((edge) => {
          const clad = claddingActive && isEdgeSelected(plan.cladding, edge)
          return (
            <line
              key={`edge-${edge.key}`}
              x1={toX(edge.x1)}
              y1={toY(edge.y1)}
              x2={toX(edge.x2)}
              y2={toY(edge.y2)}
              strokeWidth={clad ? 3 : 1.4}
              strokeLinecap="square"
              pointerEvents="none"
              style={{ stroke: clad ? palette.cladding : palette.outlineIdle }}
            />
          )
        })}

        {railings.map((segment, index) => (
          <line
            key={`railing-${index}`}
            x1={toX(segment.x1)}
            y1={toY(segment.y1)}
            x2={toX(segment.x2)}
            y2={toY(segment.y2)}
            stroke={palette.railing}
            strokeWidth={1.7}
            strokeDasharray="5 3"
            pointerEvents="none"
          />
        ))}

        {plan.stairs.map((stair) => {
          const shape = stageStairShape(stair, plan.legHeightCm)
          const selected = editor.selectedStairId === stair.id
          return (
            <g key={stair.id}>
              <rect
                x={toX(shape.rect.x)}
                y={toY(shape.rect.y + shape.rect.h)}
                width={shape.rect.w * scale}
                height={shape.rect.h * scale}
                fill={palette.stairFill}
                strokeWidth={selected ? 2 : 1}
                onPointerDown={(event) => handleStairPointerDown(event, stair.id)}
                style={{
                  stroke: selected ? palette.cladding : palette.stairStroke,
                  cursor: tool === 'select' ? 'move' : 'default',
                }}
                pointerEvents={tool === 'select' ? 'auto' : 'none'}
              />
              {shape.steps.map((step, index) => (
                <line
                  key={`${stair.id}-step-${index}`}
                  x1={toX(step.x1)}
                  y1={toY(step.y1)}
                  x2={toX(step.x2)}
                  y2={toY(step.y2)}
                  stroke={palette.stairStroke}
                  strokeWidth={1}
                  pointerEvents="none"
                />
              ))}
            </g>
          )
        })}

        {edgeToolActive
          ? plan.edges.map((edge) => (
              <line
                key={`hit-${edge.key}`}
                x1={toX(edge.x1)}
                y1={toY(edge.y1)}
                x2={toX(edge.x2)}
                y2={toY(edge.y2)}
                strokeOpacity={0.18}
                strokeWidth={12}
                strokeLinecap="round"
                onPointerDown={(event) => handleEdgePointerDown(event, edge)}
                style={{ stroke: palette.cladding, cursor: 'pointer' }}
              />
            ))
          : null}

        <text
          x={viewport.widthPx / 2}
          y={viewport.heightPx - 7}
          textAnchor="middle"
          fontSize={11}
          fill={palette.textDim}
          pointerEvents="none"
        >
          FRONT / PUBLICZNOŚĆ
        </text>
      </svg>
    </div>
  )
}
