import {
  formatMeters,
  renderStagePlanSvg,
  stagePlanLegend,
  type StagePlan,
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

function renderSceneSection(sceneName: string | null, plan: StagePlan): string {
  const svg = renderStagePlanSvg(plan, { widthPx: 640, theme: 'print' })
  const bomRows = plan.bom
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.name)}</td><td style="text-align:right">${escapeHtml(formatMeters(line.quantity))} ${escapeHtml(line.unit)}</td></tr>`
    )
    .join('')
  const legendRows = stagePlanLegend(plan)
    .map(
      (item) =>
        `<div class="legend-item"><span class="legend-label">${escapeHtml(item.label)}</span><span>${escapeHtml(item.value)}</span></div>`
    )
    .join('')
  const notes = plan.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')
  const warnings = plan.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')
  return `
    <section class="scene">
      ${sceneName ? `<h2>${escapeHtml(sceneName)}</h2>` : ''}
      <div class="plan">${svg}</div>
      <div class="legend">${legendRows}</div>
      <table>
        <thead><tr><th>Pozycja</th><th style="text-align:right">Ilość</th></tr></thead>
        <tbody>${bomRows}</tbody>
      </table>
      ${warnings ? `<ul class="warnings">${warnings}</ul>` : ''}
      <ul>${notes}</ul>
    </section>`
}

export function buildStagePlanPdfHtml(params: {
  documentNumberDisplay: string
  orderName: string
  orderNumber?: number | null
  orderYear?: number | null
  venue?: string | null
  dateFrom?: Date | string | null
  dateTo?: Date | string | null
  issuedAt: string
  /** Pojedyncza scena (wsteczna zgodność). */
  plan?: StagePlan
  /** Wiele scen w bloku — gdy podane, ma pierwszeństwo przed `plan`. */
  scenes?: Array<{ name: string; plan: StagePlan }>
}): string {
  const scenes =
    params.scenes && params.scenes.length > 0
      ? params.scenes
      : params.plan
        ? [{ name: '', plan: params.plan }]
        : []
  if (scenes.length === 0) {
    throw new Error('Brak planu sceny do PDF')
  }
  const orderRef =
    params.orderNumber != null && params.orderYear != null
      ? `${params.orderNumber}/${params.orderYear}`
      : '—'
  const issued = fmtPlDate(params.issuedAt) ?? ''
  const eventDate = formatEventDateRange(params.dateFrom, params.dateTo)
  const showSceneTitles = scenes.length > 1
  const body = scenes
    .map((scene) =>
      renderSceneSection(showSceneTitles ? scene.name || 'Scena' : null, scene.plan)
    )
    .join('<div class="scene-break"></div>')

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Plan sceny — ${escapeHtml(params.documentNumberDisplay)}</title>
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
  ul { margin: 10px 0 0; padding-left: 18px; color:#444; font-size:9pt; }
  .plan { margin: 12px 0; border: 1px solid #ddd; padding: 8px; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 9pt; margin-top: 8px; }
  .legend-item { display: flex; gap: 6px; }
  .legend-label { color:#666; text-transform: uppercase; font-size: 7.5pt; letter-spacing: .06em; align-self: center; }
  .warnings { color:#a83232; }
  .scene-break { page-break-before: always; margin-top: 18px; }
  .scene + .scene-break + .scene { margin-top: 0; }
</style>
</head>
<body>
  <div class="page">
    <h1>Plan sceny${scenes.length > 1 ? ` (${scenes.length})` : ''}</h1>
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
    ${body}
  </div>
</body>
</html>`
}

export function stagePlanSnapshot(params: {
  orderId: string
  orderYear: number
  orderNumber: number
  documentType: 'STAGE_PLAN'
  generatedAt: string
  plan: StagePlan
}) {
  return params
}
