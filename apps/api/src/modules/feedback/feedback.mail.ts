import { sendSmtpMail } from '../auth/smtp.mailer'

const TYPE_LABELS: Record<string, string> = {
  broken: 'Nie działa',
  wrong: 'Działa, ale głupio',
  missing: 'Brakuje mi czegoś',
  ugly: 'Brzydko wygląda',
}

const URGENCY_LABELS: Record<string, string> = {
  fire: 'Pali się',
  ok: 'Przeżyję',
  someday: 'Kiedyś tam',
}

export interface BugReportMailInput {
  ticketId: string
  type: string
  urgency: string
  companyCode: string
  uiVersion: string
  userName: string
  userEmail: string
  userRole: string
  pageTitle: string
  pathname: string
  moduleLabel: string
  message: string
  timestampIso: string
  minutesOnPage: number
  viewport: { width: number; height: number }
  userAgent: string
  apiFailures: Array<{
    at: string
    method: string
    url: string
    status: number | null
    requestId: string | null
    message: string
  }>
  consoleErrors: Array<{ at: string; message: string }>
  spinaczAside: string
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bugReportTo(): string {
  const explicit = process.env.BUG_REPORT_TO?.trim()
  if (explicit) return explicit
  // Domyślny adres właściciela — nadpisywalny envem.
  return 'rafalszydlowski7@gmail.com'
}

function shortSubjectSnippet(message: string): string {
  const oneLine = message.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 40) return oneLine
  return `${oneLine.slice(0, 40)}…`
}

function formatApiFailures(rows: BugReportMailInput['apiFailures']): string {
  if (!rows.length) return '(brak)'
  return rows
    .map((r) => {
      const status = r.status == null ? '?' : String(r.status)
      const rid = r.requestId ? ` · requestId: ${r.requestId}` : ''
      return `${r.method} ${r.url} → ${status}${rid} · ${r.message}`
    })
    .join('\n')
}

function formatConsole(rows: BugReportMailInput['consoleErrors']): string {
  if (!rows.length) return '(brak)'
  return rows.map((r) => `${r.at} · ${r.message}`).join('\n')
}

export function buildBugReportTicketId(now = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `LAMA-${mm}${dd}-${hh}${mi}-${rand}`
}

export async function sendBugReportMail(input: BugReportMailInput): Promise<{ to: string }> {
  const to = bugReportTo()
  const typeLabel = TYPE_LABELS[input.type] ?? input.type
  const urgencyLabel = URGENCY_LABELS[input.urgency] ?? input.urgency
  const snippet = shortSubjectSnippet(input.message)
  const subject = `[Lama Bug] [${urgencyLabel}] ${input.companyCode} · ${input.moduleLabel} · ${snippet} · ${input.ticketId}`

  const text = [
    `PAN SPINACZ · ZGŁOSZENIE ${input.ticketId}`,
    '==========================================',
    `Typ: ${typeLabel}`,
    `Pilność: ${urgencyLabel}`,
    `Firma: ${input.companyCode}`,
    `Wersja: ${input.uiVersion}`,
    `Kto: ${input.userName} <${input.userEmail}> (${input.userRole})`,
    `Ekran: ${input.pageTitle}`,
    `Moduł: ${input.moduleLabel}`,
    `Trasa: ${input.pathname}`,
    `Czas: ${input.timestampIso}`,
    `Na ekranie: ${input.minutesOnPage} min`,
    `Okno: ${input.viewport.width}x${input.viewport.height}`,
    `UA: ${input.userAgent}`,
    '',
    '--- OPIS ---',
    input.message,
    '',
    '--- DIAGNOSTYKA AUTO ---',
    'Nieudane API (ostatnie):',
    formatApiFailures(input.apiFailures),
    '',
    'Błędy konsoli (ostatnie):',
    formatConsole(input.consoleErrors),
    '',
    '--- SPINACZ ---',
    input.spinaczAside,
    '',
    '--- KONIEC ---',
  ].join('\n')

  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#ecece8;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border:1px solid #d8d8d6;border-radius:10px;overflow:hidden;">
      <tr><td style="padding:18px 22px;background:#111;">
        <p style="margin:0;font-family:system-ui,sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#00e676;">Pan Spinacz · Lama Bug</p>
        <p style="margin:8px 0 0;font-family:ui-monospace,Consolas,monospace;font-size:18px;color:#fff;">${esc(input.ticketId)}</p>
      </td></tr>
      <tr><td style="padding:20px 22px;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#222;">
        <p style="margin:0 0 8px;"><strong>Typ:</strong> ${esc(typeLabel)} &nbsp;·&nbsp; <strong>Pilność:</strong> ${esc(urgencyLabel)}</p>
        <p style="margin:0 0 8px;"><strong>Firma:</strong> ${esc(input.companyCode)} &nbsp;·&nbsp; <strong>Wersja:</strong> ${esc(input.uiVersion)}</p>
        <p style="margin:0 0 8px;"><strong>Kto:</strong> ${esc(input.userName)} &lt;${esc(input.userEmail)}&gt; (${esc(input.userRole)})</p>
        <p style="margin:0 0 8px;"><strong>Ekran:</strong> ${esc(input.pageTitle)} <span style="color:#666;">(${esc(input.moduleLabel)})</span></p>
        <p style="margin:0 0 8px;"><strong>Trasa:</strong> <code>${esc(input.pathname)}</code></p>
        <p style="margin:0 0 16px;"><strong>Czas:</strong> ${esc(input.timestampIso)} &nbsp;·&nbsp; ${input.minutesOnPage} min na ekranie &nbsp;·&nbsp; ${input.viewport.width}×${input.viewport.height}</p>
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#666;">Opis</p>
        <pre style="margin:0 0 16px;padding:12px;background:#f6f6f4;border:1px solid #e2e2e0;border-radius:6px;white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace;font-size:13px;">${esc(input.message)}</pre>
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#666;">Diagnostyka API</p>
        <pre style="margin:0 0 16px;padding:12px;background:#f6f6f4;border:1px solid #e2e2e0;border-radius:6px;white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace;font-size:12px;">${esc(formatApiFailures(input.apiFailures))}</pre>
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#666;">Konsola</p>
        <pre style="margin:0 0 16px;padding:12px;background:#f6f6f4;border:1px solid #e2e2e0;border-radius:6px;white-space:pre-wrap;font-family:ui-monospace,Consolas,monospace;font-size:12px;">${esc(formatConsole(input.consoleErrors))}</pre>
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#666;">Spinacz</p>
        <p style="margin:0;font-style:italic;color:#444;">${esc(input.spinaczAside)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim()

  await sendSmtpMail({
    to,
    subject,
    text,
    html,
    replyTo: input.userEmail,
  })

  return { to }
}
