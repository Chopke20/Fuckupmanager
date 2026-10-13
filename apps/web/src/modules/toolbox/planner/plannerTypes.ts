export const PLANNER_BOARD_VERSION = 1 as const

export const PLANNER_MIN_DAY_COUNT = 1
export const PLANNER_MAX_DAY_COUNT = 14
export const PLANNER_DEFAULT_START_HOUR = 6
export const PLANNER_DEFAULT_END_HOUR = 24
export const PLANNER_DEFAULT_SNAP_MINUTES = 15
export const PLANNER_DEFAULT_BLOCK_DURATION_MIN = 60

export const PLANNER_BLOCK_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#a855f7',
  '#14b8a6',
  '#64748b',
] as const

export type PlannerBlockColor = (typeof PLANNER_BLOCK_COLORS)[number]

export interface PlannerRange {
  startDate: string
  dayCount: number
}

export interface PlannerTimeSettings {
  startHour: number
  endHour: number
  snapMinutes: number
}

export interface PlannerBlockSection {
  id: string
  text: string
}

export interface PlannerBlock {
  id: string
  dayOffset: number
  startMin: number
  endMin: number
  title: string
  /** @deprecated migracja → sections */
  body?: string
  sections: PlannerBlockSection[]
  color?: string
}

export interface PlannerNote {
  id: string
  y: number
  title?: string
  body: string
  color?: string
}

export interface PlannerBoardPayload {
  version: typeof PLANNER_BOARD_VERSION
  range: PlannerRange
  time: PlannerTimeSettings
  blocks: PlannerBlock[]
  notes: PlannerNote[]
}

export function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export function todayIsoDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function emptyPlannerBoard(startDate = todayIsoDate()): PlannerBoardPayload {
  return {
    version: PLANNER_BOARD_VERSION,
    range: { startDate, dayCount: 2 },
    time: {
      startHour: PLANNER_DEFAULT_START_HOUR,
      endHour: PLANNER_DEFAULT_END_HOUR,
      snapMinutes: PLANNER_DEFAULT_SNAP_MINUTES,
    },
    blocks: [],
    notes: [],
  }
}

export function serializePlannerBoard(board: PlannerBoardPayload): string {
  return JSON.stringify(board)
}

export function parsePlannerBoardJson(raw: string): PlannerBoardPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    return normalizePlannerBoard(parsed)
  } catch {
    return null
  }
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.floor(n)))
}

export function snapMinutes(value: number, snap: number): number {
  const s = snap > 0 ? snap : PLANNER_DEFAULT_SNAP_MINUTES
  return Math.round(value / s) * s
}

export function clampBlockToDay(
  startMin: number,
  endMin: number,
  time: PlannerTimeSettings
): { startMin: number; endMin: number } {
  const dayStart = time.startHour * 60
  const dayEnd = time.endHour * 60
  const snap = time.snapMinutes
  let start = snapMinutes(startMin, snap)
  let end = snapMinutes(endMin, snap)
  if (end <= start) end = start + snap
  start = Math.max(dayStart, Math.min(start, dayEnd - snap))
  end = Math.max(start + snap, Math.min(end, dayEnd))
  return { startMin: start, endMin: end }
}

function parseIsoParts(isoDate: string): { y: number; m: number; d: number } {
  const parts = isoDate.split('-').map(Number)
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return { y, m, d }
}

export function addDaysIso(isoDate: string, offset: number): string {
  const { y, m, d } = parseIsoParts(isoDate)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + offset)
  return todayIsoDate(new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()))
}

export function formatDayHeader(isoDate: string): string {
  const { y, m, d } = parseIsoParts(isoDate)
  const dt = new Date(y, m - 1, d)
  const weekday = dt.toLocaleDateString('pl-PL', { weekday: 'short' })
  const day = dt.toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' })
  return `${weekday} ${day}`
}

export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function dayOffsets(dayCount: number): number[] {
  return Array.from({ length: dayCount }, (_, i) => i)
}

export function hourMarks(time: PlannerTimeSettings): number[] {
  const marks: number[] = []
  for (let h = time.startHour; h < time.endHour; h++) {
    marks.push(h * 60)
  }
  return marks
}

export interface BlockLayoutSlot {
  col: number
  colCount: number
}

/** Układ jak w Google Calendar: nakładające się bloki w dniu dostają kolumny obok siebie. */
export function layoutOverlappingBlocks(blocks: PlannerBlock[]): Map<string, BlockLayoutSlot> {
  const result = new Map<string, BlockLayoutSlot>()
  if (blocks.length === 0) return result

  const sorted = [...blocks].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.id.localeCompare(b.id)
  )

  const clusters: PlannerBlock[][] = []
  let current: PlannerBlock[] = []
  let clusterEnd = -1
  for (const b of sorted) {
    if (current.length === 0 || b.startMin < clusterEnd) {
      current.push(b)
      clusterEnd = Math.max(clusterEnd, b.endMin)
    } else {
      clusters.push(current)
      current = [b]
      clusterEnd = b.endMin
    }
  }
  if (current.length) clusters.push(current)

  for (const cluster of clusters) {
    const colEnds: number[] = []
    const cols = new Map<string, number>()
    const ordered = [...cluster].sort(
      (a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.id.localeCompare(b.id)
    )
    for (const b of ordered) {
      let placed = false
      for (let c = 0; c < colEnds.length; c++) {
        const end = colEnds[c]
        if (end !== undefined && end <= b.startMin) {
          cols.set(b.id, c)
          colEnds[c] = b.endMin
          placed = true
          break
        }
      }
      if (!placed) {
        cols.set(b.id, colEnds.length)
        colEnds.push(b.endMin)
      }
    }
    const colCount = Math.max(1, colEnds.length)
    for (const b of cluster) {
      result.set(b.id, { col: cols.get(b.id) ?? 0, colCount })
    }
  }
  return result
}

export function normalizeBlockSections(raw: Record<string, unknown>): PlannerBlockSection[] {
  const sectionsIn = Array.isArray(raw.sections) ? raw.sections : []
  const out: PlannerBlockSection[] = []
  for (const item of sectionsIn.slice(0, 40)) {
    if (!item || typeof item !== 'object') continue
    const s = item as Record<string, unknown>
    if (typeof s.id !== 'string' || !s.id) continue
    out.push({
      id: s.id.slice(0, 80),
      text: typeof s.text === 'string' ? s.text.slice(0, 4000) : '',
    })
  }
  if (out.length === 0 && typeof raw.body === 'string' && raw.body.trim()) {
    out.push({ id: newId('sec'), text: raw.body.slice(0, 4000) })
  }
  return out
}

export function emptyBlockSection(): PlannerBlockSection {
  return { id: newId('sec'), text: '' }
}

export function normalizePlannerBoard(raw: unknown): PlannerBoardPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.version !== PLANNER_BOARD_VERSION) return null

  const rangeRaw = obj.range
  const timeRaw = obj.time
  if (!rangeRaw || typeof rangeRaw !== 'object') return null
  if (!timeRaw || typeof timeRaw !== 'object') return null

  const rangeObj = rangeRaw as Record<string, unknown>
  const timeObj = timeRaw as Record<string, unknown>
  if (!isIsoDate(rangeObj.startDate)) return null

  const dayCount = clampInt(Number(rangeObj.dayCount), PLANNER_MIN_DAY_COUNT, PLANNER_MAX_DAY_COUNT)
  let startHour = clampInt(Number(timeObj.startHour), 0, 23)
  let endHour = clampInt(Number(timeObj.endHour), 1, 24)
  if (endHour <= startHour) {
    startHour = PLANNER_DEFAULT_START_HOUR
    endHour = PLANNER_DEFAULT_END_HOUR
  }
  const snapRaw = Number(timeObj.snapMinutes)
  const snapMinutesVal = snapRaw === 30 || snapRaw === 15 || snapRaw === 5 ? snapRaw : PLANNER_DEFAULT_SNAP_MINUTES

  const time: PlannerTimeSettings = {
    startHour,
    endHour,
    snapMinutes: snapMinutesVal,
  }

  const blocksIn = Array.isArray(obj.blocks) ? obj.blocks : []
  const notesIn = Array.isArray(obj.notes) ? obj.notes : []

  const blocks: PlannerBlock[] = []
  for (const item of blocksIn.slice(0, 500)) {
    if (!item || typeof item !== 'object') continue
    const b = item as Record<string, unknown>
    if (typeof b.id !== 'string' || !b.id) continue
    const dayOffset = clampInt(Number(b.dayOffset), 0, dayCount - 1)
    const clamped = clampBlockToDay(Number(b.startMin), Number(b.endMin), time)
    const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 120) : 'Blok'
    const color = typeof b.color === 'string' ? b.color.slice(0, 32) : undefined
    const sections = normalizeBlockSections(b)
    blocks.push({
      id: b.id.slice(0, 80),
      dayOffset,
      startMin: clamped.startMin,
      endMin: clamped.endMin,
      title,
      sections,
      ...(color ? { color } : {}),
    })
  }

  const notes: PlannerNote[] = []
  for (const item of notesIn.slice(0, 200)) {
    if (!item || typeof item !== 'object') continue
    const n = item as Record<string, unknown>
    if (typeof n.id !== 'string' || !n.id) continue
    const body = typeof n.body === 'string' ? n.body.slice(0, 4000) : ''
    const title = typeof n.title === 'string' ? n.title.slice(0, 120) : undefined
    const color = typeof n.color === 'string' ? n.color.slice(0, 32) : undefined
    const y = Number.isFinite(Number(n.y)) ? Math.max(0, Number(n.y)) : 0
    notes.push({
      id: n.id.slice(0, 80),
      y,
      body,
      ...(title ? { title } : {}),
      ...(color ? { color } : {}),
    })
  }

  return {
    version: PLANNER_BOARD_VERSION,
    range: { startDate: rangeObj.startDate, dayCount },
    time,
    blocks,
    notes,
  }
}
