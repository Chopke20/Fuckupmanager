import { truncateOrderLineDescriptionForPdf } from '@lama-stage/shared-types'
import type { OrderLike } from './offer-v5-builder'

type VisibleEquipment = NonNullable<OrderLike['equipmentItems']>[number] & { offerBlockId?: string | null }
type VisibleProduction = NonNullable<OrderLike['productionItems']>[number] & { offerBlockId?: string | null }

export type PositionsMoneyContext = {
  vatRate: number
  rate: number
  symbol: string
  fmt: (n: number) => string
  fmtNum: (n: number) => string
}

export type OfferPositionsTotals = {
  equipmentTotalNet: number
  equipmentTotalVat: number
  productionTotalNet: number
  productionTotalVat: number
  transportTotalNet: number
  transportTotalVat: number
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderOfferLineNameCell(name: string, description?: string | null): string {
  const safeName = escapeHtml(name)
  const desc = truncateOrderLineDescriptionForPdf(description)
  if (!desc) return safeName
  return `${safeName} <span class="line-desc">— ${escapeHtml(desc)}</span>`
}

function fmtUnitPrice(unitPrice: number, rate: number, symbol: string, fmtNum: (n: number) => string): string {
  return `${fmtNum(unitPrice * rate)} ${symbol}`
}

function sectionHeader(title: string, extraClass = '') {
  const cls = extraClass ? `sec-hdr ${extraClass}` : 'sec-hdr'
  return `<div class="${cls}"><div class="sec-hdr__bar"></div><div class="sec-hdr__title">${escapeHtml(title)}</div></div>`
}

function filterEquipment(items: VisibleEquipment[], blockId: string | null) {
  const visible = items.filter((i) => i.visibleInOffer !== false)
  if (blockId === null) return visible.filter((i) => !i.offerBlockId)
  return visible.filter((i) => i.offerBlockId === blockId)
}

function filterProduction(items: VisibleProduction[], blockId: string | null, isTransport: boolean) {
  const visible = items.filter((i) => i.visibleInOffer !== false && !!i.isTransport === isTransport)
  if (blockId === null) return visible.filter((i) => !i.offerBlockId)
  return visible.filter((i) => i.offerBlockId === blockId)
}

function filterEquipmentAll(items: VisibleEquipment[]) {
  return items.filter((i) => i.visibleInOffer !== false)
}

function filterProductionAll(items: VisibleProduction[], isTransport: boolean) {
  return items.filter((i) => i.visibleInOffer !== false && !!i.isTransport === isTransport)
}

function buildStageById(order: OrderLike) {
  const stageTypeLabels: Record<string, string> = {
    MONTAZ: 'Montaż',
    EVENT: 'Wydarzenie',
    DEMONTAZ: 'Demontaż',
    PROBA: 'Próba',
    CUSTOM: 'Inne',
  }
  const fmtPlDate = (dateLike: string | Date): string => {
    const d = new Date(dateLike)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Warsaw',
    })
  }
  return new Map(
    (order.stages ?? []).map((s) => {
      const dateStr = fmtPlDate(s.date)
      const customLabel = typeof (s as { label?: string })?.label === 'string' ? String((s as { label?: string }).label).trim() : ''
      const typeLabel = customLabel || (s.type ? (stageTypeLabels[s.type] ?? s.type) : 'Etap')
      const timeLabel = [s.timeStart, s.timeEnd].filter(Boolean).join(' → ')
      return [s.id, `${typeLabel} · ${dateStr}${timeLabel ? ` · ${timeLabel}` : ''}`] as const
    }),
  )
}

function groupProductionItemsByStage(
  order: OrderLike,
  items: VisibleProduction[],
  stageById: Map<string | undefined, string>,
) {
  const groupedByStage = new Map<string, VisibleProduction[]>()
  const ensureStageGroup = (label: string) => {
    if (!groupedByStage.has(label)) groupedByStage.set(label, [])
    return groupedByStage.get(label)!
  }
  for (const stage of order.stages ?? []) {
    const key = stage.id ? (stageById.get(stage.id) ?? 'Etap') : 'Etap'
    ensureStageGroup(key)
  }
  for (const item of items) {
    let targetLabel = 'Poza harmonogramem'
    if (item.stageIds) {
      try {
        const ids = JSON.parse(item.stageIds) as string[]
        const firstId = Array.isArray(ids) ? ids[0] : undefined
        if (firstId) targetLabel = stageById.get(firstId) ?? targetLabel
      } catch {
        targetLabel = 'Poza harmonogramem'
      }
    }
    ensureStageGroup(targetLabel).push(item)
  }
  return groupedByStage
}

function buildEquipmentParts(items: VisibleEquipment[], ctx: PositionsMoneyContext) {
  const { vatRate, rate, symbol, fmt, fmtNum } = ctx
  const equipmentByCategory = items.reduce<Record<string, VisibleEquipment[]>>((acc, item) => {
    const cat = item.category || 'Inne'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})
  const equipmentCategoryOrder = Object.keys(equipmentByCategory).sort((a, b) =>
    a.localeCompare(b, 'pl', { sensitivity: 'base' }),
  )

  let equipmentTotalNet = 0
  let equipmentTotalVat = 0
  let lp = 0
  const equipmentTbodyRows: string[] = []
  for (const category of equipmentCategoryOrder) {
    const catItems = equipmentByCategory[category]!
    equipmentTbodyRows.push(`<tr class="group-row"><td colspan="9">${escapeHtml(category)}</td></tr>`)
    for (const item of catItems) {
      lp++
      const base = item.unitPrice * item.quantity
      const multiDay = (item.days ?? 1) > 1 ? base + ((item.days ?? 1) - 1) * base * 0.5 : base
      const netto = multiDay * (1 - (item.discount ?? 0) / 100)
      const vatVal = netto * (vatRate / 100)
      const brutto = netto + vatVal
      equipmentTotalNet += netto
      equipmentTotalVat += vatVal
      const discountStr = (item.discount ?? 0) > 0 ? `${item.discount}%` : '—'
      equipmentTbodyRows.push(`
        <tr>
          <td class="lp">${String(lp).padStart(2, '0')}</td>
          <td class="left">${renderOfferLineNameCell(item.name, item.description)}</td>
          <td class="center">${item.quantity}</td>
          <td class="center dim">${item.days ?? 1}</td>
          <td>${fmtUnitPrice(item.unitPrice, rate, symbol, fmtNum)}</td>
          <td class="center dim">${discountStr}</td>
          <td>${fmt(netto)}</td>
          <td class="dim">${fmtNum(vatVal * rate)}</td>
          <td>${fmt(brutto)}</td>
        </tr>`)
    }
  }
  const tbody = equipmentTbodyRows.join('')
  const tfoot =
    items.length > 0
      ? `<tr>
          <td colspan="6" class="sum-label">Łącznie · Sprzęt</td>
          <td class="sum-netto">${fmt(equipmentTotalNet)}</td>
          <td class="dim">${fmtNum(equipmentTotalVat * rate)}</td>
          <td class="sum-brutto">${fmt(equipmentTotalNet + equipmentTotalVat)}</td>
        </tr>`
      : '<tr><td colspan="9" class="dim">Brak pozycji</td></tr>'

  const html = `
    <table class="prod-table prod-table--line-items">
      <thead>
        <tr>
          <th style="width:3%">#</th>
          <th class="left" style="width:34%">Nazwa</th>
          <th style="width:6%">Ilość</th>
          <th style="width:5%">Dni</th>
          <th style="width:10%">Cena netto</th>
          <th style="width:5%">Rabat</th>
          <th style="width:11%">Wartość netto</th>
          <th style="width:8%">VAT 23%</th>
          <th style="width:11%">Brutto</th>
        </tr>
      </thead>
      <tbody>${tbody}</tbody>
      <tfoot>${tfoot}</tfoot>
    </table>`

  return { html, totalNet: equipmentTotalNet, totalVat: equipmentTotalVat }
}

function buildProductionParts(
  order: OrderLike,
  items: VisibleProduction[],
  ctx: PositionsMoneyContext,
  stageById: Map<string | undefined, string>,
) {
  const { vatRate, rate, symbol, fmt, fmtNum } = ctx
  const grouped = groupProductionItemsByStage(order, items, stageById)
  let lp = 0
  let totalNet = 0
  let totalVat = 0
  const rows: string[] = []
  for (const [stageLabel, list] of grouped.entries()) {
    if (!list.length) continue
    rows.push(`<tr class="group-row"><td colspan="9">${escapeHtml(stageLabel)}</td></tr>`)
    for (const item of list) {
      lp++
      const netto = item.rateValue * item.units * (1 - (item.discount ?? 0) / 100)
      const vatVal = netto * (vatRate / 100)
      const brutto = netto + vatVal
      totalNet += netto
      totalVat += vatVal
      const discountStr = (item.discount ?? 0) > 0 ? `${item.discount}%` : '—'
      const unitsDisplay =
        Number.isInteger(item.units) || item.units % 1 === 0 ? String(item.units) : fmtNum(item.units)
      rows.push(`
        <tr>
          <td class="lp">${String(lp).padStart(2, '0')}</td>
          <td class="left">${renderOfferLineNameCell(item.name, item.description)}</td>
          <td class="center">${unitsDisplay}</td>
          <td class="center dim">—</td>
          <td>${fmtUnitPrice(item.rateValue, rate, symbol, fmtNum)}</td>
          <td class="center dim">${discountStr}</td>
          <td>${fmt(netto)}</td>
          <td class="dim">${fmtNum(vatVal * rate)}</td>
          <td>${fmt(brutto)}</td>
        </tr>`)
    }
  }
  const tbody = rows.join('')
  const tfoot =
    items.length > 0
      ? `<tr>
          <td colspan="6" class="sum-label">Łącznie · Produkcja i obsługa techniczna</td>
          <td class="sum-netto">${fmt(totalNet)}</td>
          <td class="dim">${fmtNum(totalVat * rate)}</td>
          <td class="sum-brutto">${fmt(totalNet + totalVat)}</td>
        </tr>`
      : '<tr><td colspan="9" class="dim">Brak pozycji</td></tr>'

  const html = `
    <table class="prod-table prod-table--line-items">
      <thead>
        <tr>
          <th style="width:3%">#</th>
          <th class="left" style="width:34%">Nazwa</th>
          <th style="width:6%">Ilość</th>
          <th style="width:5%">Dni</th>
          <th style="width:10%">Cena netto</th>
          <th style="width:5%">Rabat</th>
          <th style="width:11%">Wartość netto</th>
          <th style="width:8%">VAT 23%</th>
          <th style="width:11%">Brutto</th>
        </tr>
      </thead>
      <tbody>${tbody}</tbody>
      <tfoot>${tfoot}</tfoot>
    </table>`

  return { html, totalNet, totalVat }
}

function buildTransportParts(
  order: OrderLike,
  items: VisibleProduction[],
  ctx: PositionsMoneyContext,
  stageById: Map<string | undefined, string>,
) {
  const { vatRate, rate, symbol, fmt, fmtNum } = ctx
  const grouped = groupProductionItemsByStage(order, items, stageById)
  let totalNet = 0
  let totalVat = 0
  const rows: string[] = []
  for (const [stageLabel, list] of grouped.entries()) {
    if (!list.length) continue
    rows.push(`<tr class="stage-row"><td colspan="8">${escapeHtml(stageLabel)}</td></tr>`)
    for (const item of list) {
      const netto = item.rateValue * item.units * (1 - (item.discount ?? 0) / 100)
      const vatVal = netto * (vatRate / 100)
      totalNet += netto
      totalVat += vatVal
      const discountStr = (item.discount ?? 0) > 0 ? `${item.discount}%` : '—'
      rows.push(`
        <tr>
          <td class="left">${renderOfferLineNameCell(item.name, item.description)}</td>
          <td class="center">${item.units}</td>
          <td class="center dim">1</td>
          <td>${fmtUnitPrice(item.rateValue, rate, symbol, fmtNum)}</td>
          <td class="center dim">${discountStr}</td>
          <td>${fmt(netto)}</td>
          <td class="dim">${fmtNum(vatVal * rate)}</td>
          <td>${fmt(netto + vatVal)}</td>
        </tr>`)
    }
  }
  const tbody = rows.join('')
  const tfoot =
    items.length > 0
      ? `<tr>
          <td colspan="5" class="sum-label">Łącznie · Transport</td>
          <td class="sum-netto">${fmt(totalNet)}</td>
          <td class="dim">${fmtNum(totalVat * rate)}</td>
          <td class="sum-brutto">${fmt(totalNet + totalVat)}</td>
        </tr>`
      : '<tr><td colspan="8" class="dim">Brak pozycji</td></tr>'

  const html = `
    <table class="prod-table">
      <thead>
        <tr>
          <th class="left" style="width:44%">Pojazd / Trasa</th>
          <th style="width:7%">Ilość</th>
          <th style="width:9%">Przelicznik</th>
          <th style="width:11%">Cena netto</th>
          <th style="width:5%">Rabat</th>
          <th style="width:11%">Wartość netto</th>
          <th style="width:7%">VAT</th>
          <th style="width:11%">Brutto</th>
        </tr>
      </thead>
      <tbody>${tbody}</tbody>
      <tfoot>${tfoot}</tfoot>
    </table>`

  return { html, totalNet, totalVat }
}

function blockSummary(net: number, vat: number, ctx: PositionsMoneyContext): string {
  const gross = net + vat
  return `
    <div class="fin-block fin-block--offer-block">
      <div class="fin-row">
        <span class="fin-label">Wartość netto bloku</span>
        <span class="fin-val">${ctx.fmt(net)}</span>
      </div>
      <div class="fin-row">
        <span class="fin-label">VAT ${ctx.vatRate}%</span>
        <span class="fin-val">${ctx.fmt(vat)}</span>
      </div>
      <div class="fin-row fin-row--brutto">
        <span class="fin-label">Wartość brutto bloku</span>
        <span class="fin-val">${ctx.fmt(gross)}</span>
      </div>
    </div>`
}

function buildTrioSection(
  order: OrderLike,
  blockId: string | null,
  ctx: PositionsMoneyContext,
  stageById: Map<string | undefined, string>,
  options: { showSectionTitles: boolean },
) {
  const allEq = (order.equipmentItems ?? []) as VisibleEquipment[]
  const allProd = (order.productionItems ?? []) as VisibleProduction[]
  const eq = filterEquipment(allEq, blockId)
  const prod = filterProduction(allProd, blockId, false)
  const trans = filterProduction(allProd, blockId, true)

  const parts: string[] = []
  let eqNet = 0
  let eqVat = 0
  let prodNet = 0
  let prodVat = 0
  let transNet = 0
  let transVat = 0

  if (eq.length > 0) {
    if (options.showSectionTitles) parts.push(sectionHeader('Sprzęt', 'sec-hdr--sub'))
    const eqPart = buildEquipmentParts(eq, ctx)
    parts.push(eqPart.html)
    eqNet = eqPart.totalNet
    eqVat = eqPart.totalVat
  }
  if (prod.length > 0) {
    if (options.showSectionTitles) parts.push(sectionHeader('Produkcja i obsługa techniczna', 'sec-hdr--sub'))
    const prodPart = buildProductionParts(order, prod, ctx, stageById)
    parts.push(prodPart.html)
    prodNet = prodPart.totalNet
    prodVat = prodPart.totalVat
  }
  if (trans.length > 0) {
    if (options.showSectionTitles) parts.push(sectionHeader('Transport', 'sec-hdr--sub'))
    const transPart = buildTransportParts(order, trans, ctx, stageById)
    parts.push(transPart.html)
    transNet = transPart.totalNet
    transVat = transPart.totalVat
  }

  return { html: parts.join('\n'), eqNet, eqVat, prodNet, prodVat, transNet, transVat }
}

function buildNamedBlock(
  order: OrderLike,
  blockId: string,
  title: string,
  ctx: PositionsMoneyContext,
  stageById: Map<string | undefined, string>,
): string | null {
  const allEq = filterEquipment((order.equipmentItems ?? []) as VisibleEquipment[], blockId)
  const allProd = filterProduction((order.productionItems ?? []) as VisibleProduction[], blockId, false)
  const allTrans = filterProduction((order.productionItems ?? []) as VisibleProduction[], blockId, true)
  if (allEq.length === 0 && allProd.length === 0 && allTrans.length === 0) return null

  const trio = buildTrioSection(order, blockId, ctx, stageById, { showSectionTitles: true })
  const blockNet = trio.eqNet + trio.prodNet + trio.transNet
  const blockVat = trio.eqVat + trio.prodVat + trio.transVat

  return `
    <div class="offer-block">
      ${sectionHeader(title.trim(), 'sec-hdr--block-title')}
      ${trio.html}
      ${blockSummary(blockNet, blockVat, ctx)}
    </div>`
}

function buildUngroupedSection(
  order: OrderLike,
  ctx: PositionsMoneyContext,
  stageById: Map<string | undefined, string>,
): string {
  return buildTrioSection(order, null, ctx, stageById, { showSectionTitles: true }).html
}

function buildLegacyFlat(order: OrderLike, ctx: PositionsMoneyContext, stageById: Map<string | undefined, string>): string {
  const parts: string[] = []
  const eqAll = filterEquipmentAll((order.equipmentItems ?? []) as VisibleEquipment[])
  const prodAll = filterProductionAll((order.productionItems ?? []) as VisibleProduction[], false)
  const transAll = filterProductionAll((order.productionItems ?? []) as VisibleProduction[], true)
  if (eqAll.length > 0) {
    parts.push(sectionHeader('Sprzęt'))
    parts.push(buildEquipmentParts(eqAll, ctx).html)
  }
  if (prodAll.length > 0) {
    parts.push(sectionHeader('Produkcja i obsługa techniczna'))
    parts.push(buildProductionParts(order, prodAll, ctx, stageById).html)
  }
  if (transAll.length > 0) {
    parts.push(sectionHeader('Transport'))
    parts.push(buildTransportParts(order, transAll, ctx, stageById).html)
  }
  return parts.join('\n')
}

function computeGlobalTotals(
  order: OrderLike,
  ctx: PositionsMoneyContext,
  stageById: Map<string | undefined, string>,
): OfferPositionsTotals {
  const eqItems = filterEquipmentAll((order.equipmentItems ?? []) as VisibleEquipment[])
  const prodItems = filterProductionAll((order.productionItems ?? []) as VisibleProduction[], false)
  const transItems = filterProductionAll((order.productionItems ?? []) as VisibleProduction[], true)
  const eq = buildEquipmentParts(eqItems, ctx)
  const prod = buildProductionParts(order, prodItems, ctx, stageById)
  const trans = buildTransportParts(order, transItems, ctx, stageById)
  return {
    equipmentTotalNet: eq.totalNet,
    equipmentTotalVat: eq.totalVat,
    productionTotalNet: prod.totalNet,
    productionTotalVat: prod.totalVat,
    transportTotalNet: trans.totalNet,
    transportTotalVat: trans.totalVat,
  }
}

/** Bloki nazwane (tytuł bez słowa „blok”), potem pozycje bez bloku. */
export function buildOfferPositionsSection(order: OrderLike, ctx: PositionsMoneyContext) {
  const stageById = buildStageById(order)
  const blocks = [...(order.offerBlocks ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const hasBlocks = blocks.length > 0

  const sections: string[] = []
  if (hasBlocks) {
    for (const block of blocks) {
      const chunk = buildNamedBlock(order, block.id, block.title, ctx, stageById)
      if (chunk) sections.push(chunk)
    }
    const ungrouped = buildUngroupedSection(order, ctx, stageById)
    if (ungrouped.trim()) sections.push(ungrouped)
  }

  const totals = computeGlobalTotals(order, ctx, stageById)
  const html = hasBlocks ? sections.join('\n') : buildLegacyFlat(order, ctx, stageById)
  return { html, totals }
}
