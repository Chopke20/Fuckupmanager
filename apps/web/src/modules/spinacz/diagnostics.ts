/** Ring buffer ostatnich błędów API / konsoli — kontekst dla Spinacza i maila. */

const MAX_ENTRIES = 5

export interface ApiFailureEntry {
  at: string
  method: string
  url: string
  status: number | null
  requestId: string | null
  message: string
}

export interface ConsoleErrorEntry {
  at: string
  message: string
}

const apiFailures: ApiFailureEntry[] = []
const consoleErrors: ConsoleErrorEntry[] = []
let consoleHooked = false

export function pushApiFailure(entry: Omit<ApiFailureEntry, 'at'> & { at?: string }) {
  apiFailures.unshift({
    at: entry.at ?? new Date().toISOString(),
    method: entry.method,
    url: entry.url,
    status: entry.status,
    requestId: entry.requestId,
    message: entry.message.slice(0, 240),
  })
  if (apiFailures.length > MAX_ENTRIES) apiFailures.length = MAX_ENTRIES
}

export function getRecentApiFailures(): ApiFailureEntry[] {
  return [...apiFailures]
}

export function getRecentConsoleErrors(): ConsoleErrorEntry[] {
  return [...consoleErrors]
}

export function hasRecentApiFailures(): boolean {
  return apiFailures.length > 0
}

/** Podpina się pod console.error raz na sesję (bez podmiany innych loggerów). */
export function ensureConsoleErrorCapture() {
  if (consoleHooked || typeof window === 'undefined') return
  consoleHooked = true
  const original = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    try {
      const message = args
        .map((a) => {
          if (typeof a === 'string') return a
          if (a instanceof Error) return a.message
          try {
            return JSON.stringify(a)
          } catch {
            return String(a)
          }
        })
        .join(' ')
        .slice(0, 240)
      if (message && !message.includes('[Spinacz]')) {
        consoleErrors.unshift({ at: new Date().toISOString(), message })
        if (consoleErrors.length > MAX_ENTRIES) consoleErrors.length = MAX_ENTRIES
      }
    } catch {
      /* ignore */
    }
    original(...args)
  }
}

export function minutesOnPage(mountedAtMs: number): number {
  return Math.max(0, Math.round((Date.now() - mountedAtMs) / 60_000))
}
