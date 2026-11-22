import { parseStagePlanSetJson } from '@lama-stage/shared-types'
import { buildStagePlanPdfHtml, type StagePlanPdfGroup } from './stage-plan-pdf-builder'

type OrderLikeForStageAttach = {
  name: string
  venue?: string | null
  dateFrom?: Date | string | null
  dateTo?: Date | string | null
  orderNumber?: number | null
  orderYear?: number | null
  stagePlanJson?: string | null
  offerBlocks?: Array<{ id: string; title: string; stagePlanJson?: string | null; sortOrder?: number }>
}

/** Zbiera wszystkie sceny zlecenia (główny wykaz + bloki) do załączenia do oferty. */
export function collectOrderStagePlanGroups(order: OrderLikeForStageAttach): StagePlanPdfGroup[] {
  const groups: StagePlanPdfGroup[] = []
  const mainSet = parseStagePlanSetJson(order.stagePlanJson)
  if (mainSet.scenes.length > 0) {
    groups.push({
      groupTitle: 'Plan zlecenia (główny wykaz)',
      scenes: mainSet.scenes.map((s) => ({ name: s.name, plan: s.plan })),
    })
  }
  const blocks = [...(order.offerBlocks ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  )
  for (const block of blocks) {
    const set = parseStagePlanSetJson(block.stagePlanJson)
    if (set.scenes.length === 0) continue
    groups.push({
      groupTitle: `Blok: ${block.title}`,
      scenes: set.scenes.map((s) => ({ name: s.name, plan: s.plan })),
    })
  }
  return groups
}

export function countOrderStagePlanScenes(order: OrderLikeForStageAttach): number {
  return collectOrderStagePlanGroups(order).reduce((n, g) => n + g.scenes.length, 0)
}

/**
 * Style planu sceny scoped pod `.stage-plan-attach`, żeby nie nadpisywać
 * marginesów / body / table oferty (offer-v5).
 */
const STAGE_PLAN_ATTACH_SCOPED_CSS = `
.stage-plan-attach {
  font-family: Arial, Helvetica, sans-serif;
  color: #111;
  font-size: 10pt;
}
.stage-plan-attach .page { padding: 16mm 18mm; }
.stage-plan-attach h1 { font-size: 16pt; margin: 0 0 4px; }
.stage-plan-attach h2 { font-size: 12pt; margin: 0 0 8px; }
.stage-plan-attach .meta { color: #666; font-size: 9pt; margin-bottom: 6px; }
.stage-plan-attach .event-date { font-size: 12pt; font-weight: 700; color: #111; margin: 0 0 14px; }
.stage-plan-attach .event-date span { font-weight: 400; color: #444; }
.stage-plan-attach table { width: 100%; border-collapse: collapse; margin-top: 12px; }
.stage-plan-attach th,
.stage-plan-attach td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; }
.stage-plan-attach th {
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: #666;
}
.stage-plan-attach ul { margin: 10px 0 0; padding-left: 18px; color: #444; font-size: 9pt; }
.stage-plan-attach .plan { margin: 12px 0; border: 1px solid #ddd; padding: 8px; }
.stage-plan-attach .legend { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 9pt; margin-top: 8px; }
.stage-plan-attach .legend-item { display: flex; gap: 6px; }
.stage-plan-attach .legend-label {
  color: #666;
  text-transform: uppercase;
  font-size: 7.5pt;
  letter-spacing: .06em;
  align-self: center;
}
.stage-plan-attach .warnings { color: #a83232; }
.stage-plan-attach .scene-break { page-break-before: always; margin-top: 18px; }
.stage-plan-attach-break { page-break-before: always; break-before: page; }
`

/** Dokleja HTML planu sceny do oferty (nowa strona, ten sam PDF). */
export function appendStagePlanHtmlToOffer(params: {
  offerHtml: string
  order: OrderLikeForStageAttach
  documentNumberDisplay: string
  issuedAt: string
}): { html: string; sceneCount: number } {
  const groups = collectOrderStagePlanGroups(params.order)
  const sceneCount = groups.reduce((n, g) => n + g.scenes.length, 0)
  if (sceneCount === 0) {
    return { html: params.offerHtml, sceneCount: 0 }
  }

  const stageHtml = buildStagePlanPdfHtml({
    documentNumberDisplay: `${params.documentNumberDisplay} · Plan sceny`,
    orderName: params.order.name,
    orderNumber: params.order.orderNumber,
    orderYear: params.order.orderYear,
    venue: params.order.venue,
    dateFrom: params.order.dateFrom,
    dateTo: params.order.dateTo,
    issuedAt: params.issuedAt,
    groups,
  })

  const bodyMatch = stageHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const stageBody = bodyMatch?.[1] ?? ''
  const injection = `
<style>
${STAGE_PLAN_ATTACH_SCOPED_CSS}
</style>
<div class="stage-plan-attach-break" aria-label="Załączony plan sceny"></div>
<div class="stage-plan-attach">${stageBody}</div>
`

  if (/<\/body>/i.test(params.offerHtml)) {
    return {
      html: params.offerHtml.replace(/<\/body>/i, `${injection}</body>`),
      sceneCount,
    }
  }
  return { html: `${params.offerHtml}${injection}`, sceneCount }
}

/** Odczyt flagi z draftu oferty. */
export function draftWantsAttachStagePlan(draft: unknown): boolean {
  if (!draft || typeof draft !== 'object') return false
  return Boolean((draft as { attachStagePlan?: unknown }).attachStagePlan)
}
