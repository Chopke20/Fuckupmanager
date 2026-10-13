import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Maximize2, Plus, Trash2 } from 'lucide-react'
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
  snapMinutes,
  type PlannerBlock,
  type PlannerBoardPayload,
  type PlannerNote,
} from '../planner/plannerTypes'
import PlannerBlockSectionsEditor from './PlannerBlockSectionsEditor'

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
  dayWidth: number
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
  onExpand,
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
  onExpand: () => void
  onChangeBlock: (patch: Partial<PlannerBlock>) => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const sections = block.sections ?? []

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [block.title, block.sections, height, width, selected])

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

  return (
    <div
      data-planner-block
      className={`absolute z-[1] overflow-hidden rounded-md border px-1.5 py-1 text-xs text-white shadow-sm ${
        selected ? 'ring-2 ring-white/80 z-[2] cursor-default' : 'cursor-grab active:cursor-grabbing'
      } ${dragging ? 'cursor-grabbing' : ''}`}
      style={{
        top,
        height,
        left,
        width,
        backgroundColor: block.color || PLANNER_BLOCK_COLORS[0],
        borderColor: 'rgba(0,0,0,0.2)',
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('input, textarea, button')) return
        onMovePointerDown(e)
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('input, textarea, button')) return
        e.stopPropagation()
        onExpand()
      }}
    >
      <div ref={contentRef} className="flex h-full flex-col gap-0.5 overflow-hidden pb-3">
        {selected ? (
          <input
            className="w-full truncate bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/60"
            value={block.title}
            placeholder="Tytuł bloku"
            onChange={(e) => onChangeBlock({ title: e.target.value })}
            onPointerDown={stopDrag}
          />
        ) : (
          <div className="truncate font-medium leading-tight">{block.title}</div>
        )}
        <div className="truncate text-[10px] opacity-90">
          {minutesToLabel(block.startMin)}–{minutesToLabel(block.endMin)}
        </div>

        {selected
          ? sections.map((section, index) => (
              <div
                key={section.id}
                className="mt-0.5 rounded bg-black/20 px-1 py-0.5"
                onPointerDown={stopDrag}
              >
                <div className="flex items-center gap-1">
                  <input
                    className="min-w-0 flex-1 bg-transparent text-[10px] font-semibold text-white outline-none placeholder:text-white/55"
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
                  className="mt-0.5 max-h-16 w-full resize-none bg-transparent text-[10px] leading-snug text-white outline-none placeholder:text-white/50"
                  rows={2}
                  value={section.text}
                  placeholder="Treść…"
                  onChange={(e) => updateSection(section.id, { text: e.target.value })}
                  onPointerDown={stopDrag}
                />
              </div>
            ))
          : sections.map((section) =>
              section.title.trim() || section.text.trim() ? (
                <div key={section.id} className="mt-0.5 leading-snug">
                  {section.title.trim() ? (
                    <div className="truncate text-[10px] font-semibold opacity-95">{section.title}</div>
                  ) : null}
                  {section.text.trim() ? (
                    <p className="whitespace-pre-wrap break-words text-[10px] opacity-90">
                      {section.text}
                    </p>
                  ) : null}
                </div>
              ) : null
            )}

        {selected ? (
          <button
            type="button"
            className="mt-0.5 inline-flex w-fit items-center gap-0.5 rounded bg-black/25 px-1 py-0.5 text-[9px] text-white/90 hover:bg-black/40"
            onClick={addSection}
            onPointerDown={stopDrag}
          >
            <Plus size={10} /> sekcja
          </button>
        ) : null}
      </div>
      {overflows ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/50 to-transparent" />
          <button
            type="button"
            className="absolute bottom-2 right-1 z-[2] inline-flex items-center gap-0.5 rounded bg-black/45 px-1 py-0.5 text-[9px] text-white hover:bg-black/60"
            title="Tekst się nie mieści — rozwiń do edycji"
            onPointerDown={stopDrag}
            onClick={(e) => {
              e.stopPropagation()
              onExpand()
            }}
          >
            <Maximize2 size={10} /> więcej
          </button>
        </>
      ) : null}
      <div
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
        onPointerDown={onResizePointerDown}
      />
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
      blocks: board.blocks.map((b) => (b.id === id ? { ...b, ...next } : b)),
    })
  }

  const removeBlock = (id: string) => {
    onChange({ ...board, blocks: board.blocks.filter((b) => b.id !== id) })
    if (selectedBlockId === id) setSelectedBlockId(null)
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
    const grid = gridRef.current
    if (!grid) return
    const dayWidth = Math.max(40, (grid.clientWidth - TIME_GUTTER_W) / board.range.dayCount)
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
      dayWidth,
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
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      const current = boardRef.current
      const dx = e.clientX - drag.originClientX
      const dy = e.clientY - drag.originClientY
      const deltaMin = snapMinutes((dy / PX_PER_HOUR) * 60, current.time.snapMinutes)
      const dayDelta = Math.round(dx / drag.dayWidth)

      if (drag.mode === 'move') {
        const duration = drag.originEndMin - drag.originStartMin
        const nextDay = Math.min(
          current.range.dayCount - 1,
          Math.max(0, drag.originDayOffset + dayDelta)
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
                          onExpand={() => {
                            setSelectedBlockId(block.id)
                            setExpandedBlockId(block.id)
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

      {selectedBlock ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <p className="mr-auto self-center text-xs text-muted-foreground">
            Sekcje edytujesz na bloku (tytuł + treść). Gdy się nie mieszczą — „więcej”.
          </p>
          <label className="text-xs">
            <span className="mb-1 block text-muted-foreground">Kolor</span>
            <div className="flex gap-1">
              {PLANNER_BLOCK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-6 w-6 rounded border ${
                    selectedBlock.color === c ? 'ring-2 ring-primary' : 'border-border'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => updateBlock(selectedBlock.id, { color: c })}
                  aria-label={`Kolor ${c}`}
                />
              ))}
            </div>
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:border-primary/40"
            onClick={() => addParallelTo(selectedBlock)}
          >
            <Plus size={12} /> Równoległy
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:border-primary/40"
            onClick={() => setExpandedBlockId(selectedBlock.id)}
          >
            <Maximize2 size={12} /> Duży edytor
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-red-500/40 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
            onClick={() => removeBlock(selectedBlock.id)}
          >
            <Trash2 size={12} /> Usuń blok
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Kliknij blok, żeby pisać sekcje bezpośrednio na nim. Alt+klik = równoległy. Gdy tekst się
          nie mieści — „więcej” / dwuklik.
        </p>
      )}

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
