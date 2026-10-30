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
  const [validationHint, setValidationHint] = useState<string | null>(null)
  const [placeholder, setPlaceholder] = useState('Opisz, co nie działa…')
  const typingTimer = useRef<number | null>(null)
  const typedOnce = useRef(false)

  const moduleLabel = useMemo(() => moduleLabelFromPath(location.pathname), [location.pathname])
  const raiseForPlanner = location.pathname.startsWith('/toolbox/planer')

  useEffect(() => {
    ensureConsoleErrorCapture()
  }, [])

  useEffect(() => {
    pageMountedAt.current = Date.now()
  }, [location.pathname])

  useEffect(() => {
    if (panel !== 'open') return
    const id = window.setTimeout(() => textareaRef.current?.focus(), 50)
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

    // ~25% szansy na bonus kontekstowy (czas / diagnostyka / moduł)
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
    setValidationHint(null)
    setPlaceholder(pickSpinaczLine('placeholder', { isAdmin }))
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
    setValidationHint(null)
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
      setValidationHint(pickSpinaczLine('too_short', { isAdmin }))
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
        className={`fixed ${bottomClass} right-4 z-50 rounded-full border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur hover:border-primary/50 transition-colors`}
        aria-label="Otwórz Pana Spinacza — zgłoś problem"
      >
        <SpinaczAvatar mood="idle" size={48} />
      </button>
    )
  }

  return (
    <div className={`fixed ${bottomClass} right-4 z-50 flex flex-col items-end gap-2 max-w-[min(22rem,calc(100vw-1.5rem))]`}>
      {(panel === 'open' || panel === 'sending' || panel === 'success' || panel === 'error') && (
        <div className="w-full rounded-xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden">
          <div className="flex items-start gap-2 px-3 pt-3 pb-2 border-b border-border/80">
            <SpinaczAvatar mood={mood} size={56} className="shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Pan Spinacz</div>
              <p className="text-sm leading-snug text-foreground/95">{bubble}</p>
              {validationHint && panel === 'open' ? (
                <p className="mt-1 text-xs text-destructive">{validationHint}</p>
              ) : null}
              {ticketId && panel === 'success' ? (
                <p className="mt-1 font-mono text-xs text-primary">{ticketId}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={panel === 'open' ? cancel : () => setPanel('idle')}
              className="text-muted-foreground hover:text-foreground text-lg leading-none px-1"
              aria-label="Zamknij"
            >
              ×
            </button>
          </div>

          {panel === 'open' && (
            <form onSubmit={onSubmit} className="p-3 space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Typ</div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(BUG_TYPE_LABELS) as BugReportType[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onTypeChange(key)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        type === key
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {BUG_TYPE_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Pilność</div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(BUG_URGENCY_LABELS) as BugUrgency[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onUrgencyChange(key)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        urgency === key
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {BUG_URGENCY_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Co nie gra na: {moduleLabel}
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
                  placeholder={placeholder}
                  className="w-full resize-y min-h-[5.5rem] rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="mt-1 text-[10px] text-muted-foreground">Ctrl+Enter wysyła · min. {MIN_BUG_MESSAGE_LENGTH} znaków</div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={collapse}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Zwiń
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Wyślij do Rafała
                </button>
              </div>
            </form>
          )}

          {(panel === 'success' || panel === 'error') && (
            <div className="p-3 flex items-center justify-end gap-2">
              {panel === 'error' ? (
                <button
                  type="button"
                  onClick={() => void send()}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  Ponów
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPanel('idle')}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface"
              >
                Zamknij
              </button>
            </div>
          )}

          {panel === 'sending' && (
            <div className="px-3 pb-3 text-xs text-muted-foreground">Wysyłanie maila…</div>
          )}
        </div>
      )}

      {panel === 'idle' && (
        <button
          type="button"
          title="Zgłoś problem Panu Spinaczowi"
          onClick={openPanel}
          className="rounded-full border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur hover:border-primary/50 transition-colors"
          aria-label="Otwórz Pana Spinacza — zgłoś problem"
        >
          <SpinaczAvatar mood="idle" size={56} />
        </button>
      )}
    </div>
  )
}
