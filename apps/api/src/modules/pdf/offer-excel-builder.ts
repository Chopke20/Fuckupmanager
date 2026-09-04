/**
 * Parked: eksport oferty do funkcjonalnego Excel (.xlsx).
 * UI is hidden (`OFFER_EXCEL_EXPORT_VISIBLE` in web). Do not delete.
 * - pozycje jak w PDF (sprzęt / produkcja / transport, bloki, kategorie, etapy)
 * - ilości, dni, ceny i rabaty jako komórki edytowalne
 * - netto / VAT / brutto i podsumowanie jako formuły (przeliczają się po edycji)
 */
import type { OrderLike } from './offer-v5-builder'
import { SheetGrid, XlStyle, buildXlsxBuffer, cellRef, type DefinedName } from './minimal-xlsx'

const STAGE_TYPE_LABELS: Record<string, string> = {
  MONTAZ: 'Montaż',
  EVENT: 'Wydarzenie',
  DEMONTAZ: 'Demontaż',
  PROBA: 'Próba',
  CUSTOM: 'Inne',
}

const PDF_TIME_ZONE = 'Europe/Warsaw'

const COL = {
  dzial: 1,
  lp: 2,
  blok: 3,
  grupa: 4,
  nazwa: 5,
  opis: 6,
  ilosc: 7,
  dni: 8,
  cena: 9,
  rabat: 10,
  netto: 11,
  vat: 12,
  brutto: 13,
} as const

type VisibleEquipment = NonNullable<OrderLike['equipmentItems']>[number]
type VisibleProduction = NonNullable<OrderLike['productionItems']>[number]

export type BuildOfferExcelParams = {
  order: OrderLike
  offerNumberDisplay: string
  issuedAt?: string | Date
  projectContact?: { name?: string | null; phone?: string | null; email?: string | null } | null
}

function fmtPlDate(dateLike: string | Date): string {
  const d = new Date(dateLike)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: PDF_TIME_ZONE,
  })
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function equipmentNet(qty: number, price: number, days: number, discountPct: number): number {
  const base = price * qty
  const multiDay = days > 1 ? base + (days - 1) * base * 0.5 : base
  return multiDay * (1 - discountPct / 100)
}

function productionNet(units: number, rate: number, discountPct: number): number {
  return rate * units * (1 - discountPct / 100)
}

function lineFormulas(row: number): { netto: string; vat: string; brutto: string } {
  const g = cellRef(COL.ilosc, row)
  const h = cellRef(COL.dni, row)
  const i = cellRef(COL.cena, row)
  const j = cellRef(COL.rabat, row)
  const k = cellRef(COL.netto, row)
  const l = cellRef(COL.vat, row)
  return {
    netto: `ROUND(IF(N(${h})>1,${g}*${i}+(N(${h})-1)*${g}*${i}*0.5,${g}*${i})*(1-N(${j})/100),2)`,
    vat: `ROUND(${k}*VatPct/100,2)`,
    brutto: `ROUND(${k}+${l},2)`,
  }
}

function filterEquipment(items: VisibleEquipment[], blockId: string | null) {
  const visible = items.filter((it) => it.visibleInOffer !== false)
  if (blockId === null) return visible.filter((it) => !it.offerBlockId)
  return visible.filter((it) => it.offerBlockId === blockId)
}

function filterProduction(items: VisibleProduction[], blockId: string | null, isTransport: boolean) {
  const visible = items.filter((it) => it.visibleInOffer !== false && !!it.isTransport === isTransport)
  if (blockId === null) return visible.filter((it) => !it.offerBlockId)
  return visible.filter((it) => it.offerBlockId === blockId)
}

function filterEquipmentAll(items: VisibleEquipment[]) {
  return items.filter((it) => it.visibleInOffer !== false)
}

function filterProductionAll(items: VisibleProduction[], isTransport: boolean) {
  return items.filter((it) => it.visibleInOffer !== false && !!it.isTransport === isTransport)
}

function stageLabel(stage: NonNullable<OrderLike['stages']>[number]): string {
  const custom =
    typeof (stage as { label?: string }).label === 'string'
      ? String((stage as { label?: string }).label).trim()
      : ''
  const typeLabel = custom || (stage.type ? STAGE_TYPE_LABELS[stage.type] ?? stage.type : 'Etap')
  const dateStr = fmtPlDate(stage.date)
  const timeLabel = [stage.timeStart, stage.timeEnd].filter(Boolean).join(' → ')
  return `${typeLabel} · ${dateStr}${timeLabel ? ` · ${timeLabel}` : ''}`
}

function buildStageById(order: OrderLike) {
  return new Map((order.stages ?? []).map((s) => [s.id, stageLabel(s)] as const))
}

function groupEquipmentByCategory(items: VisibleEquipment[]): Array<{ category: string; items: VisibleEquipment[] }> {
  const map = new Map<string, VisibleEquipment[]>()
  for (const item of items) {
    const raw = item.category != null ? String(item.category).trim() : ''
    const cat = raw || 'Inne'
    const list = map.get(cat)
    if (list) list.push(item)
    else map.set(cat, [item])
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pl', { sensitivity: 'base' }))
    .map(([category, grouped]) => ({ category, items: grouped }))
}

function groupProductionByStage(
  order: OrderLike,
  items: VisibleProduction[],
  stageById: Map<string | undefined, string>,
): Array<{ label: string; items: VisibleProduction[] }> {
  const grouped = new Map<string, VisibleProduction[]>()
  const ensure = (label: string) => {
    if (!grouped.has(label)) grouped.set(label, [])
    return grouped.get(label)!
  }
  for (const stage of order.stages ?? []) {
    const key = stage.id ? (stageById.get(stage.id) ?? 'Etap') : 'Etap'
    ensure(key)
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
    ensure(targetLabel).push(item)
  }
  return [...grouped.entries()].filter(([, list]) => list.length > 0).map(([label, list]) => ({ label, items: list }))
}

function parseRepetitions(order: OrderLike): number {
  if (!order.isRecurring || !order.recurringConfig) return 1
  try {
    const cfg = JSON.parse(order.recurringConfig) as { repetitions?: number }
    return Math.max(1, num(cfg.repetitions, 1))
  } catch {
    return 1
  }
}

export async function buildOfferExcel(params: BuildOfferExcelParams): Promise<Buffer> {
  const { order, offerNumberDisplay } = params
  const issuedAt = params.issuedAt != null ? params.issuedAt : new Date()
  const vatRate = num(order.vatRate, 23)
  const discountGlobal = num(order.discountGlobal, 0)
  const currency = order.currency === 'EUR' ? 'EUR' : 'PLN'
  const exchangeRate = order.exchangeRateEur != null && order.exchangeRateEur > 0 ? order.exchangeRateEur : null
  const validityDays = num(order.offerValidityDays, 14)
  const symbol = currency === 'EUR' ? 'EUR' : 'zł'

  const issuer = order.offerIssuer
  const client = order.client
  const stageById = buildStageById(order)
  const allEq = (order.equipmentItems ?? []) as VisibleEquipment[]
  const allProd = (order.productionItems ?? []) as VisibleProduction[]
  const blocks = [...(order.offerBlocks ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const sheet = new SheetGrid()
  sheet.colWidths = [
    { min: 1, max: 1, width: 14 },
    { min: 2, max: 2, width: 6 },
    { min: 3, max: 3, width: 18 },
    { min: 4, max: 4, width: 28 },
    { min: 5, max: 5, width: 36 },
    { min: 6, max: 6, width: 28 },
    { min: 7, max: 8, width: 10 },
    { min: 9, max: 9, width: 14 },
    { min: 10, max: 10, width: 10 },
    { min: 11, max: 13, width: 14 },
    { min: 15, max: 15, width: 22 },
    { min: 16, max: 16, width: 14 },
  ]

  let r = 1
  sheet.set(r, 1, { t: 's', v: `Oferta ${offerNumberDisplay}`, s: XlStyle.title })
  sheet.merge(r, 1, r, 8)
  r += 1
  sheet.set(r, 1, { t: 's', v: `Warszawa, ${fmtPlDate(issuedAt)}  ·  Ważna ${validityDays} dni od daty wystawienia` })
  sheet.merge(r, 1, r, 8)
  r += 1
  sheet.set(r, 1, { t: 's', v: `Oferta techniczna: ${order.name ?? ''}` })
  sheet.merge(r, 1, r, 8)

  sheet.set(1, 15, { t: 's', v: 'Parametry (edytowalne)', s: XlStyle.bold })
  sheet.set(2, 15, { t: 's', v: 'VAT %' })
  sheet.set(2, 16, { t: 'n', v: vatRate, s: XlStyle.input })
  sheet.set(3, 15, { t: 's', v: 'Rabat globalny %' })
  sheet.set(3, 16, { t: 'n', v: discountGlobal, s: XlStyle.input })
  sheet.set(4, 15, { t: 's', v: 'Waluta' })
  sheet.set(4, 16, { t: 's', v: currency, s: XlStyle.input })
  sheet.set(5, 15, { t: 's', v: 'Kurs EUR (PLN/EUR)' })
  if (exchangeRate != null) sheet.set(5, 16, { t: 'n', v: exchangeRate, s: XlStyle.moneyInput })
  else sheet.set(5, 16, { t: 's', v: '—', s: XlStyle.input })
  sheet.set(6, 15, { t: 's', v: 'Zmiana VAT / rabatu / ilości / cen przelicza sumy formułami Excela.' })
  sheet.merge(6, 15, 6, 16)

  const names: DefinedName[] = [
    { name: 'VatPct', ref: 'Oferta!$P$2' },
    { name: 'RabPct', ref: 'Oferta!$P$3' },
  ]

  r = 8
  sheet.set(r, 1, { t: 's', v: 'Wystawca', s: XlStyle.bold })
  sheet.set(r, 5, { t: 's', v: 'Klient', s: XlStyle.bold })
  r += 1
  sheet.set(r, 1, { t: 's', v: issuer?.companyName ?? '—' })
  sheet.set(r, 5, { t: 's', v: client?.companyName ?? '—' })
  r += 1
  if (issuer?.address || client?.address) {
    sheet.set(r, 1, { t: 's', v: issuer?.address ?? '' })
    sheet.set(r, 5, { t: 's', v: client?.address ?? '' })
    r += 1
  }
  sheet.set(r, 1, { t: 's', v: issuer?.nip ? `NIP: ${issuer.nip}` : '' })
  sheet.set(r, 5, { t: 's', v: client?.nip ? `NIP: ${client.nip}` : '' })
  r += 1
  const issuerContact = [issuer?.email, issuer?.phone].filter(Boolean).join('  ·  ')
  const clientContact = [client?.contactName, client?.email, client?.phone].filter(Boolean).join('  ·  ')
  if (issuerContact || clientContact) {
    sheet.set(r, 1, { t: 's', v: issuerContact })
    sheet.set(r, 5, { t: 's', v: clientContact })
    r += 1
  }

  const desc = (order.description ?? '').trim()
  if (desc) {
    r += 1
    sheet.set(r, 1, { t: 's', v: 'Opis oferty', s: XlStyle.bold })
    r += 1
    sheet.set(r, 1, { t: 's', v: desc, s: XlStyle.wrap })
    sheet.merge(r, 1, r, 8)
    r += 1
  }

  const stages = order.stages ?? []
  if (stages.length > 0) {
    r += 1
    sheet.set(r, 1, { t: 's', v: 'Harmonogram', s: XlStyle.bold })
    r += 1
    sheet.set(r, 1, { t: 's', v: 'Etap', s: XlStyle.header })
    sheet.set(r, 2, { t: 's', v: 'Data', s: XlStyle.header })
    sheet.set(r, 3, { t: 's', v: 'Od', s: XlStyle.header })
    sheet.set(r, 4, { t: 's', v: 'Do', s: XlStyle.header })
    r += 1
    for (const stage of stages) {
      const custom =
        typeof (stage as { label?: string }).label === 'string'
          ? String((stage as { label?: string }).label).trim()
          : ''
      const type = custom || (stage.type ? STAGE_TYPE_LABELS[stage.type] ?? stage.type : '—')
      sheet.set(r, 1, { t: 's', v: type })
      sheet.set(r, 2, { t: 's', v: fmtPlDate(stage.date) })
      sheet.set(r, 3, { t: 's', v: stage.timeStart || '—' })
      sheet.set(r, 4, { t: 's', v: stage.timeEnd || '—' })
      r += 1
    }
  }

  r += 1
  const headerRow = r
  const headers = [
    'Dział',
    '#',
    'Blok',
    'Grupa',
    'Nazwa',
    'Opis',
    'Ilość',
    'Dni',
    `Cena netto (${symbol})`,
    'Rabat %',
    `Wartość netto (${symbol})`,
    `VAT (${symbol})`,
    `Brutto (${symbol})`,
  ]
  headers.forEach((h, idx) => sheet.set(r, idx + 1, { t: 's', v: h, s: XlStyle.header }))
  r += 1

  let lpEq = 0
  let lpProd = 0
  let firstDataRow = r
  let lastDataRow = r - 1

  const writeLine = (args: {
    dzial: 'Sprzęt' | 'Produkcja' | 'Transport'
    blok: string
    grupa: string
    name: string
    description?: string | null
    qty: number
    days: number
    price: number
    discount: number
    net: number
    lp: number
  }) => {
    const vatVal = args.net * (vatRate / 100)
    const gross = args.net + vatVal
    const f = lineFormulas(r)
    sheet.set(r, COL.dzial, { t: 's', v: args.dzial })
    sheet.set(r, COL.lp, { t: 'n', v: args.lp })
    sheet.set(r, COL.blok, { t: 's', v: args.blok })
    sheet.set(r, COL.grupa, { t: 's', v: args.grupa, s: XlStyle.wrap })
    sheet.set(r, COL.nazwa, { t: 's', v: args.name, s: XlStyle.wrap })
    sheet.set(r, COL.opis, { t: 's', v: (args.description ?? '').trim(), s: XlStyle.wrap })
    sheet.set(r, COL.ilosc, { t: 'n', v: args.qty, s: XlStyle.input })
    sheet.set(r, COL.dni, { t: 'n', v: args.days, s: XlStyle.input })
    sheet.set(r, COL.cena, { t: 'n', v: args.price, s: XlStyle.moneyInput })
    sheet.set(r, COL.rabat, { t: 'n', v: args.discount, s: XlStyle.input })
    sheet.set(r, COL.netto, { t: 'f', f: f.netto, v: round2(args.net), s: XlStyle.money })
    sheet.set(r, COL.vat, { t: 'f', f: f.vat, v: round2(vatVal), s: XlStyle.money })
    sheet.set(r, COL.brutto, { t: 'f', f: f.brutto, v: round2(gross), s: XlStyle.money })
    lastDataRow = r
    r += 1
  }

  const writeEquipment = (items: VisibleEquipment[], blockTitle: string) => {
    for (const group of groupEquipmentByCategory(items)) {
      for (const item of group.items) {
        lpEq += 1
        const qty = num(item.quantity, 1)
        const days = Math.max(1, num(item.days, 1))
        const price = num(item.unitPrice, 0)
        const discount = num(item.discount, 0)
        writeLine({
          dzial: 'Sprzęt',
          blok: blockTitle,
          grupa: group.category,
          name: item.name,
          description: item.description,
          qty,
          days,
          price,
          discount,
          net: equipmentNet(qty, price, days, discount),
          lp: lpEq,
        })
      }
    }
  }

  const writeProduction = (items: VisibleProduction[], blockTitle: string) => {
    for (const group of groupProductionByStage(order, items, stageById)) {
      for (const item of group.items) {
        lpProd += 1
        const qty = num(item.units, 1)
        const price = num(item.rateValue, 0)
        const discount = num(item.discount, 0)
        writeLine({
          dzial: 'Produkcja',
          blok: blockTitle,
          grupa: group.label,
          name: item.name,
          description: item.description,
          qty,
          days: 1,
          price,
          discount,
          net: productionNet(qty, price, discount),
          lp: lpProd,
        })
      }
    }
  }

  const writeTransport = (items: VisibleProduction[]) => {
    let lpT = 0
    for (const group of groupProductionByStage(order, items, stageById)) {
      for (const item of group.items) {
        lpT += 1
        const qty = num(item.units, 1)
        const price = num(item.rateValue, 0)
        const discount = num(item.discount, 0)
        writeLine({
          dzial: 'Transport',
          blok: '',
          grupa: group.label,
          name: item.name,
          description: item.description,
          qty,
          days: 1,
          price,
          discount,
          net: productionNet(qty, price, discount),
          lp: lpT,
        })
      }
    }
  }

  if (blocks.length > 0) {
    for (const block of blocks) {
      const title = block.title.trim() || 'Blok'
      const eq = filterEquipment(allEq, block.id)
      const prod = filterProduction(allProd, block.id, false)
      if (eq.length === 0 && prod.length === 0) continue
      writeEquipment(eq, title)
      writeProduction(prod, title)
    }
    const unEq = filterEquipment(allEq, null)
    const unProd = filterProduction(allProd, null, false)
    writeEquipment(unEq, '')
    writeProduction(unProd, '')
    writeTransport(filterProductionAll(allProd, true))
  } else {
    writeEquipment(filterEquipmentAll(allEq), '')
    writeProduction(filterProductionAll(allProd, false), '')
    writeTransport(filterProductionAll(allProd, true))
  }

  if (lastDataRow < firstDataRow) {
    sheet.set(r, 1, { t: 's', v: 'Brak pozycji w ofercie' })
    r += 1
  } else {
    sheet.autoFilter = `${cellRef(1, headerRow)}:${cellRef(13, lastDataRow)}`
    sheet.freezeRows = headerRow
  }

  const dataRangeOk = lastDataRow >= firstDataRow
  const sumIf = (dzial: string, col: number) =>
    dataRangeOk
      ? `SUMIF($${colLetterLocked(COL.dzial)}$${firstDataRow}:$${colLetterLocked(COL.dzial)}$${lastDataRow},"${dzial}",$${colLetterLocked(col)}$${firstDataRow}:$${colLetterLocked(col)}$${lastDataRow})`
      : '0'

  r += 1
  sheet.set(r, 1, { t: 's', v: 'Podsumowanie', s: XlStyle.bold })
  r += 1

  const summaryStart = r
  const writeSummaryRow = (label: string, formula: string, result: number, style: number = XlStyle.money) => {
    sheet.set(r, 10, { t: 's', v: label, s: XlStyle.bold })
    sheet.set(r, 11, { t: 'f', f: formula, v: round2(result), s: style })
    r += 1
  }

  const eqNetF = sumIf('Sprzęt', COL.netto)
  const prodNetF = sumIf('Produkcja', COL.netto)
  const transNetF = sumIf('Transport', COL.netto)

  // Compute cached results so the file shows numbers before Excel recalculates.
  const eqItems = filterEquipmentAll(allEq)
  const prodItems = filterProductionAll(allProd, false)
  const transItems = filterProductionAll(allProd, true)
  const eqNet = eqItems.reduce((s, it) => s + equipmentNet(num(it.quantity, 1), num(it.unitPrice), Math.max(1, num(it.days, 1)), num(it.discount)), 0)
  const prodNet = prodItems.reduce((s, it) => s + productionNet(num(it.units, 1), num(it.rateValue), num(it.discount)), 0)
  const transNet = transItems.reduce((s, it) => s + productionNet(num(it.units, 1), num(it.rateValue), num(it.discount)), 0)
  const revenueNet = eqNet + prodNet + transNet
  const discountAmount = revenueNet * (discountGlobal / 100)
  const netAfter = revenueNet - discountAmount
  const vatAmount = netAfter * (vatRate / 100)
  const grossTotal = netAfter + vatAmount

  writeSummaryRow('Wartość sprzętu', eqNetF, eqNet)
  writeSummaryRow('Wartość produkcji i obsługi technicznej', prodNetF, prodNet)
  writeSummaryRow('Wartość transportu', transNetF, transNet)
  const sumaRow = r
  writeSummaryRow(
    'Suma netto przed rabatem',
    `ROUND(${cellRef(11, summaryStart)}+${cellRef(11, summaryStart + 1)}+${cellRef(11, summaryStart + 2)},2)`,
    revenueNet,
  )
  const rabatRow = r
  writeSummaryRow('Rabat globalny', `ROUND(${cellRef(11, sumaRow)}*RabPct/100,2)`, discountAmount)
  const nettoRow = r
  writeSummaryRow(
    'Wartość netto',
    `ROUND(${cellRef(11, sumaRow)}-${cellRef(11, rabatRow)},2)`,
    netAfter,
    XlStyle.moneyTotal,
  )
  const vatRow = r
  writeSummaryRow('VAT', `ROUND(${cellRef(11, nettoRow)}*VatPct/100,2)`, vatAmount)
  const bruttoRow = r
  writeSummaryRow(
    'Wartość brutto',
    `ROUND(${cellRef(11, nettoRow)}+${cellRef(11, vatRow)},2)`,
    grossTotal,
    XlStyle.moneyTotal,
  )

  const repetitions = parseRepetitions(order)
  if (order.isRecurring && repetitions > 1) {
    r += 1
    sheet.set(r, 1, { t: 's', v: 'Zlecenie cykliczne — podsumowanie kosztów', s: XlStyle.bold })
    r += 1
    sheet.set(r, 10, { t: 's', v: 'Liczba wydarzeń' })
    sheet.set(r, 11, { t: 'n', v: repetitions, s: XlStyle.input })
    const repRef = cellRef(11, r)
    r += 1
    writeSummaryRow('Netto cyklu', `ROUND(${cellRef(11, nettoRow)}*${repRef},2)`, netAfter * repetitions)
    writeSummaryRow('VAT cyklu', `ROUND(${cellRef(11, vatRow)}*${repRef},2)`, vatAmount * repetitions)
    writeSummaryRow(
      'Brutto cyklu',
      `ROUND(${cellRef(11, bruttoRow)}*${repRef},2)`,
      grossTotal * repetitions,
      XlStyle.moneyTotal,
    )
  }

  r += 1
  sheet.set(r, 1, {
    t: 's',
    v: 'Żółte komórki są edytowalne. Dni > 1: pierwszy dzień pełna cena, każdy kolejny 50% (jak w ofercie PDF). Filtr w nagłówku pozycji.',
  })
  sheet.merge(r, 1, r, 13)

  const contact = params.projectContact
  const contactName = contact?.name?.trim() || ''
  if (contactName) {
    r += 2
    sheet.set(r, 1, { t: 's', v: 'Opiekun projektu', s: XlStyle.bold })
    r += 1
    const bits = [contactName, contact?.phone?.trim() ? `tel. ${contact.phone.trim()}` : '', contact?.email?.trim() || ''].filter(
      Boolean,
    )
    sheet.set(r, 1, { t: 's', v: bits.join('  ·  ') })
  }

  return buildXlsxBuffer(sheet, 'Oferta', names)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function colLetterLocked(col: number): string {
  let n = col
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function offerExcelFilename(offerNumberDisplay: string): string {
  const safe = String(offerNumberDisplay || 'oferta')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
  return `Oferta-${safe}.xlsx`
}
