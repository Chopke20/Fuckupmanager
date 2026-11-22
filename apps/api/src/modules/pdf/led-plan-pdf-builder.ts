import {
  calculateScreenFromSpec,
  formatPx,
  renderLedScreenSvg,
  type LedScreenProjectPayload,
} from '@lama-stage/shared-types'

const PDF_TIME_ZONE = 'Europe/Warsaw'

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtPlDate(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: PDF_TIME_ZONE,
  })
}

function formatEventDateRange(
  dateFrom?: Date | string | null,
  dateTo?: Date | string | null
): string | null {
  const from = fmtPlDate(dateFrom)
  const to = fmtPlDate(dateTo)
  if (!from && !to) return null
  if (from && to && from !== to) return `${from} – ${to}`
  return from || to
}

export type LedPlanPdfEntry = { name: string; project: LedScreenProjectPayload }
export type LedPlanPdfGroup = { groupTitle: string | null; entries: LedPlanPdfEntry[] }

function renderEntrySection(heading: string | null, project: LedScreenProjectPayload): string {
  const svg = renderLedScreenSvg(project, { widthPx: 640, theme: 'print' })
  const rows = project.screens
    .map((screen) => {
      const calc = calculateScreenFromSpec(screen)
      if (!calc.ok) {
        return `<tr><td>${escapeHtml(screen.label)}</td><td colspan="5" style="color:#a83232">${escapeHtml(calc.error)}</td></tr>`
      }
      return `<tr>
        <td>${escapeHtml(screen.label)}</td>
        <td style="text-align:right">${calc.screenWidthM} × ${calc.screenHeightM} m</td>
        <td style="text-align:right">${calc.areaM2} m²</td>
        <td style="text-align:right">${calc.columns}×${calc.rows}</td>
        <td style="text-align:right">${escapeHtml(formatPx(calc.screenPxW))} × ${escapeHtml(formatPx(calc.screenPxH))}</td>
        <td style="text-align:right">P${screen.pitchMm}</td>
      </tr>`
    })
    .join('')

  return `
    <section class="entry">
      ${heading ? `<h2>${escapeHtml(heading)}</h2>` : ''}
      <div class="plan">${svg}</div>
      <table>
        <thead>
          <tr>
            <th>Ekran</th>
            <th style="text-align:right">Wymiary</th>
            <th style="text-align:right">Powierzchnia</th>
            <th style="text-align:right">Kabinety</th>
            <th style="text-align:right">Rozdzielczość</th>
            <th style="text-align:right">Pitch</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`
}

export function buildLedPlanPdfHtml(params: {
  documentNumberDisplay: string
  orderName: string
  orderNumber?: number | null
  orderYear?: number | null
  venue?: string | null
  dateFrom?: Date | string | null
  dateTo?: Date | string | null
  issuedAt: string
  groups: LedPlanPdfGroup[]
}): string {
  const groups = params.groups.filter((g) => g.entries.length > 0)
  const flat = groups.flatMap((g) => g.entries)
  if (flat.length === 0) throw new Error('Brak planu LED do PDF')

  const orderRef =
    params.orderNumber != null && params.orderYear != null
      ? `${params.orderNumber}/${params.orderYear}`
      : '—'
  const issued = fmtPlDate(params.issuedAt) ?? ''
  const eventDate = formatEventDateRange(params.dateFrom, params.dateTo)
  const multiGroup = groups.length > 1 || groups.some((g) => !!g.groupTitle)

  const sections: string[] = []
  for (const group of groups) {
    const showEntryTitles = multiGroup || group.entries.length > 1
    for (const entry of group.entries) {
      const titleParts = [
        group.groupTitle,
        showEntryTitles ? entry.name || 'Ekran' : null,
      ].filter(Boolean)
      const heading = titleParts.length > 0 ? titleParts.join(' · ') : null
      if (sections.length > 0) sections.push('<div class="scene-break"></div>')
      sections.push(renderEntrySection(heading, entry.project))
    }
  }

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Plan LED — ${escapeHtml(params.documentNumberDisplay)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color:#111; font-size:10pt; margin:0; }
  .page { padding: 16mm 18mm; }
  h1 { font-size: 16pt; margin: 0 0 4px; }
  h2 { font-size: 12pt; margin: 0 0 8px; }
  .meta { color:#666; font-size:9pt; margin-bottom: 6px; }
  .event-date { font-size: 12pt; font-weight: 700; color:#111; margin: 0 0 14px; }
  .event-date span { font-weight: 400; color:#444; }
  table { width:100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align:left; }
  th { font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; color:#666; }
  .plan { margin: 12px 0; border: 1px solid #ddd; padding: 8px; }
  .scene-break { page-break-before: always; margin-top: 18px; }
</style>
</head>
<body>
  <div class="page">
    <h1>Plan LED${flat.length > 1 ? ` (${flat.length})` : ''}</h1>
    <div class="meta">
      ${escapeHtml(params.documentNumberDisplay)}
      &nbsp;·&nbsp; ${escapeHtml(params.orderName)}
      &nbsp;·&nbsp; zlecenie ${escapeHtml(orderRef)}
      ${params.venue ? `&nbsp;·&nbsp; ${escapeHtml(params.venue)}` : ''}
      ${issued ? `&nbsp;·&nbsp; wygenerowano ${escapeHtml(issued)}` : ''}
    </div>
    ${
      eventDate
        ? `<div class="event-date">Data wydarzenia: <span>${escapeHtml(eventDate)}</span></div>`
        : ''
    }
    ${sections.join('')}
  </div>
</body>
</html>`
}
