import { renderStagePlanSvg, type StagePlan } from '@lama-stage/shared-types'

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildStagePlanPdfHtml(params: {
  documentNumberDisplay: string
  orderName: string
  orderNumber?: number | null
  orderYear?: number | null
  venue?: string | null
  issuedAt: string
  plan: StagePlan
}): string {
  const svg = renderStagePlanSvg(params.plan, { widthPx: 640 })
  const bomRows = params.plan.bom
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.name)}</td><td style="text-align:right">${line.quantity} ${escapeHtml(line.unit)}</td></tr>`
    )
    .join('')
  const notes = params.plan.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')
  const orderRef =
    params.orderNumber != null && params.orderYear != null
      ? `${params.orderNumber}/${params.orderYear}`
      : '—'
  const issued = new Date(params.issuedAt).toLocaleDateString('pl-PL')

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Plan sceny — ${escapeHtml(params.documentNumberDisplay)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color:#111; font-size:10pt; margin:0; }
  .page { padding: 16mm 18mm; }
  h1 { font-size: 16pt; margin: 0 0 4px; }
  .meta { color:#666; font-size:9pt; margin-bottom: 14px; }
  table { width:100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align:left; }
  th { font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; color:#666; }
  ul { margin: 10px 0 0; padding-left: 18px; color:#444; font-size:9pt; }
  .plan { margin: 12px 0; border: 1px solid #ddd; padding: 8px; }
</style>
</head>
<body>
  <div class="page">
    <h1>Plan sceny</h1>
    <div class="meta">
      ${escapeHtml(params.documentNumberDisplay)}
      &nbsp;·&nbsp; ${escapeHtml(params.orderName)}
      &nbsp;·&nbsp; zlecenie ${escapeHtml(orderRef)}
      ${params.venue ? `&nbsp;·&nbsp; ${escapeHtml(params.venue)}` : ''}
      &nbsp;·&nbsp; ${escapeHtml(issued)}
    </div>
    <div class="plan">${svg}</div>
    <table>
      <thead><tr><th>Pozycja</th><th style="text-align:right">Ilość</th></tr></thead>
      <tbody>${bomRows}</tbody>
    </table>
    <ul>${notes}</ul>
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
