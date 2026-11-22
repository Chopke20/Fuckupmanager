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
  const styleMatch = stageHtml.match(/<style>([\s\S]*?)<\/style>/i)
  const stageBody = bodyMatch?.[1] ?? ''
  const stageStyle = styleMatch?.[1] ?? ''
  const injection = `
<style>
${stageStyle}
.stage-plan-attach-break { page-break-before: always; break-before: page; }
</style>
<div class="stage-plan-attach-break" aria-label="Załączony plan sceny"></div>
${stageBody}
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
