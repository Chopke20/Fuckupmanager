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

const PROJECT_CONTACTS: Record<string, { name: string; phone: string }> = {
  RAFAL: { name: 'Rafał Szydłowski', phone: '504 361 781' },
  MICHAL: { name: 'Michał Rokicki', phone: '793 435 302' },
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
  projectContactKey?: string | null
  documentFooterText?: string | null
}

export function buildWarehousePdfHtml(params: BuildWarehousePdfHtmlParams): string {
  const templatePath = path.join(getTemplatesDir(), 'warehouse-v1.html')
  let html = fs.readFileSync(templatePath, 'utf-8')

  const hdrLogo = extractHdrLogoFromOfferHtml()
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

  const issuedDate = params.issuedAt != null ? new Date(params.issuedAt) : new Date()
  const orderRef =
    params.orderNumber != null && params.orderYear != null
      ? `${params.orderNumber}/${params.orderYear}`
      : '—'
  const dateStr = issuedDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fromStr = params.startDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const toStr = params.endDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

  const items = [...params.equipmentItems].sort((a, b) => {
    const sa = a.sortOrder ?? 0
    const sb = b.sortOrder ?? 0
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })
  })
  const tbody =
    items.length === 0
      ? `<tr><td colspan="5" class="left dim">Brak pozycji sprzętu w zleceniu</td></tr>`
      : items
          .map((item, idx) => {
            const lp = String(idx + 1).padStart(2, '0')
            const unit = item.unit?.trim() || 'szt.'
            return `<tr>
          <td class="chk-cell"><span class="chk-box"></span></td>
          <td class="lp center">${lp}</td>
          <td class="left">${escapeHtml(item.name)}</td>
          <td class="center">${item.quantity}</td>
          <td class="center dim">${escapeHtml(unit)}</td>
        </tr>`
          })
          .join('\n')

  const opiekun = params.projectContactKey ? PROJECT_CONTACTS[params.projectContactKey] : null
  const footerLeft = `<span class="footer__label">Kontakt</span>
      ${opiekun ? `${escapeHtml(opiekun.name)}<br>\n      tel. ${escapeHtml(opiekun.phone)}<br>\n      ${escapeHtml(companyEmail)}` : escapeHtml(companyEmail)}`

  const footerRightCore = `<span class="footer__label">Dane rejestrowe</span>
      ${escapeHtml(companyName)}<br>
      ${escapeHtml(companyAddress)}<br>
      NIP: ${escapeHtml(companyNip)}`
  const footerRight = params.documentFooterText?.trim()
    ? `${footerRightCore}<br>${escapeHtml(params.documentFooterText.trim())}`
    : footerRightCore

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
