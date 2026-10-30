import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { submitBugReport } from './api'
import {
  ensureConsoleErrorCapture,
  getRecentApiFailures,
  getRecentConsoleErrors,
  hasRecentApiFailures,
  minutesOnPage,
} from './diagnostics'
import SpinaczAvatar, { type SpinaczMood } from './SpinaczAvatar'
import {
  BUG_TYPE_LABELS,
  BUG_URGENCY_LABELS,
  MIN_BUG_MESSAGE_LENGTH,
  moduleLabelFromPath,
  openContextForCount,
  pickSpinaczLine,
  timeBonusContext,
  type BugReportType,
  type BugUrgency,
  typeContext,
  urgencyContext,
} from './personality'

const DRAFT_KEY = 'lama-spinacz-draft-v1'
const COLLAPSED_KEY = 'lama-spinacz-collapsed-v1'
const DAY_COUNT_KEY = 'lama-spinacz-day-count-v1'
/** right/bottom — kotwica przy dolnym-prawym rogu (avatar nie spada poza ekran przy otwarciu). */
const POS_KEY = 'lama-spinacz-pos-v2'
const NEUTRAL_PLACEHOLDER = 'Co nie gra na tym ekranie?'
const DRAG_THRESHOLD_PX = 5
const AVATAR_SCALE = 1.2
const EDGE_MARGIN = 4

type PanelState = 'idle' | 'open' | 'sending' | 'success' | 'error'
/** Odległość prawej/dolnej krawędzi widgetu od krawędzi viewportu. */
type WidgetPos = { right: number; bottom: number }

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function readDayCount(): number {
  try {
    const raw = window.localStorage.getItem(DAY_COUNT_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { day?: string; count?: number }
    if (parsed.day !== todayKey()) return 0
    return typeof parsed.count === 'number' ? parsed.count : 0
  } catch {
    return 0
  }
}

function bumpDayCount(): number {
  const count = readDayCount() + 1
  try {
    window.localStorage.setItem(DAY_COUNT_KEY, JSON.stringify({ day: todayKey(), count }))
  } catch {
    /* ignore */
  }
  return count
}

function readDraft(): { message: string; type: BugReportType; urgency: BugUrgency } | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      message?: string
      type?: BugReportType
      urgency?: BugUrgency
    }
    if (typeof parsed.message !== 'string' || !parsed.message.trim()) return null
    return {
      message: parsed.message,
      type: parsed.type && parsed.type in BUG_TYPE_LABELS ? parsed.type : 'broken',
      urgency: parsed.urgency && parsed.urgency in BUG_URGENCY_LABELS ? parsed.urgency : 'ok',
    }
  } catch {
    return null
  }
}

function writeDraft(message: string, type: BugReportType, urgency: BugUrgency) {
  try {
    if (!message.trim()) {
      window.localStorage.removeItem(DRAFT_KEY)
      return
    }
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ message, type, urgency }))
  } catch {
    /* ignore */
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

function readPos(): WidgetPos | null {
  try {
    const raw = window.localStorage.getItem(POS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { right?: number; bottom?: number }
    if (typeof parsed.right !== 'number' || typeof parsed.bottom !== 'number') return null
    if (!Number.isFinite(parsed.right) || !Number.isFinite(parsed.bottom)) return null
    return { right: parsed.right, bottom: parsed.bottom }
  } catch {
    return null
  }
}

function writePos(pos: WidgetPos) {
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify(pos))
  } catch {
    /* ignore */
  }
}

function clampPos(pos: WidgetPos, width: number, height: number): WidgetPos {
  const maxRight = Math.max(EDGE_MARGIN, window.innerWidth - width - EDGE_MARGIN)
  const maxBottom = Math.max(EDGE_MARGIN, window.innerHeight - height - EDGE_MARGIN)
  return {
    right: Math.min(maxRight, Math.max(EDGE_MARGIN, pos.right)),
    bottom: Math.min(maxBottom, Math.max(EDGE_MARGIN, pos.bottom)),
  }
}

export default function SpinaczWidget() {
  const { user, isAdmin, isAuthenticated } = useAuth()
  const location = useLocation()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const pageMountedAt = useRef(Date.now())
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origRight: number
    origBottom: number
    moved: boolean
  } | null>(null)
  const posRef = useRef<WidgetPos | null>(readPos())
  const suppressClickRef = useRef(false)

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const [panel, setPanel] = useState<PanelState>('idle')
  const [bubble, setBubble] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState<BugReportType>('broken')
  const [urgency, setUrgency] = useState<BugUrgency>('ok')
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [pos, setPos] = useState<WidgetPos | null>(() => posRef.current)
  const [dragging, setDragging] = useState(false)
  const typingTimer = useRef<number | null>(null)
  const typedOnce = useRef(false)

  const updatePos = (next: WidgetPos | null) => {
    posRef.current = next
    setPos(next)
  }

  const moduleLabel = useMemo(() => moduleLabelFromPath(location.pathname), [location.pathname])
  const raiseForPlanner = location.pathname.startsWith('/toolbox/planer')
  const isFormOpen = panel === 'open' || panel === 'sending' || panel === 'success' || panel === 'error'
  const showCollapsedOnly = collapsed && panel === 'idle'

  useEffect(() => {
    ensureConsoleErrorCapture()
  }, [])

  useEffect(() => {
    pageMountedAt.current = Date.now()
  }, [location.pathname])

  useEffect(() => {
    if (panel !== 'open') return
    const id = window.setTimeout(() => textareaRef.current?.focus(), 40)
    return () => window.clearTimeout(id)
  }, [panel])

  useEffect(() => {
    if (panel !== 'open') return
    writeDraft(message, type, urgency)
  }, [message, type, urgency, panel])

  // Po otwarciu / zmianie wysokości — dociśnij do viewportu (rośnie w górę, nie znika w dół)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const current = posRef.current ?? {
      right: EDGE_MARGIN,
      bottom: raiseForPlanner ? 112 : 16,
    }
    const next = clampPos(current, el.offsetWidth, el.offsetHeight)
    if (posRef.current && (next.right !== current.right || next.bottom !== current.bottom)) {
      writePos(next)
      updatePos(next)
    } else if (!posRef.current) {
      // bez zapisu — tylko upewnij się że default nie wystaje
      const def = clampPos(
        { right: EDGE_MARGIN, bottom: raiseForPlanner ? 112 : 16 },
        el.offsetWidth,
        el.offsetHeight,
      )
      if (def.bottom !== (raiseForPlanner ? 112 : 16) || def.right !== EDGE_MARGIN) {
        updatePos(def)
        writePos(def)
      }
    }
  }, [panel, isFormOpen, raiseForPlanner])

  useEffect(() => {
    const onResize = () => {
      const prev = posRef.current
      if (!prev || !rootRef.current) return
      const next = clampPos(prev, rootRef.current.offsetWidth, rootRef.current.offsetHeight)
      writePos(next)
      updatePos(next)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!isAuthenticated || !user) return null

  const mood: SpinaczMood =
    panel === 'sending'
      ? 'send'
      : panel === 'success'
        ? 'done'
        : panel === 'error'
          ? 'mad'
          : panel === 'open'
            ? message.trim().length > 0
              ? 'think'
              : 'talk'
            : 'idle'

  const openPanel = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    const draft = readDraft()
    const dayCount = readDayCount()
    let line = pickSpinaczLine(openContextForCount(dayCount), {
      isAdmin,
      vars: { count: String(dayCount + 1), module: moduleLabel, hour: String(new Date().getHours()) },
    })

    if (Math.random() < 0.25) {
      if (hasRecentApiFailures()) {
        line = pickSpinaczLine('diag_errors', { isAdmin })
      } else if (Math.random() < 0.4) {
        line = pickSpinaczLine('diag_clean', { isAdmin })
      } else if (timeBonusContext()) {
        line = pickSpinaczLine('time', {
          isAdmin,
          vars: { hour: `${new Date().getHours()}:00` },
        })
      } else if (Math.random() < 0.5) {
        line = pickSpinaczLine('module', { isAdmin, vars: { module: moduleLabel } })
      }
    }

    if (draft) {
      setMessage(draft.message)
      setType(draft.type)
      setUrgency(draft.urgency)
      setBubble(pickSpinaczLine('draft_restored', { isAdmin }))
    } else {
      setMessage('')
      setType('broken')
      setUrgency('ok')
      setBubble(line)
    }
    setTicketId(null)
    typedOnce.current = false
    setPanel('open')
    setCollapsed(false)
  }

  const collapse = () => {
    setBubble(pickSpinaczLine('collapse', { isAdmin }))
    setPanel('idle')
    setCollapsed(true)
    try {
      window.localStorage.setItem(COLLAPSED_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const cancel = () => {
    setBubble(pickSpinaczLine('cancel', { isAdmin }))
    setPanel('idle')
  }

  const onTypeChange = (next: BugReportType) => {
    setType(next)
    setBubble(pickSpinaczLine(typeContext(next), { isAdmin }))
  }

  const onUrgencyChange = (next: BugUrgency) => {
    setUrgency(next)
    setBubble(pickSpinaczLine(urgencyContext(next), { isAdmin }))
  }

  const onMessageChange = (value: string) => {
    setMessage(value)
    if (!typedOnce.current && value.trim().length >= 8) {
      typedOnce.current = true
      if (typingTimer.current) window.clearTimeout(typingTimer.current)
      typingTimer.current = window.setTimeout(() => {
        setBubble(pickSpinaczLine('typing', { isAdmin }))
      }, 5000)
    }
  }

  const send = async () => {
    const trimmed = message.trim()
    if (trimmed.length < MIN_BUG_MESSAGE_LENGTH) {
      setBubble(pickSpinaczLine('too_short', { isAdmin }))
      return
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPanel('error')
      setBubble(pickSpinaczLine('error_offline', { isAdmin }))
      return
    }

    const apiFailures = getRecentApiFailures()
    const spinaczAside = pickSpinaczLine('mail_aside', { isAdmin })

    setPanel('sending')
    setBubble(pickSpinaczLine('sending', { isAdmin }))

    try {
      const res = await submitBugReport({
        message: trimmed,
        type,
        urgency,
        pageTitle: typeof document !== 'undefined' ? document.title : moduleLabel,
        pathname: location.pathname,
        moduleLabel,
        uiVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'main-unknown',
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        minutesOnPage: minutesOnPage(pageMountedAt.current),
        userAgent: navigator.userAgent,
        apiFailures,
        consoleErrors: getRecentConsoleErrors(),
        spinaczAside,
      })
      bumpDayCount()
      clearDraft()
      setTicketId(res.ticketId)
      setPanel('success')
      setBubble(pickSpinaczLine('success', { isAdmin, vars: { ticketId: res.ticketId } }))
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setPanel('error')
      if (status === 429) {
        setBubble(pickSpinaczLine('error_limit', { isAdmin, vars: { count: '5' } }))
      } else {
        setBubble(pickSpinaczLine('error_smtp', { isAdmin }))
      }
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send()
  }

  const ensurePosFromDom = (): WidgetPos => {
    if (posRef.current) return posRef.current
    const el = rootRef.current
    if (!el) {
      return { right: EDGE_MARGIN, bottom: raiseForPlanner ? 112 : 16 }
    }
    const rect = el.getBoundingClientRect()
    return {
      right: Math.max(EDGE_MARGIN, window.innerWidth - rect.right),
      bottom: Math.max(EDGE_MARGIN, window.innerHeight - rect.bottom),
    }
  }

  const onDragPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button[aria-label="Zamknij"], a, input, textarea, select')) return

    const current = ensurePosFromDom()
    if (!posRef.current) updatePos(current)

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origRight: current.right,
      origBottom: current.bottom,
      moved: false,
    }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onDragPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return

    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    drag.moved = true

    const el = rootRef.current
    const width = el?.offsetWidth ?? 360
    const height = el?.offsetHeight ?? 220
    // ruch w prawo → mniejszy `right`; ruch w dół → mniejszy `bottom`
    const next = clampPos(
      { right: drag.origRight - dx, bottom: drag.origBottom - dy },
      width,
      height,
    )
    updatePos(next)
  }

  const onDragPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return

    if (drag.moved) {
      suppressClickRef.current = true
      if (posRef.current) writePos(posRef.current)
    }
    dragRef.current = null
    setDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const defaultBottom = raiseForPlanner ? 112 : 16
  const positionStyle = pos
    ? { right: pos.right, bottom: pos.bottom, left: 'auto' as const, top: 'auto' as const }
    : { right: EDGE_MARGIN, bottom: defaultBottom, left: 'auto' as const, top: 'auto' as const }

  return (
    <div
      ref={rootRef}
      className={`spinacz-root fixed z-50 flex flex-row-reverse items-end gap-2 ${
        dragging ? 'spinacz-dragging' : ''
      }`}
      style={positionStyle}
    >
      {/* Avatar — zawsze przy prawej krawędzi widgetu */}
      <button
        type="button"
        title={
          panel === 'idle'
            ? `${pickSpinaczLine('tooltip', { isAdmin })} (przeciągnij, żeby przesunąć)`
            : 'Przeciągnij Pana Spinacza'
        }
        onClick={panel === 'idle' ? openPanel : undefined}
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
        className="spinacz-hit spinacz-drag-handle shrink-0 cursor-grab"
        aria-label={panel === 'idle' ? 'Otwórz Pana Spinacza — zgłoś problem' : 'Przesuń Pana Spinacza'}
      >
        <SpinaczAvatar mood={mood} scale={AVATAR_SCALE} />
      </button>

      {/* Dymek + panel po LEWEJ od spinacza */}
      {!showCollapsedOnly && isFormOpen ? (
        <div className="spinacz-side flex w-[min(28rem,calc(100vw-6.5rem))] flex-col items-stretch gap-2">
          {bubble ? (
            <div
              className="spinacz-balloon spinacz-balloon-side spinacz-drag-handle relative px-4 py-3.5 pr-9"
              onPointerDown={onDragPointerDown}
              onPointerMove={onDragPointerMove}
              onPointerUp={onDragPointerUp}
              onPointerCancel={onDragPointerUp}
            >
              <p className="text-[15px] leading-snug text-[#1a1a1a]">{bubble}</p>
              {ticketId && panel === 'success' ? (
                <p className="mt-1.5 font-mono text-[12px] text-[#3d5a1f]">{ticketId}</p>
              ) : null}
              <button
                type="button"
                onClick={panel === 'open' ? cancel : () => setPanel('idle')}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded text-[#666] hover:bg-black/5 hover:text-[#222]"
                aria-label="Zamknij"
              >
                ×
              </button>
              <span className="spinacz-balloon-tail-side" aria-hidden />
            </div>
          ) : null}

          <div className="spinacz-panel overflow-hidden">
            {panel === 'open' && (
              <form onSubmit={onSubmit} className="p-4 space-y-3.5">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Typ problemu">
                  {(Object.keys(BUG_TYPE_LABELS) as BugReportType[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onTypeChange(key)}
                      className={`spinacz-chip ${type === key ? 'spinacz-chip-on' : ''}`}
                    >
                      {BUG_TYPE_LABELS[key]}
                    </button>
                  ))}
                </div>

                <div className="spinacz-segment" role="group" aria-label="Pilność">
                  {(Object.keys(BUG_URGENCY_LABELS) as BugUrgency[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onUrgencyChange(key)}
                      className={`spinacz-segment-btn ${urgency === key ? 'spinacz-segment-on' : ''}`}
                    >
                      {BUG_URGENCY_LABELS[key]}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      void send()
                    }
                  }}
                  rows={5}
                  placeholder={NEUTRAL_PLACEHOLDER}
                  className="spinacz-textarea"
                />

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <button type="button" onClick={collapse} className="spinacz-ghost">
                    Zwiń
                  </button>
                  <button type="submit" className="spinacz-send">
                    Wyślij
                  </button>
                </div>
              </form>
            )}

            {panel === 'sending' && (
              <div className="px-4 py-4 text-sm text-zinc-400">Pakuję maila…</div>
            )}

            {(panel === 'success' || panel === 'error') && (
              <div className="flex items-center justify-end gap-2 px-4 py-3.5">
                {panel === 'error' ? (
                  <button type="button" onClick={() => void send()} className="spinacz-send">
                    Ponów
                  </button>
                ) : null}
                <button type="button" onClick={() => setPanel('idle')} className="spinacz-ghost-border">
                  Zamknij
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
