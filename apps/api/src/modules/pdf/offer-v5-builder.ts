/**
 * Builder HTML oferty PDF — szablon v5.
 * Szablon: apps/api/src/modules/pdf/templates/offer-v5.html
 *
 * Mapowanie placeholder → źródło danych:
 * - {{OFFER_NUMBER}}     → offerNumberDisplay (e.g. OFR-26-0016-v3)
 * - {{HEADER_META}}     → Warszawa, DD.MM.RRRR · Ważna N dni (z draftu/snapshotu: offerValidityDays); data z options.issuedAt lub „teraz”
 * - {{COMPANY_NAME}}    → order.offerIssuer?.companyName ?? COMPANY
 * - {{COMPANY_DETAILS}} → NIP, adres, email, tel. z offerIssuer lub COMPANY (+ www dla domyślnej Lamy)
 * - {{CLIENT_NAME}}     → order.client.companyName
 * - {{CLIENT_DETAILS}}   → NIP, adres, kontakt, telefon (order.client)
 * - {{DESC_LABEL}}      → "Oferta techniczna: " + order.name
 * - {{DESC_BODY}}       → treść opisu w ofercie (OrderLike.description — z draftu `clientOfferDescription` albo fallback ze zlecenia)
 * - {{SCHEDULE_ITEMS}}  → order.stages (typ, data, timeStart→timeEnd)
 * - {{EQUIPMENT_TBODY}} → order.equipmentItems (wg category), netto/VAT/brutto
 * - {{EQUIPMENT_TFOOT}} → suma sprzętu
 * - {{PRODUCTION_TBODY}} / {{PRODUCTION_TFOOT}} → produkcja (bez transportu), wg etapów
 * - {{TRANSPORT_TBODY}} / {{TRANSPORT_TFOOT}} → pozycje transportowe (isTransport), wg etapów
 * - {{FIN_SUMMARY_ROWS}}→ sprzęt + obsługa + transport, rabat, netto, VAT, brutto
 * - {{RECURRING_BLOCK}} → gdy order.isRecurring + recurringConfig.repetitions (koszt 1 event / cykl)
 * - {{FOOTER_LEFT}}     → Opiekun (z app settings lub email wystawcy / domyślny)
 * - {{FOOTER_RIGHT}}    → Dane rejestrowe: offerIssuer lub COMPANY
 */
import fs from 'fs'
import path from 'path'

const COMPANY = {
  name: process.env.DEFAULT_PDF_COMPANY_NAME ?? 'Twoja firma',
  nip: process.env.DEFAULT_PDF_COMPANY_NIP ?? '0000000000',
  address: process.env.DEFAULT_PDF_COMPANY_ADDRESS ?? 'Adres firmy',
  www: process.env.DEFAULT_PDF_COMPANY_WWW ?? 'www.twojadomena.pl',
  email: process.env.DEFAULT_PDF_COMPANY_EMAIL ?? 'kontakt@twojadomena.pl',
  phone: process.env.DEFAULT_PDF_COMPANY_PHONE ?? '',
}

const PDF_TIME_ZONE = 'Europe/Warsaw'

function fmtPlDate(dateLike: string | Date): string {
  const d = new Date(dateLike)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: PDF_TIME_ZONE })
}

function getTemplatePath(): string {
  const dir = __dirname
  const nextToSrc = path.join(dir, 'templates', 'offer-v5.html')
  if (fs.existsSync(nextToSrc)) return nextToSrc
  const fromDist = path.join(dir, '..', '..', '..', 'src', 'modules', 'pdf', 'templates', 'offer-v5.html')
  if (fs.existsSync(fromDist)) return fromDist
  throw new Error(`Szablon oferty nie znaleziony. Sprawdzono: ${nextToSrc}, ${fromDist}`)
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHtmlWithBreaks(s: string): string {
  return escapeHtml(s).replace(/\r?\n/g, '<br>\n          ')
}

function normalizeHexColor(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : null
}

function applyAccentColor(html: string, colorHex?: string | null): string {
  const accent = normalizeHexColor(colorHex)
  if (!accent) return html
  return html.replace(/--accent:\s*#[0-9a-fA-F]{6};/, `--accent:   ${accent};`)
}

function applyHeaderLogo(html: string, logoUrl?: string | null): string {
  const clean = typeof logoUrl === 'string' ? logoUrl.trim() : ''
  if (!clean) return html
  return html.replace(
    /<img class="hdr__logo"[^>]*>/,
    `<img class="hdr__logo" src="${escapeHtml(clean)}" alt="Logo">`,
  )
}

function fmtNum(n: number): string {
  return n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function fmtMoney(n: number, symbol: string = 'zł'): string {
  return `${fmtNum(n)} ${symbol}`
}

/** Dane wejściowe do HTML oferty — z live zlecenia lub ze snapshotu (po scaleniu z draftem). */
export type OrderLike = {
  name?: string
  description?: string | null
  offerValidityDays?: number | null
  currency?: string | null
  exchangeRateEur?: number | null
  vatRate?: number | null
  discountGlobal?: number | null
  isRecurring?: boolean | null
  recurringConfig?: string | null
  projectContactKey?: string | null
  /** Z draftu oferty — nadpisuje blok „składa” / stopka prawá w PDF. */
  offerIssuer?: {
    companyName: string
    nip: string
    address: string
    email: string
    phone?: string
  } | null
  client?: {
    companyName: string
    nip?: string | null
    address?: string | null
    contactName?: string | null
    email?: string | null
    phone?: string | null
  }
  stages?: Array<{ id?: string; date: Date | string; timeStart?: string | null; timeEnd?: string | null; type?: string | null }>
  equipmentItems?: Array<{
    name: string
    category?: string | null
    quantity: number
    unitPrice: number
    days?: number
    discount?: number | null
    visibleInOffer?: boolean | null
    equipment?: { unit?: string | null } | null
  }>
  productionItems?: Array<{
    name: string
    description?: string | null
    rateValue: number
    units: number
    discount?: number | null
    stageIds?: string | null
    isTransport?: boolean | null
    visibleInOffer?: boolean | null
  }>
}

export type BuildOfferHtmlV5Options = {
  /** Data w nagłówku („Warszawa, …”) — domyślnie bieżąca. Ze snapshotu: `generatedAt`. */
  issuedAt?: string | Date
  projectContact?: { name?: string | null; phone?: string | null; email?: string | null } | null
  accentColorHex?: string | null
  logoUrl?: string | null
  /**
   * Layout wariantu „Oferta składa” (kolumna lewa w PDF) dla wystawcy.
   * DEFAULT: NIP + adres + email (+ tel)
   * ADDRESS_NIP: adres + NIP (bez maila/tel)
   */
  issuerDetailsVariant?: 'DEFAULT' | 'ADDRESS_NIP'
}

export function buildOfferHtmlV5(
  order: OrderLike,
  offerNumberDisplay: string,
  options?: BuildOfferHtmlV5Options
): string {
  const templatePath = getTemplatePath()
  let html = fs.readFileSync(templatePath, 'utf-8')
  html = applyAccentColor(html, options?.accentColorHex)
  html = applyHeaderLogo(html, options?.logoUrl)

  const vatRate = order.vatRate ?? 23
  const validityDays = order.offerValidityDays ?? 14
  const isEur = order.currency === 'EUR'
  const rate = isEur && order.exchangeRateEur ? order.exchangeRateEur : 1
  const symbol = isEur ? 'EUR' : 'zł'
  const fmt = (n: number) => fmtMoney(n * rate, symbol)

  const issuer = order.offerIssuer
  const companyName = issuer?.companyName ?? COMPANY.name
  const companyNip = issuer?.nip ?? COMPANY.nip
  const companyAddress = issuer?.address ?? COMPANY.address
  const companyEmail = issuer?.email ?? COMPANY.email
  const companyPhone = issuer?.phone ?? COMPANY.phone

  const issuedDate = options?.issuedAt != null ? options.issuedAt : new Date()
  const headerMeta = `Warszawa, ${fmtPlDate(issuedDate)} &nbsp;·&nbsp; Ważna ${validityDays} dni od daty wystawienia`

  const companyDetails = issuer
    ? (() => {
        const variant = options?.issuerDetailsVariant ?? 'DEFAULT'
        if (variant === 'ADDRESS_NIP') {
          return [escapeHtmlWithBreaks(companyAddress), `NIP: ${escapeHtml(companyNip)}`].join('<br>\n          ')
        }
        return [
          `NIP: ${escapeHtml(companyNip)}`,
          escapeHtmlWithBreaks(companyAddress),
          escapeHtml(companyEmail),
          companyPhone ? `+48 ${escapeHtml(String(companyPhone).replace(/\s/g, ' '))}` : null,
        ]
          .filter(Boolean)
          .join('<br>\n          ')
      })()
    : [
        `NIP: ${COMPANY.nip}`,
        COMPANY.address,
        `${COMPANY.www} &nbsp;·&nbsp; ${COMPANY.email}`,
        `+48 ${COMPANY.phone.replace(/\s/g, ' ')}`,
      ].join('<br>\n          ')

  const client = order.client
  const clientName = client?.companyName ?? '—'
  const clientDetails = client
    ? [
        client.nip ? `NIP: ${escapeHtml(client.nip)}` : null,
        client.address ? escapeHtmlWithBreaks(client.address) : null,
        [client.contactName, client.email].filter(Boolean).join(' &nbsp;·&nbsp; ') || null,
        client.phone ? `+48 ${client.phone}` : null,
      ]
        .filter(Boolean)
        .join('<br>\n          ')
    : '—'

  const descLabel = `Oferta techniczna: ${escapeHtml(order.name ?? '')}`
  const descBody = order.description?.trim()
    ? escapeHtml(order.description.trim()).replace(/\n/g, '<br>\n      ')
    : ''

  const stages = order.stages ?? []
  const stageLabels: Record<string, string> = { MONTAZ: 'Montaż', EVENT: 'Wydarzenie', DEMONTAZ: 'Demontaż', CUSTOM: 'Inne' }
  const scheduleItems =
    stages.length === 0
      ? ''
      : stages
          .map((stage) => {
            const dateStr = fmtPlDate(stage.date)
            const type = stage.type ? (stageLabels[stage.type] ?? stage.type) : '—'
            const start = stage.timeStart ?? '—'
            const end = stage.timeEnd ?? '—'
            return `<div class="schedule__item">
        <div class="schedule__stage">${escapeHtml(type)}</div>
        <div class="schedule__date"><span class="dot"></span>${dateStr}</div>
        <div class="schedule__time">${escapeHtml(start)} → ${escapeHtml(end)}</div>
      </div>`
          })
          .join('\n    ')

  const equipmentItems = (order.equipmentItems ?? []).filter((i) => i.visibleInOffer !== false)
  const equipmentByCategory = equipmentItems.reduce<Record<string, typeof equipmentItems>>((acc, item) => {
    const cat = item.category || 'Inne'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})
  const equipmentCategoryOrder = Object.keys(equipmentByCategory).sort((a, b) =>
    a.localeCompare(b, 'pl', { sensitivity: 'base' })
  )

  let equipmentTotalNet = 0
  let equipmentTotalVat = 0
  let lp = 0
  const equipmentTbodyRows: string[] = []
  for (const category of equipmentCategoryOrder) {
    const items = equipmentByCategory[category]!
    equipmentTbodyRows.push(`<tr class="cat-row"><td colspan="9">${escapeHtml(category)}</td></tr>`)
    for (const item of items) {
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
          <td class="left">${escapeHtml(item.name)}</td>
          <td class="center">${item.quantity}</td>
          <td class="center dim">${item.days ?? 1}</td>
          <td>${fmtMoney(item.unitPrice * rate, symbol)}</td>
          <td class="center dim">${discountStr}</td>
          <td>${fmtMoney(netto * rate, symbol)}</td>
          <td class="dim">${fmtNum(vatVal * rate)}</td>
          <td>${fmtMoney(brutto * rate, symbol)}</td>
        </tr>`)
    }
  }
  const equipmentTbody = equipmentTbodyRows.join('')
  const equipmentTfoot =
    equipmentItems.length > 0
      ? `<tr>
          <td colspan="6" class="sum-label">Łącznie · Sprzęt</td>
          <td class="sum-netto">${fmt(equipmentTotalNet)}</td>
          <td class="dim">${fmtNum(equipmentTotalVat * rate)}</td>
          <td class="sum-brutto">${fmt(equipmentTotalNet + equipmentTotalVat)}</td>
        </tr>`
      : '<tr><td colspan="9" class="dim">Brak pozycji</td></tr>'

  const productionItemsAll = (order.productionItems ?? []).filter((i) => i.visibleInOffer !== false)
  const productionOnlyItems = productionItemsAll.filter((i) => !i.isTransport)
  const transportOnlyItems = productionItemsAll.filter((i) => i.isTransport)

  const stageTypeLabels: Record<string, string> = { MONTAZ: 'Montaż', EVENT: 'Wydarzenie', DEMONTAZ: 'Demontaż', CUSTOM: 'Inne' }
  const stageById = new Map(
    (order.stages ?? []).map((s) => {
      const dateStr = fmtPlDate(s.date)
      const typeLabel = s.type ? (stageTypeLabels[s.type] ?? s.type) : 'Etap'
      const timeLabel = [s.timeStart, s.timeEnd].filter(Boolean).join(' → ')
      return [s.id, `${typeLabel} · ${dateStr}${timeLabel ? ` · ${timeLabel}` : ''}`]
    })
  )

  const groupProductionItemsByStage = (items: typeof productionItemsAll) => {
    const groupedByStage = new Map<string, typeof productionItemsAll>()
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

  const buildProductionTbodyAndTotals = (groupedByStage: ReturnType<typeof groupProductionItemsByStage>) => {
    let lp = 0
    let totalNet = 0
    let totalVat = 0
    const rows: string[] = []
    for (const [stageLabel, list] of groupedByStage.entries()) {
      if (!list.length) continue
      rows.push(`<tr class="stage-row"><td colspan="8">${escapeHtml(stageLabel)}</td></tr>`)
      for (const item of list) {
        lp++
        const netto = item.rateValue * item.units * (1 - (item.discount ?? 0) / 100)
        const vatVal = netto * (vatRate / 100)
        totalNet += netto
        totalVat += vatVal
        const itemDesc = item.description || '—'
        rows.push(`
        <tr>
          <td class="lp">${String(lp).padStart(2, '0')}</td>
          <td class="left">${escapeHtml(item.name)}</td>
          <td class="left dim">${escapeHtml(itemDesc)}</td>
          <td>${fmtMoney(item.rateValue * rate, symbol)}</td>
          <td class="center">${item.units}</td>
          <td>${fmtMoney(netto * rate, symbol)}</td>
          <td class="dim">${fmtNum(vatVal * rate)}</td>
          <td>${fmtMoney((netto + vatVal) * rate, symbol)}</td>
        </tr>`)
      }
    }
    return { tbody: rows.join(''), totalNet, totalVat }
  }

  const buildTransportTbodyAndTotals = (groupedByStage: ReturnType<typeof groupProductionItemsByStage>) => {
    let totalNet = 0
    let totalVat = 0
    const rows: string[] = []
    for (const [stageLabel, list] of groupedByStage.entries()) {
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
          <td class="left">${escapeHtml(item.name)}</td>
          <td class="center">${item.units}</td>
          <td class="center dim">1</td>
          <td>${fmtMoney(item.rateValue * rate, symbol)}</td>
          <td class="center dim">${discountStr}</td>
          <td>${fmtMoney(netto * rate, symbol)}</td>
          <td class="dim">${fmtNum(vatVal * rate)}</td>
          <td>${fmtMoney((netto + vatVal) * rate, symbol)}</td>
        </tr>`)
      }
    }
    return { tbody: rows.join(''), totalNet, totalVat }
  }

  const prodGrouped = groupProductionItemsByStage(productionOnlyItems)
  const transGrouped = groupProductionItemsByStage(transportOnlyItems)

  const { tbody: productionTbody, totalNet: productionTotalNet, totalVat: productionTotalVat } =
    buildProductionTbodyAndTotals(prodGrouped)
  const { tbody: transportTbody, totalNet: transportTotalNet, totalVat: transportTotalVat } =
    buildTransportTbodyAndTotals(transGrouped)

  const productionTfoot =
    productionOnlyItems.length > 0
      ? `<tr>
          <td colspan="5" class="sum-label">Łącznie · Produkcja i obsługa techniczna</td>
          <td class="sum-netto">${fmt(productionTotalNet)}</td>
          <td class="dim">${fmtNum(productionTotalVat * rate)}</td>
          <td class="sum-brutto">${fmt(productionTotalNet + productionTotalVat)}</td>
        </tr>`
      : '<tr><td colspan="8" class="dim">Brak pozycji</td></tr>'

  const transportTfoot =
    transportOnlyItems.length > 0
      ? `<tr>
          <td colspan="5" class="sum-label">Łącznie · Transport</td>
          <td class="sum-netto">${fmt(transportTotalNet)}</td>
          <td class="dim">${fmtNum(transportTotalVat * rate)}</td>
          <td class="sum-brutto">${fmt(transportTotalNet + transportTotalVat)}</td>
        </tr>`
      : '<tr><td colspan="8" class="dim">Brak pozycji</td></tr>'

  const revenueNet = equipmentTotalNet + productionTotalNet + transportTotalNet
  const discountAmount = revenueNet * ((order.discountGlobal ?? 0) / 100)
  const netAfterDiscount = revenueNet - discountAmount
  const vatAmount = netAfterDiscount * (vatRate / 100)
  const grossTotal = netAfterDiscount + vatAmount

  const finSummaryRows = [
    `<div class="fin-row">
      <span class="fin-label">Wartość sprzętu</span>
      <span class="fin-val">${fmt(equipmentTotalNet)}</span>
    </div>`,
    `<div class="fin-row">
      <span class="fin-label">Wartość produkcji i obsługi technicznej</span>
      <span class="fin-val">${fmt(productionTotalNet)}</span>
    </div>`,
    `<div class="fin-row">
      <span class="fin-label">Wartość transportu</span>
      <span class="fin-val">${fmt(transportTotalNet)}</span>
    </div>`,
    (order.discountGlobal ?? 0) > 0
      ? `<div class="fin-row">
      <span class="fin-label">Rabat globalny (${order.discountGlobal}%)</span>
      <span class="fin-val">— ${fmt(discountAmount)}</span>
    </div>`
      : `<div class="fin-row">
      <span class="fin-label" style="color:#bbb">Rabat globalny (0%)</span>
      <span class="fin-val" style="color:#bbb">— 0,00 ${symbol}</span>
    </div>`,
    `<div class="fin-row fin-row--divider fin-row--netto">
      <span class="fin-label">Wartość netto</span>
      <span class="fin-val">${fmt(netAfterDiscount)}</span>
    </div>`,
    `<div class="fin-row">
      <span class="fin-label">VAT ${vatRate}%</span>
      <span class="fin-val">${fmt(vatAmount)}</span>
    </div>`,
    `<div class="fin-row fin-row--brutto">
      <span class="fin-label">Wartość brutto</span>
      <span class="fin-val">${fmt(grossTotal)}</span>
    </div>`,
  ].join('\n        ')

  let recurringBlock = ''
  if (order.isRecurring && order.recurringConfig) {
    try {
      const cfg = JSON.parse(order.recurringConfig) as { repetitions?: number }
      const rep = cfg.repetitions ?? 1
      const cycleNet = netAfterDiscount * rep
      const cycleVat = vatAmount * rep
      const cycleGross = grossTotal * rep
      recurringBlock = `
    <!-- CYKLICZNE -->
    <div class="sec-hdr"><div class="sec-hdr__bar"></div><div class="sec-hdr__title">Zlecenie cykliczne — podsumowanie kosztów</div></div>
    <div class="recurring-block">
      <div class="recurring-block__col">
        <div class="recurring-block__label">Koszt jednostkowy (1 event)</div>
        <div class="recurring-row"><span>Netto</span><span>${fmt(netAfterDiscount)}</span></div>
        <div class="recurring-row"><span>VAT ${vatRate}%</span><span>${fmt(vatAmount)}</span></div>
        <div class="recurring-row"><span>Brutto</span><span>${fmt(grossTotal)}</span></div>
      </div>
      <div class="recurring-block__col">
        <div class="recurring-block__label">Koszt cyklu (${rep} powtórzenia)</div>
        <div class="recurring-row"><span>Netto</span><span>${fmt(cycleNet)}</span></div>
        <div class="recurring-row"><span>VAT ${vatRate}%</span><span>${fmt(cycleVat)}</span></div>
        <div class="recurring-row"><span>Brutto</span><span>${fmt(cycleGross)}</span></div>
      </div>
    </div>`
    } catch {
      recurringBlock = ''
    }
  }

  const opiekun = options?.projectContact ?? null
  const opiekunName = opiekun?.name?.trim() ? opiekun.name.trim() : ''
  const opiekunPhone = opiekun?.phone?.trim() ? opiekun.phone.trim() : ''
  const opiekunEmail = opiekun?.email?.trim() ? opiekun.email.trim() : companyEmail
  const footerLeft = `<span class="footer__label">Opiekun projektu</span>
      ${
        opiekunName
          ? `${escapeHtml(opiekunName)}<br>\n      ${opiekunPhone ? `tel. ${escapeHtml(opiekunPhone)}<br>\n      ` : ''}${escapeHtml(opiekunEmail)}`
          : escapeHtml(companyEmail)
      }`

  const footerRightCore = issuer
    ? `<span class="footer__label">Dane rejestrowe</span>
      ${escapeHtml(companyName)}<br>
      ${escapeHtmlWithBreaks(companyAddress)}<br>
      NIP: ${escapeHtml(companyNip)}`
    : `<span class="footer__label">Dane rejestrowe</span>
      ${COMPANY.name}<br>
      ${COMPANY.address}<br>
      NIP: ${COMPANY.nip}`
  const footerRight = footerRightCore

  const replacements: [string, string][] = [
    ['{{OFFER_NUMBER}}', offerNumberDisplay],
    ['{{HEADER_META}}', headerMeta],
    ['{{COMPANY_NAME}}', escapeHtml(companyName)],
    ['{{COMPANY_DETAILS}}', companyDetails],
    ['{{CLIENT_NAME}}', escapeHtml(clientName)],
    ['{{CLIENT_DETAILS}}', clientDetails || '—'],
    ['{{DESC_LABEL}}', descLabel],
    ['{{DESC_BODY}}', descBody],
    ['{{SCHEDULE_ITEMS}}', scheduleItems],
    ['{{EQUIPMENT_TBODY}}', equipmentTbody],
    ['{{EQUIPMENT_TFOOT}}', equipmentTfoot],
    ['{{PRODUCTION_TBODY}}', productionTbody],
    ['{{PRODUCTION_TFOOT}}', productionTfoot],
    ['{{TRANSPORT_TBODY}}', transportTbody],
    ['{{TRANSPORT_TFOOT}}', transportTfoot],
    ['{{FIN_SUMMARY_ROWS}}', finSummaryRows],
    ['{{RECURRING_BLOCK}}', recurringBlock],
    ['{{FOOTER_LEFT}}', footerLeft],
    ['{{FOOTER_RIGHT}}', footerRight],
  ]

  for (const [key, value] of replacements) {
    html = html.split(key).join(value)
  }

  return html
}
