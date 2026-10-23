import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Maximize2, Minimize2, Plus, Trash2 } from 'lucide-react'
import {
  PLANNER_BLOCK_COLORS,
  PLANNER_DEFAULT_BLOCK_DURATION_MIN,
  PLANNER_MAX_DAY_COUNT,
  PLANNER_MIN_DAY_COUNT,
  addDaysIso,
  clampBlockToDay,
  dayOffsets,
  emptyBlockSection,
  formatDayHeader,
  hourMarks,
  layoutOverlappingBlocks,
  minutesToLabel,
  newId,
  sectionAccentColor,
  snapMinutes,
  type PlannerBlock,
  type PlannerBoardPayload,
  type PlannerNote,
} from '../planner/plannerTypes'
import PlannerBlockSectionsEditor from './PlannerBlockSectionsEditor'
import PlannerBlockOrderAttach from './PlannerBlockOrderAttach'

const PX_PER_HOUR = 56
const TIME_GUTTER_W = 52
const NOTES_RAIL_W = 240

type DragMode = 'move' | 'resize'

interface ActiveDrag {
  mode: DragMode
  blockId: string
  pointerId: number
  originClientX: number
  originClientY: number
  originDayOffset: number
  originStartMin: number
  originEndMin: number
}

interface NoteDrag {
  noteId: string
  pointerId: number
  originClientY: number
  originY: number
}

function PlannerDayBlock({
  block,
  top,
  height,
  left,
  width,
  selected,
  dragging,
  onMovePointerDown,
  onResizePointerDown,
  onSelect,
  onChangeBlock,
}: {
  block: PlannerBlock
  top: number
  height: number
  left: string
  width: string
  selected: boolean
  dragging: boolean
  onMovePointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onResizePointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onSelect: () => void
  onChangeBlock: (patch: Partial<PlannerBlock>) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [peekOpen, setPeekOpen] = useState(false)
  const sections = block.sections ?? []

  useEffect(() => {
    if (peekOpen) {
      setOverflows(false)
      return
    }
    const el = contentRef.current
    if (!el) return
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [block.title, block.sections, height, width, selected, peekOpen])

  // Zwiń po kliknięciu poza blokiem
  useEffect(() => {
    if (!peekOpen) return
    const onDoc = (e: PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      if (e.target instanceof Node && !root.contains(e.target)) {
        setPeekOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPeekOpen(false)
    }
    document.addEventListener('pointerdown', onDoc, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [peekOpen])

  const openPeek = () => {
    onSelect()
    setPeekOpen(true)
  }

  const updateSection = (id: string, patch: { title?: string; text?: string }) => {
    onChangeBlock({
      sections: sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })
  }

  const addSection = () => {
    onChangeBlock({ sections: [...sections, emptyBlockSection()] })
  }

  const removeSection = (id: string) => {
    onChangeBlock({ sections: sections.filter((s) => s.id !== id) })
  }

  const stopDrag: React.PointerEventHandler = (e) => e.stopPropagation()
  const editing = selected || peekOpen

  return (
    <div
      ref={rootRef}
      data-planner-block
      className={`absolute rounded-md border px-1.5 py-1 text-xs text-white shadow-sm transition-[width,transform,box-shadow,max-height] duration-150 ease-out ${
        peekOpen
          ? 'z-30 overflow-auto shadow-2xl ring-2 ring-white/90'
          : dragging
            ? 'z-20 cursor-grabbing overflow-hidden ring-2 ring-white/70 opacity-95'
            : selected
              ? 'z-[2] cursor-default overflow-hidden ring-2 ring-white/80'
              : 'z-[1] cursor-grab overflow-hidden active:cursor-grabbing'
      }`}
      style={{
        top,
        // Peek: rozszerz na boki (pełny dzień, min. ~280px), po odkliknięciu wraca do slotu.
        ...(peekOpen
          ? {
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'min(360px, max(calc(100% - 8px), 280px))',
            }
          : { left, width, transform: undefined }),
        height: peekOpen ? 'auto' : height,
        minHeight: height,
        maxHeight: peekOpen ? 'min(70vh, 520px)' : undefined,
        backgroundColor: block.color || PLANNER_BLOCK_COLORS[0],
        borderColor: 'rgba(0,0,0,0.2)',
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('input, textarea, button')) return
        if (peekOpen) return
        onMovePointerDown(e)
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('input, textarea, button')) return
        e.stopPropagation()
        openPeek()
      }}
    >
      <div
        ref={contentRef}
        className={`flex flex-col gap-1 pb-3 ${peekOpen ? '' : 'h-full overflow-hidden'}`}
      >
        {editing ? (
          <input
            className="w-full truncate bg-transparent text-[13px] font-bold leading-tight text-white outline-none placeholder:text-white/60"
            value={block.title}
            placeholder="Tytuł bloku"
            onChange={(e) => onChangeBlock({ title: e.target.value })}
            onPointerDown={stopDrag}
          />
        ) : (
          <div className="truncate text-[13px] font-bold leading-tight">{block.title}</div>
        )}
        <div className="truncate text-[10px] font-medium text-white/75">
          {minutesToLabel(block.startMin)}–{minutesToLabel(block.endMin)}
        </div>

        {editing || block.orderId ? (
          <PlannerBlockOrderAttach
            orderId={block.orderId}
            orderLabel={block.orderLabel}
            variant="dark"
            compact
            readOnly={!editing}
            onAttach={(orderId, orderLabel) => onChangeBlock({ orderId, orderLabel })}
            onDetach={() => onChangeBlock({ orderId: undefined, orderLabel: undefined })}
          />
        ) : null}

        {editing
          ? sections.map((section, index) => {
              const accent = sectionAccentColor(index)
              return (
                <div
                  key={section.id}
                  className="mt-0.5 rounded-md px-1.5 py-1 shadow-sm"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.28)',
                    borderLeft: `3px solid ${accent}`,
                  }}
                  onPointerDown={stopDrag}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: accent }}
                      aria-hidden
                    />
                    <input
                      className="min-w-0 flex-1 bg-transparent text-[10px] font-bold uppercase tracking-wide text-white outline-none placeholder:text-white/50"
                      value={section.title}
                      placeholder={`Sekcja ${index + 1}`}
                      onChange={(e) => updateSection(section.id, { title: e.target.value })}
                      onPointerDown={stopDrag}
                    />
                    <button
                      type="button"
                      className="shrink-0 text-white/70 hover:text-white"
                      onClick={() => removeSection(section.id)}
                      onPointerDown={stopDrag}
                      aria-label="Usuń sekcję"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <textarea
                    className={`mt-0.5 w-full bg-transparent text-[10px] font-normal leading-snug text-white/95 outline-none placeholder:text-white/45 ${
                      peekOpen ? 'min-h-[4.5rem] resize-y' : 'max-h-16 resize-none'
                    }`}
                    rows={peekOpen ? 4 : 2}
                    value={section.text}
                    placeholder="Treść…"
                    onChange={(e) => updateSection(section.id, { text: e.target.value })}
                    onPointerDown={stopDrag}
                  />
                </div>
              )
            })
          : sections.map((section, index) =>
              section.title.trim() || section.text.trim() ? (
                <div
                  key={section.id}
                  className="mt-0.5 rounded-md px-1.5 py-1 leading-snug"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.22)',
                    borderLeft: `3px solid ${sectionAccentColor(index)}`,
                  }}
                >
                  {section.title.trim() ? (
                    <div className="mb-0.5 flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: sectionAccentColor(index) }}
                        aria-hidden
                      />
                      <div className="truncate text-[10px] font-bold uppercase tracking-wide text-white">
                        {section.title}
                      </div>
                    </div>
                  ) : null}
                  {section.text.trim() ? (
                    <p className="whitespace-pre-wrap break-words text-[10px] font-normal text-white/90">
                      {section.text}
                    </p>
                  ) : null}
                </div>
              ) : null
            )}

        {editing ? (
          <button
            type="button"
            className="mt-0.5 inline-flex w-fit items-center gap-0.5 rounded bg-black/30 px-1.5 py-0.5 text-[9px] font-medium text-white/90 hover:bg-black/45"
            onClick={addSection}
            onPointerDown={stopDrag}
          >
            <Plus size={10} /> sekcja
          </button>
        ) : null}
      </div>
      {peekOpen ? (
        <button
          type="button"
          className="sticky bottom-1 float-right z-[2] inline-flex items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-white hover:bg-black/70"
          title="Zwiń do wysokości czasu"
          onPointerDown={stopDrag}
          onClick={(e) => {
            e.stopPropagation()
            setPeekOpen(false)
          }}
        >
          <Minimize2 size={10} /> zwiń
        </button>
      ) : overflows ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/50 to-transparent" />
          <button
            type="button"
            className="absolute bottom-2 right-1 z-[2] inline-flex items-center gap-0.5 rounded bg-black/45 px-1 py-0.5 text-[9px] text-white hover:bg-black/60"
            title="Rozszerz na boki do czytania i edycji"
            onPointerDown={stopDrag}
            onClick={(e) => {
              e.stopPropagation()
              openPeek()
            }}
          >
            <Maximize2 size={10} /> więcej
          </button>
        </>
      ) : null}
      {!peekOpen ? (
        <div
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
          onPointerDown={onResizePointerDown}
        />
      ) : null}
    </div>
  )
}

export default function PlannerWorkspace({
  board,
  onChange,
}: {
  board: PlannerBoardPayload
  onChange: (next: PlannerBoardPayload) => void
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef(board)
  const onChangeRef = useRef(onChange)
  boardRef.current = board
  onChangeRef.current = onChange
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)
  const [drag, setDrag] = useState<ActiveDrag | null>(null)
  const [noteDrag, setNoteDrag] = useState<NoteDrag | null>(null)

  const dayStartMin = board.time.startHour * 60
  const dayEndMin = board.time.endHour * 60
  const totalMin = Math.max(board.time.snapMinutes, dayEndMin - dayStartMin)
  const gridHeight = (totalMin / 60) * PX_PER_HOUR
  const days = useMemo(() => dayOffsets(board.range.dayCount), [board.range.dayCount])
  const hours = useMemo(() => hourMarks(board.time), [board.time])
  const layoutsByDay = useMemo(() => {
    const map = new Map<number, ReturnType<typeof layoutOverlappingBlocks>>()
    for (const offset of days) {
      map.set(
        offset,
        layoutOverlappingBlocks(board.blocks.filter((b) => b.dayOffset === offset))
      )
    }
    return map
  }, [board.blocks, days])

  const patch = (partial: Partial<PlannerBoardPayload>) => {
    onChange({ ...board, ...partial })
  }

  const updateBlock = (id: string, next: Partial<PlannerBlock>) => {
    onChange({
      ...board,
      blocks: board.blocks.map((b) => {
        if (b.id !== id) return b
        const merged: PlannerBlock = { ...b, ...next }
        if ('orderId' in next && !next.orderId) {
          delete merged.orderId
          delete merged.orderLabel
        }
        return merged
      }),
    })
  }

  const removeBlock = (id: string) => {
    onChange({ ...board, blocks: board.blocks.filter((b) => b.id !== id) })
    if (selectedBlockId === id) setSelectedBlockId(null)
    if (expandedBlockId === id) setExpandedBlockId(null)
  }

  const updateNote = (id: string, next: Partial<PlannerNote>) => {
    onChange({
      ...board,
      notes: board.notes.map((n) => (n.id === id ? { ...n, ...next } : n)),
    })
  }

  const removeNote = (id: string) => {
    onChange({ ...board, notes: board.notes.filter((n) => n.id !== id) })
    if (selectedNoteId === id) setSelectedNoteId(null)
  }

  const yToMin = (y: number) => {
    const raw = dayStartMin + (y / PX_PER_HOUR) * 60
    return snapMinutes(raw, board.time.snapMinutes)
  }

  const minToY = (min: number) => ((min - dayStartMin) / 60) * PX_PER_HOUR

  const insertBlock = (partial: {
    dayOffset: number
    startMin: number
    endMin: number
    title?: string
  }) => {
    const color = PLANNER_BLOCK_COLORS[board.blocks.length % PLANNER_BLOCK_COLORS.length]
    const block: PlannerBlock = {
      id: newId('blk'),
      dayOffset: partial.dayOffset,
      startMin: partial.startMin,
      endMin: partial.endMin,
      title: partial.title ?? 'Blok',
      sections: [emptyBlockSection()],
      color,
    }
    onChange({ ...board, blocks: [...board.blocks, block] })
    setSelectedBlockId(block.id)
    setSelectedNoteId(null)
    return block
  }

  const createBlockAt = (dayOffset: number, clientY: number, columnEl: HTMLElement) => {
    const rect = columnEl.getBoundingClientRect()
    const y = clientY - rect.top
    const start = clampBlockToDay(
      yToMin(y),
      yToMin(y) + PLANNER_DEFAULT_BLOCK_DURATION_MIN,
      board.time
    )
    insertBlock({
      dayOffset,
      startMin: start.startMin,
      endMin: start.endMin,
    })
  }

  const addParallelTo = (source: PlannerBlock) => {
    insertBlock({
      dayOffset: source.dayOffset,
      startMin: source.startMin,
      endMin: source.endMin,
    })
  }

  const onColumnPointerDown = (dayOffset: number, e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const onBlock = (e.target as HTMLElement).closest('[data-planner-block]')
    // Alt/Ctrl+klik — nowy blok nawet nad istniejącym (równolegle w czasie)
    if (onBlock && !(e.altKey || e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    createBlockAt(dayOffset, e.clientY, e.currentTarget)
  }

  const beginBlockDrag = (
    mode: DragMode,
    block: PlannerBlock,
    e: ReactPointerEvent<HTMLElement>
  ) => {
    if (e.button !== 0) return
    // Oddaj Alt/Ctrl+klik kolumnie (tworzenie równoległego)
    if (e.altKey || e.ctrlKey || e.metaKey) return
    e.stopPropagation()
    e.preventDefault()
    if (!gridRef.current) return
    setSelectedBlockId(block.id)
    setSelectedNoteId(null)
    setDrag({
      mode,
      blockId: block.id,
      pointerId: e.pointerId,
      originClientX: e.clientX,
      originClientY: e.clientY,
      originDayOffset: block.dayOffset,
      originStartMin: block.startMin,
      originEndMin: block.endMin,
    })
  }

  // Podczas drag kursoł łapka na całym dokumencie (kolumna ma crosshair).
  useEffect(() => {
    if (!drag && !noteDrag) return
    const prev = document.body.style.cursor
    document.body.style.cursor = drag?.mode === 'resize' ? 'ns-resize' : 'grabbing'
    return () => {
      document.body.style.cursor = prev
    }
  }, [drag, noteDrag])

  // Document-level listeners — blok może zmienić kolumnę dnia podczas drag.
  useEffect(() => {
    if (!drag) return

    /** Dzień spod kursora (nie dx/dayWidth — psuło się przy wąskich slotach równoległych / scrollu). */
    const resolveDayOffsetAtClientX = (clientX: number, fallback: number): number => {
      const grid = gridRef.current
      if (!grid) return fallback
      const cols = grid.querySelectorAll<HTMLElement>('[data-planner-day]')
      if (cols.length === 0) return fallback
      for (const el of cols) {
        const rect = el.getBoundingClientRect()
        if (clientX >= rect.left && clientX < rect.right) {
          const n = Number(el.dataset.plannerDay)
          return Number.isFinite(n) ? n : fallback
        }
      }
      let best = fallback
      let bestDist = Infinity
      for (const el of cols) {
        const rect = el.getBoundingClientRect()
        const mid = (rect.left + rect.right) / 2
        const d = Math.abs(clientX - mid)
        if (d < bestDist) {
          bestDist = d
          const n = Number(el.dataset.plannerDay)
          if (Number.isFinite(n)) best = n
        }
      }
      return best
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      const current = boardRef.current
      const dy = e.clientY - drag.originClientY
      const deltaMin = snapMinutes((dy / PX_PER_HOUR) * 60, current.time.snapMinutes)

      if (drag.mode === 'move') {
        const duration = drag.originEndMin - drag.originStartMin
        const nextDay = Math.min(
          current.range.dayCount - 1,
          Math.max(0, resolveDayOffsetAtClientX(e.clientX, drag.originDayOffset))
        )
        const clamped = clampBlockToDay(
          drag.originStartMin + deltaMin,
          drag.originStartMin + deltaMin + duration,
          current.time
        )
        onChangeRef.current({
          ...current,
          blocks: current.blocks.map((b) =>
            b.id === drag.blockId
              ? {
                  ...b,
                  dayOffset: nextDay,
                  startMin: clamped.startMin,
                  endMin: clamped.endMin,
                }
              : b
          ),
        })
      } else {
        const clamped = clampBlockToDay(
          drag.originStartMin,
          drag.originEndMin + deltaMin,
          current.time
        )
        onChangeRef.current({
          ...current,
          blocks: current.blocks.map((b) =>
            b.id === drag.blockId
              ? { ...b, startMin: clamped.startMin, endMin: clamped.endMin }
              : b
          ),
        })
      }
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [drag])

  const addNote = () => {
    const maxY = board.notes.reduce((acc, n) => Math.max(acc, n.y), 0)
    const note: PlannerNote = {
      id: newId('note'),
      y: maxY + (board.notes.length ? 120 : 8),
      title: 'Notatka',
      body: '',
      color: '#fef3c7',
    }
    onChange({ ...board, notes: [...board.notes, note] })
    setSelectedNoteId(note.id)
    setSelectedBlockId(null)
  }

  const beginNoteDrag = (note: PlannerNote, e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('textarea, input, button')) return
    e.preventDefault()
    setSelectedNoteId(note.id)
    setSelectedBlockId(null)
    setNoteDrag({
      noteId: note.id,
      pointerId: e.pointerId,
      originClientY: e.clientY,
      originY: note.y,
    })
  }

  useEffect(() => {
    if (!noteDrag) return
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== noteDrag.pointerId) return
      const current = boardRef.current
      const nextY = Math.max(0, noteDrag.originY + (e.clientY - noteDrag.originClientY))
      onChangeRef.current({
        ...current,
        notes: current.notes.map((n) => (n.id === noteDrag.noteId ? { ...n, y: nextY } : n)),
      })
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== noteDrag.pointerId) return
      setNoteDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [noteDrag])

  const selectedBlock = board.blocks.find((b) => b.id === selectedBlockId) ?? null
  const notesHeight = Math.max(gridHeight, ...board.notes.map((n) => n.y + 140), 320)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface px-3 py-2">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Start</span>
          <input
            type="date"
            className="rounded border border-border bg-background px-2 py-1 text-sm"
            value={board.range.startDate}
            onChange={(e) =>
              patch({
                range: { ...board.range, startDate: e.target.value || board.range.startDate },
              })
            }
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Dni</span>
          <input
            type="number"
            min={PLANNER_MIN_DAY_COUNT}
            max={PLANNER_MAX_DAY_COUNT}
            className="w-16 rounded border border-border bg-background px-2 py-1 text-sm"
            value={board.range.dayCount}
            onChange={(e) => {
              const dayCount = Math.min(
                PLANNER_MAX_DAY_COUNT,
                Math.max(PLANNER_MIN_DAY_COUNT, Number(e.target.value) || 1)
              )
              onChange({
                ...board,
                range: { ...board.range, dayCount },
                blocks: board.blocks.map((b) => ({
                  ...b,
                  dayOffset: Math.min(b.dayOffset, dayCount - 1),
                })),
              })
            }}
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Od</span>
          <input
            type="number"
            min={0}
            max={23}
            className="w-16 rounded border border-border bg-background px-2 py-1 text-sm"
            value={board.time.startHour}
            onChange={(e) => {
              const startHour = Math.min(23, Math.max(0, Number(e.target.value) || 0))
              const endHour = Math.max(startHour + 1, board.time.endHour)
              patch({ time: { ...board.time, startHour, endHour } })
            }}
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Do</span>
          <input
            type="number"
            min={1}
            max={24}
            className="w-16 rounded border border-border bg-background px-2 py-1 text-sm"
            value={board.time.endHour}
            onChange={(e) => {
              const endHour = Math.min(24, Math.max(1, Number(e.target.value) || 24))
              const startHour = Math.min(board.time.startHour, endHour - 1)
              patch({ time: { ...board.time, startHour, endHour } })
            }}
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Snap</span>
          <select
            className="rounded border border-border bg-background px-2 py-1 text-sm"
            value={board.time.snapMinutes}
            onChange={(e) =>
              patch({
                time: {
                  ...board.time,
                  snapMinutes: Number(e.target.value) as 5 | 15 | 30,
                },
              })
            }
          >
            <option value={5}>5 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
          </select>
        </label>
        <button
          type="button"
          onClick={addNote}
          className="ml-auto inline-flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:border-primary/40"
        >
          <Plus size={12} /> Notatka
        </button>
      </div>

      <div className="overflow-auto rounded-lg border border-border bg-background">
        <div className="flex min-w-[640px]">
          {/* Notes rail */}
          <div
            className="relative shrink-0 border-r border-border bg-surface/40"
            style={{ width: NOTES_RAIL_W, minHeight: notesHeight }}
          >
            <div className="sticky top-0 z-10 border-b border-border bg-surface px-2 py-2 text-xs font-medium">
              Notatki
            </div>
            <div className="relative" style={{ height: notesHeight - 36 }}>
              {board.notes.map((note) => (
                <div
                  key={note.id}
                  data-planner-note
                  className={`absolute left-2 right-2 cursor-grab rounded border bg-amber-50 p-2 text-slate-900 shadow-sm active:cursor-grabbing dark:bg-amber-100/90 ${
                    selectedNoteId === note.id ? 'ring-2 ring-primary' : 'border-amber-200/80'
                  }`}
                  style={{
                    top: note.y,
                    backgroundColor: note.color || undefined,
                  }}
                  onPointerDown={(e) => beginNoteDrag(note, e)}
                  onClick={() => {
                    setSelectedNoteId(note.id)
                    setSelectedBlockId(null)
                  }}
                >
                  <div className="mb-1 flex items-center gap-1">
                    <input
                      className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
                      value={note.title ?? ''}
                      placeholder="Tytuł"
                      onChange={(e) => updateNote(note.id, { title: e.target.value })}
                      onPointerDown={(e) => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      className="text-slate-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeNote(note.id)
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label="Usuń notatkę"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <textarea
                    className="h-16 w-full resize-y bg-transparent text-xs outline-none"
                    value={note.body}
                    placeholder="Treść…"
                    onChange={(e) => updateNote(note.id, { body: e.target.value })}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                </div>
              ))}
              {board.notes.length === 0 ? (
                <p className="px-3 py-6 text-xs text-muted-foreground">
                  Wolne karteczki — bez godziny. Dodaj „Notatka”.
                </p>
              ) : null}
            </div>
          </div>

          {/* Timeline */}
          <div className="min-w-0 flex-1">
            <div
              className="grid border-b border-border bg-surface"
              style={{
                gridTemplateColumns: `${TIME_GUTTER_W}px repeat(${board.range.dayCount}, minmax(120px, 1fr))`,
              }}
            >
              <div className="border-r border-border" />
              {days.map((offset) => (
                <div
                  key={offset}
                  className="border-r border-border px-2 py-2 text-center text-xs font-medium last:border-r-0"
                >
                  {formatDayHeader(addDaysIso(board.range.startDate, offset))}
                </div>
              ))}
            </div>

            <div
              ref={gridRef}
              className="relative grid"
              style={{
                gridTemplateColumns: `${TIME_GUTTER_W}px repeat(${board.range.dayCount}, minmax(120px, 1fr))`,
                height: gridHeight,
              }}
            >
              <div className="relative border-r border-border">
                {hours.map((min) => (
                  <div
                    key={min}
                    className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground"
                    style={{ top: minToY(min) }}
                  >
                    {minutesToLabel(min)}
                  </div>
                ))}
              </div>

              {days.map((offset) => (
                <div
                  key={offset}
                  data-planner-day={offset}
                  className="relative cursor-crosshair border-r border-border last:border-r-0"
                  onPointerDown={(e) => onColumnPointerDown(offset, e)}
                >
                  {hours.map((min) => (
                    <div
                      key={min}
                      className="pointer-events-none absolute inset-x-0 border-t border-border/60"
                      style={{ top: minToY(min) }}
                    />
                  ))}
                  {board.blocks
                    .filter((b) => b.dayOffset === offset)
                    .map((block) => {
                      const top = minToY(block.startMin)
                      const height = Math.max(18, minToY(block.endMin) - top)
                      const selected = selectedBlockId === block.id
                      const slot = layoutsByDay.get(offset)?.get(block.id)
                      const col = slot?.col ?? 0
                      const colCount = slot?.colCount ?? 1
                      const gapPx = 2
                      const widthPct = 100 / colCount
                      const leftPct = widthPct * col
                      return (
                        <PlannerDayBlock
                          key={block.id}
                          block={block}
                          top={top}
                          height={height}
                          left={`calc(${leftPct}% + ${gapPx}px)`}
                          width={`calc(${widthPct}% - ${gapPx * 2}px)`}
                          selected={selected}
                          dragging={drag?.blockId === block.id}
                          onMovePointerDown={(e) => beginBlockDrag('move', block, e)}
                          onResizePointerDown={(e) => beginBlockDrag('resize', block, e)}
                          onSelect={() => {
                            setSelectedBlockId(block.id)
                            setSelectedNoteId(null)
                          }}
                          onChangeBlock={(patch) => updateBlock(block.id, patch)}
                        />
                      )
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!selectedBlock ? (
        <p className="text-xs text-muted-foreground">
          Kliknij blok, żeby pisać sekcje na nim. Panel narzędzi pojawia się w prawym dolnym rogu.
        </p>
      ) : null}

      {selectedBlock ? (
        <div className="fixed bottom-4 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-3 shadow-2xl">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{selectedBlock.title || 'Blok'}</div>
              <div className="text-[10px] text-muted-foreground">
                {minutesToLabel(selectedBlock.startMin)}–{minutesToLabel(selectedBlock.endMin)}
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedBlockId(null)}
              aria-label="Zamknij panel bloku"
            >
              ✕
            </button>
          </div>
          <div className="mb-2">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Kolor
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PLANNER_BLOCK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-7 w-7 rounded-md border ${
                    selectedBlock.color === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface' : 'border-border'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => updateBlock(selectedBlock.id, { color: c })}
                  aria-label={`Kolor ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="mb-2">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Zlecenie
            </div>
            <PlannerBlockOrderAttach
              orderId={selectedBlock.orderId}
              orderLabel={selectedBlock.orderLabel}
              variant="light"
              onAttach={(orderId, orderLabel) => updateBlock(selectedBlock.id, { orderId, orderLabel })}
              onDetach={() => updateBlock(selectedBlock.id, { orderId: undefined, orderLabel: undefined })}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:border-primary/40"
              onClick={() => addParallelTo(selectedBlock)}
            >
              <Plus size={12} /> Równoległy
            </button>
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:border-primary/40"
              onClick={() => setExpandedBlockId(selectedBlock.id)}
            >
              <Maximize2 size={12} /> Edytor
            </button>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1 rounded border border-red-500/40 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
              onClick={() => removeBlock(selectedBlock.id)}
            >
              <Trash2 size={12} /> Usuń blok
            </button>
          </div>
        </div>
      ) : null}

      {expandedBlockId && board.blocks.some((b) => b.id === expandedBlockId) ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setExpandedBlockId(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setExpandedBlockId(null)
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const block = board.blocks.find((b) => b.id === expandedBlockId)
              if (!block) return null
              return (
                <>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold">{block.title || 'Blok'}</h2>
                      <p className="text-xs text-muted-foreground">
                        {minutesToLabel(block.startMin)}–{minutesToLabel(block.endMin)} · pełna
                        edycja sekcji
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1 text-xs"
                      onClick={() => setExpandedBlockId(null)}
                    >
                      Zamknij
                    </button>
                  </div>
                  <input
                    className="mb-3 w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-medium"
                    value={block.title}
                    onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                    aria-label="Tytuł"
                  />
                  <div className="mb-3">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Kolor
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PLANNER_BLOCK_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`h-7 w-7 rounded-md border ${
                            block.color === c ? 'ring-2 ring-primary' : 'border-border'
                          }`}
                          style={{ backgroundColor: c }}
                          onClick={() => updateBlock(block.id, { color: c })}
                          aria-label={`Kolor ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Zlecenie
                    </div>
                    <PlannerBlockOrderAttach
                      orderId={block.orderId}
                      orderLabel={block.orderLabel}
                      variant="light"
                      onAttach={(orderId, orderLabel) => updateBlock(block.id, { orderId, orderLabel })}
                      onDetach={() => updateBlock(block.id, { orderId: undefined, orderLabel: undefined })}
                    />
                  </div>
                  <PlannerBlockSectionsEditor
                    sections={block.sections ?? []}
                    onChange={(sections) => updateBlock(block.id, { sections })}
                  />
                </>
              )
            })()}
          </div>
        </div>
      ) : null}
    </div>
  )
}
