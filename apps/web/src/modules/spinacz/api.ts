import { api } from '../../shared/api/client'
import type { BugReportType, BugUrgency } from './personality'
import type { ApiFailureEntry, ConsoleErrorEntry } from './diagnostics'

export interface BugReportPayload {
  message: string
  type: BugReportType
  urgency: BugUrgency
  pageTitle: string
  pathname: string
  moduleLabel: string
  uiVersion: string
  viewport: { width: number; height: number }
  minutesOnPage: number
  userAgent: string
  apiFailures: ApiFailureEntry[]
  consoleErrors: ConsoleErrorEntry[]
  spinaczAside: string
}

export interface BugReportResponse {
  ok: true
  ticketId: string
}

export function submitBugReport(payload: BugReportPayload): Promise<BugReportResponse> {
  return api.post<BugReportResponse>('/feedback/bug-report', payload)
}
