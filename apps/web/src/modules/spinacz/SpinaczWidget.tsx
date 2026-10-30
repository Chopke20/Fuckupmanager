import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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
const NEUTRAL_PLACEHOLDER = 'Co nie gra na tym ekranie?'

type PanelState = 'idle' | 'open' | 'sending' | 'success' | 'error'

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

export default function SpinaczWidget() {
  const { user, isAdmin, isAuthenticated } = useAuth()
  const location = useLocation()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pageMountedAt = useRef(Date.now())

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
  const typingTimer = useRef<number | null>(null)
  const typedOnce = useRef(false)

  const moduleLabel = useMemo(() => moduleLabelFromPath(location.pathname), [location.pathname])
  const raiseForPlanner = location.pathname.startsWith('/toolbox/planer')
  const isFormOpen = panel === 'open' || panel === 'sending' || panel === 'success' || panel === 'error'

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

  const bottomClass = raiseForPlanner ? 'bottom-28' : 'bottom-4'

  if (collapsed && panel === 'idle') {
    return (
      <button
        type="button"
        title={pickSpinaczLine('tooltip', { isAdmin })}
        onClick={openPanel}
        className={`spinacz-hit fixed ${bottomClass} right-4 z-50`}
        aria-label="Otwórz Pana Spinacza — zgłoś problem"
      >
        <SpinaczAvatar mood="idle" scale={1.55} />
      </button>
    )
  }

  return (
    <div
      className={`fixed ${bottomClass} right-4 z-50 flex flex-col items-end gap-2 w-[min(24rem,calc(100vw-1.5rem))]`}
    >
      {isFormOpen && bubble ? (
        <div className="spinacz-balloon relative w-full px-4 py-3 pr-9">
          <p className="text-[14px] leading-snug text-[#1a1a1a]">{bubble}</p>
          {ticketId && panel === 'success' ? (
            <p className="mt-1.5 font-mono text-[12px] text-[#3d5a1f]">{ticketId}</p>
          ) : null}
          <button
            type="button"
            onClick={panel === 'open' ? cancel : () => setPanel('idle')}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded text-[#666] hover:bg-black/5 hover:text-[#222]"
            aria-label="Zamknij"
          >
            ×
          </button>
          <span className="spinacz-balloon-tail" aria-hidden />
        </div>
      ) : null}

      <div className="flex w-full items-end gap-1">
        {isFormOpen ? (
          <div className="spinacz-panel min-w-0 flex-1 overflow-hidden">
            {panel === 'open' && (
              <form onSubmit={onSubmit} className="p-3 space-y-3">
                <div className="flex flex-wrap gap-1" role="group" aria-label="Typ problemu">
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
                  rows={4}
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
              <div className="px-3 py-3 text-sm text-zinc-400">Pakuję maila…</div>
            )}

            {(panel === 'success' || panel === 'error') && (
              <div className="flex items-center justify-end gap-2 px-3 py-3">
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
        ) : null}

        <button
          type="button"
          title={panel === 'idle' ? 'Zgłoś problem Panu Spinaczowi' : 'Pan Spinacz'}
          onClick={panel === 'idle' ? openPanel : undefined}
          className={`spinacz-hit shrink-0 ${panel === 'idle' ? 'cursor-pointer' : 'cursor-default pointer-events-none'}`}
          aria-label={panel === 'idle' ? 'Otwórz Pana Spinacza — zgłoś problem' : 'Pan Spinacz'}
        >
          <SpinaczAvatar mood={mood} scale={1.7} />
        </button>
      </div>
    </div>
  )
}
