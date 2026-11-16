/**
 * PDF „Magazyn / załadunek” — nagłówek i siatka jak oferta (v5), lista sprzętu z pustymi kratkami do odhaczenia odręcznie.
 * Szablon: templates/warehouse-v1.html · logo wczytywane z offer-v5.html (ten sam base64).
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

function getTemplatesDir(): string {
  const nextToSrc = path.join(__dirname, 'templates')
  if (fs.existsSync(path.join(nextToSrc, 'warehouse-v1.html'))) return nextToSrc
  return path.join(__dirname, '..', '..', '..', 'src', 'modules', 'pdf', 'templates')
}

function extractHdrLogoFromOfferHtml(): string {
  const dir = getTemplatesDir()
  const offerPath = path.join(dir, 'offer-v5.html')
  if (!fs.existsSync(offerPath)) return ''
  const html = fs.readFileSync(offerPath, 'utf-8')
  const m = html.match(/<img class="hdr__logo"[^>]*>/)
  return m?.[0] ?? ''
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function normalizeHexColor(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : null
}

export type WarehousePdfIssuer = {
  companyName: string
  nip: string
  address: string
  email: string
  phone?: string
}

export type WarehousePdfEquipmentRow = {
  name: string
  quantity: number
  unit?: string | null
  sortOrder?: number
  skipPack?: boolean
  isRental?: boolean
  note?: string | null
  /** Id bloku oferty; null = bez bloku; specjalne klucze: __custom__ */
  offerBlockId?: string | null
  blockTitle?: string | null
}

export type WarehousePdfOfferBlock = {
  id: string
  title: string
  sortOrder?: number
}

export type BuildWarehousePdfHtmlParams = {
  documentNumberDisplay: string
  issuedAt: string | Date
  orderName: string
  orderNumber: number | null | undefined
  orderYear: number | null | undefined
  venue?: string | null
  startDate: Date
  endDate: Date
  draftTitle?: string
  draftNotes?: string
  issuer: WarehousePdfIssuer
  client?: {
    companyName: string
    nip?: string | null
    address?: string | null
    contactName?: string | null
    email?: string | null
    phone?: string | null
  } | null
  equipmentItems: WarehousePdfEquipmentRow[]
  offerBlocks?: WarehousePdfOfferBlock[]
  projectContactKey?: string | null
  projectContact?: { name?: string | null; phone?: string | null; email?: string | null } | null
  accentColorHex?: string | null
  logoUrl?: string | null
}

export function buildWarehousePdfHtml(params: BuildWarehousePdfHtmlParams): string {
  const templatePath = path.join(getTemplatesDir(), 'warehouse-v1.html')
  let html = fs.readFileSync(templatePath, 'utf-8')
  const accent = normalizeHexColor(params.accentColorHex)
  if (accent) {
    html = html.replace(/--accent:\s*#[0-9a-fA-F]{6};/, `--accent: ${accent};`)
  }

  const hdrLogo = params.logoUrl?.trim()
    ? `<img class="hdr__logo" src="${escapeHtml(params.logoUrl.trim())}" alt="Logo">`
    : extractHdrLogoFromOfferHtml()
  const issuer = params.issuer
  const companyName = issuer.companyName || COMPANY.name
  const companyNip = issuer.nip || COMPANY.nip
  const companyAddress = issuer.address || COMPANY.address
  const companyEmail = issuer.email || COMPANY.email
  const companyPhone = issuer.phone || COMPANY.phone

  const companyDetails = [
    `NIP: ${escapeHtml(companyNip)}`,
    escapeHtml(companyAddress),
    escapeHtml(companyEmail),
    companyPhone ? `+48 ${escapeHtml(String(companyPhone).replace(/\s/g, ' '))}` : null,
  ]
    .filter(Boolean)
    .join('<br>\n          ')

  const client = params.client
  const clientName = client?.companyName?.trim() ? client.companyName : '—'
  const clientDetails = client
    ? [
        client.nip ? `NIP: ${escapeHtml(client.nip)}` : null,
        client.address ? escapeHtml(client.address) : null,
        [client.contactName, client.email].filter(Boolean).join(' &nbsp;·&nbsp; ') || null,
        client.phone ? `+48 ${escapeHtml(client.phone)}` : null,
      ]
        .filter(Boolean)
        .join('<br>\n          ')
    : '—'

  const issuedDate = params.issuedAt != null ? params.issuedAt : new Date()
  const orderRef =
    params.orderNumber != null && params.orderYear != null
      ? `${params.orderNumber}/${params.orderYear}`
      : '—'
  const dateStr = fmtPlDate(issuedDate)
  const fromStr = fmtPlDate(params.startDate)
  const toStr = fmtPlDate(params.endDate)
  const venueLine = params.venue?.trim() ? escapeHtml(params.venue.trim()) : null
  const headerMetaParts = [`Warszawa, ${dateStr}`, `Zlecenie nr ${orderRef}`]
  if (venueLine) headerMetaParts.push(`Miejsce: ${venueLine}`)
  const headerMeta = headerMetaParts.join(' &nbsp;·&nbsp; ')

  const titleLine = (params.draftTitle?.trim() || `Magazyn / załadunek — ${params.orderName}`).trim()
  const descLabel = escapeHtml(titleLine)
  const descBodyParts: string[] = []
  descBodyParts.push(`<strong>Termin zlecenia:</strong> ${fromStr} – ${toStr}`)
  if (params.draftNotes?.trim()) {
    descBodyParts.push(escapeHtml(params.draftNotes.trim()).replace(/\n/g, '<br>\n'))
  }
  const descBody = descBodyParts.join('<br>\n')

  const visibleItems = [...params.equipmentItems].filter((item) => !item.skipPack)
  const sortWithin = (a: WarehousePdfEquipmentRow, b: WarehousePdfEquipmentRow) => {
    const sa = a.sortOrder ?? 0
    const sb = b.sortOrder ?? 0
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })
  }

  const blocks = [...(params.offerBlocks ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const hasBlocks = blocks.length > 0

  type Section = { key: string; title: string; items: WarehousePdfEquipmentRow[] }
  const sections: Section[] = []

  if (hasBlocks) {
    for (const block of blocks) {
      const items = visibleItems
        .filter((it) => it.offerBlockId === block.id)
        .sort(sortWithin)
      if (items.length === 0) continue
      sections.push({ key: block.id, title: block.title.trim() || 'Blok', items })
    }
    const blockIdSet = new Set(blocks.map((b) => b.id))
    const ungrouped = visibleItems
      .filter((it) => {
        if (it.offerBlockId === '__custom__') return false
        if (!it.offerBlockId) return true
        return !blockIdSet.has(it.offerBlockId)
      })
      .sort(sortWithin)
    if (ungrouped.length > 0) {
      sections.push({ key: '__none__', title: 'Bez bloku', items: ungrouped })
    }
    const custom = visibleItems.filter((it) => it.offerBlockId === '__custom__').sort(sortWithin)
    if (custom.length > 0) {
      sections.push({ key: '__custom__', title: 'Dopisane ręcznie', items: custom })
    }
  } else {
    const items = visibleItems.sort(sortWithin)
    if (items.length > 0) {
      sections.push({ key: '__all__', title: '', items })
    }
  }

  const renderItemRow = (item: WarehousePdfEquipmentRow, idx: number) => {
    const lp = String(idx + 1).padStart(2, '0')
    const unit = item.unit?.trim() || 'szt.'
    const rentalMark = item.isRental ? `<span class="wh-rental" title="Rental">R</span>` : ''
    const noteHtml = item.note?.trim()
      ? `<div class="wh-item-note">${escapeHtml(item.note.trim())}</div>`
      : ''
    return `<tr>
          <td class="chk-cell"><span class="chk-box"></span>${rentalMark}</td>
          <td class="lp center">${lp}</td>
          <td class="left">${escapeHtml(item.name)}${noteHtml}</td>
          <td class="center">${item.quantity}</td>
          <td class="center dim">${escapeHtml(unit)}</td>
        </tr>`
  }

  let lpCounter = 0
  const tbodyRows: string[] = []
  if (sections.length === 0) {
    tbodyRows.push(`<tr><td colspan="5" class="left dim">Brak pozycji do załadunku</td></tr>`)
  } else {
    for (const section of sections) {
      if (hasBlocks && section.title) {
        tbodyRows.push(
          `<tr class="group-row"><td colspan="5">${escapeHtml(section.title)}</td></tr>`,
        )
      }
      for (const item of section.items) {
        lpCounter += 1
        tbodyRows.push(renderItemRow(item, lpCounter - 1))
      }
    }
  }
  const tbody = tbodyRows.join('\n')

  const opiekun = params.projectContact ?? null
  const opiekunName = opiekun?.name?.trim() ? opiekun.name.trim() : ''
  const opiekunPhone = opiekun?.phone?.trim() ? opiekun.phone.trim() : ''
  const opiekunEmail = opiekun?.email?.trim() ? opiekun.email.trim() : companyEmail
  const footerLeft = `<span class="footer__label">Kontakt</span>
      ${
        opiekunName
          ? `${escapeHtml(opiekunName)}<br>\n      ${opiekunPhone ? `tel. ${escapeHtml(opiekunPhone)}<br>\n      ` : ''}${escapeHtml(opiekunEmail)}`
          : escapeHtml(companyEmail)
      }`

  const footerRightCore = `<span class="footer__label">Dane rejestrowe</span>
      ${escapeHtml(companyName)}<br>
      ${escapeHtml(companyAddress)}<br>
      NIP: ${escapeHtml(companyNip)}`
  const footerRight = footerRightCore

  const replacements: [string, string][] = [
    ['{{HDR_LOGO}}', hdrLogo],
    ['{{DOC_NUMBER}}', escapeHtml(params.documentNumberDisplay)],
    ['{{HEADER_META}}', headerMeta],
    ['{{COMPANY_NAME}}', escapeHtml(companyName)],
    ['{{COMPANY_DETAILS}}', companyDetails],
    ['{{CLIENT_NAME}}', escapeHtml(clientName)],
    ['{{CLIENT_DETAILS}}', clientDetails || '—'],
    ['{{DESC_LABEL}}', descLabel],
    ['{{DESC_BODY}}', descBody],
    ['{{EQUIPMENT_TBODY}}', tbody],
    ['{{FOOTER_LEFT}}', footerLeft],
    ['{{FOOTER_RIGHT}}', footerRight],
  ]

  for (const [key, value] of replacements) {
    html = html.split(key).join(value)
  }

  return html
}
