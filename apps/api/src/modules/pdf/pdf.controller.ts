import { Request, Response } from 'express'
import { prisma } from '../../prisma/client'
import puppeteer from 'puppeteer'
import { ZodError } from 'zod'
import { OrderOfferSnapshotSchema, type OfferDocumentDraft, type OrderOfferSnapshot } from '@lama-stage/shared-types'
import { buildOfferHtmlV5, type OrderLike } from './offer-v5-builder'
import { buildWarehousePdfHtml } from './warehouse-pdf-builder'
import {
  buildDocumentNumber,
  parseJsonSafely,
  resolveDefaultIssuerForDraft,
} from '../orders/order-document-draft-utils'
import {
  areOfferSnapshotContentsEqual,
  buildOrderOfferSnapshotFromOrder,
  loadOfferDraftPayload,
  orderOfferSnapshotToPdfOrderLike,
} from '../orders/offer-snapshot-merge'

type OrderWithRelations = Awaited<ReturnType<typeof loadOrderForPdf>>

async function loadOrderForPdf(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      stages: { orderBy: { sortOrder: 'asc' } },
      equipmentItems: {
        include: { equipment: true },
        orderBy: { sortOrder: 'asc' },
      },
      productionItems: {
        where: { visibleInOffer: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
}

function getOfferNumberDisplay(order: OrderWithRelations, nextVersion?: number): string {
  if (order == null) return '—'
  const year = order.orderYear ?? new Date(order.createdAt).getFullYear()
  const num = order.orderNumber
  const ver = nextVersion ?? (order.offerVersion ?? 0)
  if (num == null || num < 1) return order.offerNumber ?? '—'
  return buildDocumentNumber({
    documentType: 'OFFER',
    orderNumber: num,
    orderYear: year,
    version: ver,
  })
}

export class PdfController {
  private isToinenMusicModeAllowed(appSettings: unknown): boolean {
    const s = appSettings as { enableToinenMusicMode?: boolean | null } | null
    return s?.enableToinenMusicMode === true
  }

  private applyToinenMusicModeIfEnabled(
    appSettings: unknown,
    draftPayload: OfferDocumentDraft,
    branding: { accentColorHex: string | null; logoUrl: string | null },
    projectContact: { name?: string | null; phone?: string | null; email?: string | null } | null
  ): {
    draftPayload: OfferDocumentDraft
    branding: { accentColorHex: string | null; logoUrl: string | null }
    projectContact: { name?: string | null; phone?: string | null; email?: string | null } | null
    offerIssuerDetailsVariant: 'DEFAULT' | 'ADDRESS_NIP'
  } {
    const requested = (draftPayload as any).toinenMusicMode === true

    if (!requested) return { draftPayload, branding, projectContact, offerIssuerDetailsVariant: 'DEFAULT' }
    if (!this.isToinenMusicModeAllowed(appSettings)) {
      // If company disables the mode, ignore even if draft contains it.
      return {
        draftPayload: { ...(draftPayload as any), toinenMusicMode: false },
        branding,
        projectContact,
        offerIssuerDetailsVariant: 'DEFAULT',
      }
    }

    const issuer = {
      profileKey: 'TOINEN_MUSIC',
      companyName: 'Toinen Music Mariusz Nowicki',
      address: 'ul. Czerska 8/10\n00-732 Warszawa',
      nip: '8121780604',
      email: 'pawel@toinenmusic.com',
      phone: '508067687',
    }
    const nextDraft: OfferDocumentDraft = {
      ...(draftPayload as any),
      issuer,
      projectContactId: null,
      projectContactKey: null,
      toinenMusicMode: true,
    }

    return {
      draftPayload: nextDraft,
      branding: {
        accentColorHex: '#81B29F',
        logoUrl: 'https://toinenmusic.pl/wp-content/themes/toinen-wp/img/logo.svg',
      },
      projectContact: {
        name: 'Paweł Szumny',
        phone: '508067687',
        email: 'pawel@toinenmusic.com',
      },
      offerIssuerDetailsVariant: 'ADDRESS_NIP',
    }
  }

  private pickProjectContact(
    appSettings: unknown,
    preferredContactId?: string | null,
  ): { name?: string | null; phone?: string | null; email?: string | null } | null {
    const s = appSettings as { projectContactsJson?: string | null; defaultProjectContactId?: string | null } | null
    const raw = s?.projectContactsJson
    if (!raw || !raw.trim()) return null
    let list: Array<{ id?: unknown; name?: unknown; phone?: unknown; email?: unknown }> = []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) list = parsed as any
    } catch {
      return null
    }
    const preferredId = preferredContactId ? String(preferredContactId) : null
    const defaultId = s?.defaultProjectContactId ?? null
    const pick =
      (preferredId ? list.find((c) => String(c.id ?? '') === preferredId) : null) ??
      (defaultId ? list.find((c) => String(c.id ?? '') === defaultId) : null) ??
      (list[0] ?? null)
    if (!pick) return null
    const name = typeof pick.name === 'string' ? pick.name : null
    const phone = typeof pick.phone === 'string' ? pick.phone : null
    const email = typeof pick.email === 'string' ? pick.email : null
    return { name, phone, email }
  }

  private normalizeHexColor(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!trimmed) return null
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
    return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : null
  }

  private pickDocumentsLogoUrl(appSettings: unknown): string | null {
    const s = appSettings as {
      logoDarkBgUrl?: string | null
      logoLightBgUrl?: string | null
      documentsLogoVariant?: string | null
      offerLogoVariant?: string | null
    } | null
    const dark = typeof s?.logoDarkBgUrl === 'string' && s.logoDarkBgUrl.trim() ? s.logoDarkBgUrl.trim() : null
    const light = typeof s?.logoLightBgUrl === 'string' && s.logoLightBgUrl.trim() ? s.logoLightBgUrl.trim() : null
    const variant = s?.documentsLogoVariant ?? s?.offerLogoVariant ?? null
    if (variant === 'LIGHT') return light ?? dark
    if (variant === 'DARK') return dark ?? light
    return dark ?? light
  }

  private getPdfBranding(appSettings: unknown): { accentColorHex: string | null; logoUrl: string | null } {
    const s = appSettings as { primaryColorHex?: string | null } | null
    return {
      accentColorHex: this.normalizeHexColor(s?.primaryColorHex ?? null),
      logoUrl: this.pickDocumentsLogoUrl(appSettings),
    }
  }

  private async tryLoadLogoAsDataUri(logoUrl: string | null): Promise<string | null> {
    if (!logoUrl) return null
    const url = logoUrl.trim()
    if (!/^https?:\/\//i.test(url)) return null

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 7000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) return null
      const contentType = response.headers.get('content-type') || ''
      const ct = contentType.toLowerCase()
      const isSvg = ct.includes('svg') || /\.svg(\?|#|$)/i.test(url)
      if (!ct.startsWith('image/') && !isSvg) return null
      const bytes = Buffer.from(await response.arrayBuffer())
      const asType = isSvg ? 'image/svg+xml' : contentType
      return `data:${asType};base64,${bytes.toString('base64')}`
    } catch {
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  private async resolvePdfBranding(appSettings: unknown): Promise<{ accentColorHex: string | null; logoUrl: string | null }> {
    const base = this.getPdfBranding(appSettings)
    const inlineLogo = await this.tryLoadLogoAsDataUri(base.logoUrl)
    return {
      accentColorHex: base.accentColorHex,
      logoUrl: inlineLogo ?? base.logoUrl,
    }
  }

  /** Podgląd PDF bez podbijania wersji */
  async previewOffer(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId
      if (!orderId) return res.status(400).json({ error: 'Brak ID zlecenia' })
      const order = await loadOrderForPdf(orderId)
      if (!order) return res.status(404).json({ error: 'Zlecenie nie znalezione' })
      if (!order.client) {
        return res.status(400).json({ error: 'Zlecenie nie ma przypisanego klienta — brak danych do oferty' })
      }
      let draftPayload = await loadOfferDraftPayload(prisma, orderId, order)
      const nextVer = (order.offerVersion ?? 0) + 1
      const offerNumberDisplay = getOfferNumberDisplay(order, nextVer)
      const generatedAt = new Date().toISOString()
      const appSettings = await prisma.appSettings.findUnique({ where: { id: 1 } }).catch(() => null)
      let branding = await this.resolvePdfBranding(appSettings)
      const preferredContactId =
        (draftPayload && typeof draftPayload === 'object' && 'projectContactId' in (draftPayload as any))
          ? String((draftPayload as any).projectContactId ?? '').trim() || null
          : null
      let projectContact = this.pickProjectContact(appSettings, preferredContactId)
      let offerIssuerDetailsVariant: 'DEFAULT' | 'ADDRESS_NIP' = 'DEFAULT'
      ;({ draftPayload, branding, projectContact, offerIssuerDetailsVariant } = this.applyToinenMusicModeIfEnabled(
        appSettings,
        draftPayload,
        branding,
        projectContact,
      ))
      // Ensure logo is inlined for Puppeteer reliability (especially for external SVG URLs).
      branding = {
        ...branding,
        logoUrl: (await this.tryLoadLogoAsDataUri(branding.logoUrl)) ?? branding.logoUrl,
      }
      const snapshot = buildOrderOfferSnapshotFromOrder(order, draftPayload, {
        generatedAt,
        documentNumber: offerNumberDisplay,
      })
      const html = buildOfferHtmlV5(orderOfferSnapshotToPdfOrderLike(snapshot), offerNumberDisplay, {
        issuedAt: generatedAt,
        projectContact,
        accentColorHex: branding.accentColorHex,
        logoUrl: branding.logoUrl,
        issuerDetailsVariant: offerIssuerDetailsVariant,
      })
      const pdfBuffer = await this.renderPdf(html)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'inline; filename="Oferta-podglad.pdf"')
      res.send(pdfBuffer)
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Podgląd PDF — walidacja snapshotu:', error.flatten())
        return res.status(400).json({
          error:
            'Dane zlecenia nie przechodzą walidacji oferty (np. brakujące pola klienta lub pozycji). Szczegóły w logu serwera.',
        })
      }
      console.error('Błąd podglądu PDF:', error)
      res.status(500).json({ error: 'Błąd generowania podglądu oferty PDF' })
    }
  }

  /**
   * Generuje PDF oferty i zapisuje snapshot (`OrderDocumentExport`), o ile treść oferty zmieniła się
   * względem ostatniego eksportu. Format numeru: `OFR-{YY}-{NNNN}-v{V}` (legacy snapshots: `N.V.YYYY`).
   * Gdy jedyna różnica to data wystawienia (ta sama treść co ostatni snapshot), **nie** podbija wersji
   * i **nie** tworzy nowego rekordu eksportu — PDF dostaje ten sam numer z aktualną datą w nagłówku.
   */
  async generateOffer(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId
      if (!orderId) return res.status(400).json({ error: 'Brak ID zlecenia' })
      const order = await loadOrderForPdf(orderId)
      if (!order) return res.status(404).json({ error: 'Zlecenie nie znalezione' })
      if (!order.client) {
        return res.status(400).json({ error: 'Zlecenie nie ma przypisanego klienta — brak danych do oferty' })
      }

      const orderYear = order.orderYear ?? new Date(order.createdAt).getFullYear()
      const orderNumber = order.orderNumber
      if (orderNumber == null || orderYear == null) {
        return res.status(400).json({
          error: 'Zlecenie nie ma nadanego numeru. Uruchom skrypt backfillu numeracji lub utwórz zlecenie ponownie.',
        })
      }

      let draftPayload = await loadOfferDraftPayload(prisma, orderId, order)
      const generatedAt = new Date().toISOString()
      const appSettings = await prisma.appSettings.findUnique({ where: { id: 1 } }).catch(() => null)
      let branding = await this.resolvePdfBranding(appSettings)
      const preferredContactId =
        (draftPayload && typeof draftPayload === 'object' && 'projectContactId' in (draftPayload as any))
          ? String((draftPayload as any).projectContactId ?? '').trim() || null
          : null
      let projectContact = this.pickProjectContact(appSettings, preferredContactId)
      let offerIssuerDetailsVariant: 'DEFAULT' | 'ADDRESS_NIP' = 'DEFAULT'
      ;({ draftPayload, branding, projectContact, offerIssuerDetailsVariant } = this.applyToinenMusicModeIfEnabled(
        appSettings,
        draftPayload,
        branding,
        projectContact,
      ))
      // Ensure logo is inlined for Puppeteer reliability (especially for external SVG URLs).
      branding = {
        ...branding,
        logoUrl: (await this.tryLoadLogoAsDataUri(branding.logoUrl)) ?? branding.logoUrl,
      }
      const newVersion = (order.offerVersion ?? 0) + 1
      const candidateOfferNumber = buildDocumentNumber({
        documentType: 'OFFER',
        orderNumber,
        orderYear,
        version: newVersion,
      })

      const candidateSnapshot = buildOrderOfferSnapshotFromOrder(order, draftPayload, {
        generatedAt,
        documentNumber: candidateOfferNumber,
      })

      const lastExport = await prisma.orderDocumentExport.findFirst({
        where: { orderId, documentType: 'OFFER' },
        orderBy: { exportedAt: 'desc' },
      })

      let lastParsed: Record<string, unknown> | null = null
      if (lastExport?.snapshot) {
        try {
          lastParsed = JSON.parse(lastExport.snapshot) as Record<string, unknown>
        } catch {
          lastParsed = null
        }
      }

      const reuseSameNumber =
        lastParsed != null &&
        areOfferSnapshotContentsEqual(candidateSnapshot as unknown as Record<string, unknown>, lastParsed)

      let snapshot: OrderOfferSnapshot
      let finalOfferNumber: string
      let exportCreated = true

      if (reuseSameNumber) {
        exportCreated = false
        finalOfferNumber = order.offerNumber ?? lastExport!.documentNumber
        snapshot = buildOrderOfferSnapshotFromOrder(order, draftPayload, {
          generatedAt,
          documentNumber: finalOfferNumber,
        })
      } else {
        snapshot = await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: orderId },
            data: { offerVersion: newVersion, offerNumber: candidateOfferNumber },
          })
          const fresh = await tx.order.findUnique({
            where: { id: orderId },
            include: {
              client: true,
              stages: { orderBy: { sortOrder: 'asc' } },
              equipmentItems: {
                include: { equipment: true },
                orderBy: { sortOrder: 'asc' },
              },
              productionItems: {
                where: { visibleInOffer: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          })
          if (!fresh?.client) {
            throw new Error('ORDER_CLIENT_MISSING_AFTER_UPDATE')
          }
          const draftInTx = await loadOfferDraftPayload(tx, orderId, fresh)
          const snap = buildOrderOfferSnapshotFromOrder(fresh, draftInTx, {
            generatedAt,
            documentNumber: candidateOfferNumber,
          })
          await tx.orderDocumentExport.create({
            data: {
              orderId,
              documentType: 'OFFER',
              documentNumber: candidateOfferNumber,
              snapshot: JSON.stringify(snap),
            },
          })
          return snap
        })
        finalOfferNumber = candidateOfferNumber
      }

      res.setHeader('X-Offer-Export-Created', exportCreated ? '1' : '0')
      res.setHeader('X-Offer-Number-Reused', reuseSameNumber ? '1' : '0')

      const html = buildOfferHtmlV5(orderOfferSnapshotToPdfOrderLike(snapshot), finalOfferNumber, {
        issuedAt: generatedAt,
        projectContact,
        accentColorHex: branding.accentColorHex,
        logoUrl: branding.logoUrl,
        issuerDetailsVariant: offerIssuerDetailsVariant,
      })
      const pdfBuffer = await this.renderPdf(html)

      const filename = `Oferta-${finalOfferNumber}.pdf`
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(pdfBuffer)
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Generowanie PDF — walidacja snapshotu:', error.flatten())
        return res.status(400).json({
          error:
            'Dane zlecenia nie przechodzą walidacji oferty (np. brakujące pola klienta lub pozycji). Szczegóły w logu serwera.',
        })
      }
      if (error instanceof Error && error.message === 'ORDER_CLIENT_MISSING_AFTER_UPDATE') {
        return res.status(500).json({ error: 'Błąd spójności danych zlecenia' })
      }
      console.error('Błąd generowania PDF:', error)
      res.status(500).json({ error: 'Błąd generowania oferty PDF' })
    }
  }

  /** Generuj ofertę z istniejącego eksportu (snapshot) – nie zmienia numeracji */
  async exportOfferFromSnapshot(req: Request, res: Response) {
    try {
      const exportId = req.params.exportId
      if (!exportId) return res.status(400).json({ error: 'Brak ID eksportu' })

      const exportRecord = await prisma.orderDocumentExport.findUnique({
        where: { id: exportId },
      })

      if (!exportRecord) {
        return res.status(404).json({ error: 'Eksport dokumentu nie znaleziony' })
      }

      if (exportRecord.documentType !== 'OFFER') {
        return res.status(400).json({ error: 'Obsługiwany jest tylko eksport oferty (OFFER)' })
      }

      let snapshotRaw: unknown
      try {
        snapshotRaw = JSON.parse(exportRecord.snapshot)
      } catch {
        return res.status(500).json({ error: 'Nie udało się odczytać snapshotu eksportu' })
      }

      const parsed = OrderOfferSnapshotSchema.safeParse(snapshotRaw)
      const raw = snapshotRaw as Record<string, unknown>
      let issuedAtFallback: string | undefined
      if (typeof raw.generatedAt === 'string') {
        issuedAtFallback = raw.generatedAt
      } else {
        const dd = raw.documentDraft
        if (dd && typeof dd === 'object' && dd !== null && 'issuedAt' in dd) {
          const v = (dd as { issuedAt?: unknown }).issuedAt
          if (typeof v === 'string') issuedAtFallback = v
        }
      }
      const issuedAt: string | undefined =
        parsed.success && parsed.data.generatedAt ? parsed.data.generatedAt : issuedAtFallback
      const appSettings = await prisma.appSettings.findUnique({ where: { id: 1 } }).catch(() => null)
      const branding = await this.resolvePdfBranding(appSettings)
      const projectContact = this.pickProjectContact(appSettings, null)
      const html = parsed.success
        ? buildOfferHtmlV5(orderOfferSnapshotToPdfOrderLike(parsed.data), exportRecord.documentNumber, {
            issuedAt,
            projectContact,
            accentColorHex: branding.accentColorHex,
            logoUrl: branding.logoUrl,
          })
        : buildOfferHtmlV5(raw as OrderLike, exportRecord.documentNumber, {
            issuedAt,
            projectContact,
            accentColorHex: branding.accentColorHex,
            logoUrl: branding.logoUrl,
          })
      const pdfBuffer = await this.renderPdf(html)

      const filename = `Oferta-${exportRecord.documentNumber}.pdf`
      const inline =
        req.query.inline === '1' || req.query.preview === '1' || req.query.preview === 'true'
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        inline
          ? `inline; filename="Oferta-${exportRecord.documentNumber}-podglad.pdf"`
          : `attachment; filename="${filename}"`
      )
      res.send(pdfBuffer)
    } catch (error) {
      console.error('Błąd generowania PDF z eksportu:', error)
      res.status(500).json({ error: 'Błąd generowania oferty PDF z eksportu' })
    }
  }

  /**
   * PDF „Magazyn / załadunek” do wydruku: nagłówek jak oferta, lista sprzętu z pustymi kratkami (odhaczanie odręczne).
   * Nie tworzy rekordu eksportu — numer `WHS-{YY}-{NNNN}-v{następna}` jest „kolejnym” względem zapisanych snapshotów.
   */
  async generateWarehousePdf(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId
      if (!orderId) return res.status(400).json({ error: 'Brak ID zlecenia' })

      const order = await prisma.order.findFirst({
        where: { id: orderId, isDeleted: false },
        include: {
          client: true,
          equipmentItems: {
            include: { equipment: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      })
      if (!order) return res.status(404).json({ error: 'Zlecenie nie znalezione' })

      const orderYear = order.orderYear ?? new Date(order.createdAt).getFullYear()
      const orderNumber = order.orderNumber
      if (orderNumber == null || orderYear == null) {
        return res.status(400).json({
          error: 'Zlecenie nie ma nadanego numeru — nie można zbudować numeru dokumentu magazynu.',
        })
      }

      const exportCount = await prisma.orderDocumentExport.count({
        where: { orderId, documentType: 'WAREHOUSE' },
      })
      const version = exportCount + 1
      const documentNumberDisplay = buildDocumentNumber({
        documentType: 'WAREHOUSE',
        orderNumber,
        orderYear,
        version,
      })

      const draftRecord = await prisma.orderDocumentDraft.findUnique({
        where: {
          orderId_documentType: {
            orderId,
            documentType: 'WAREHOUSE',
          },
        },
      })
      const parsedDraft = parseJsonSafely(draftRecord?.payload ?? null)
      let draftTitle = ''
      let draftNotes = ''
      if (parsedDraft && typeof parsedDraft === 'object') {
        const o = parsedDraft as Record<string, unknown>
        if (typeof o.title === 'string') draftTitle = o.title
        if (typeof o.notes === 'string') draftNotes = o.notes
      }

      const issuer = await resolveDefaultIssuerForDraft(prisma)
      const appSettings = await prisma.appSettings.findUnique({ where: { id: 1 } }).catch(() => null)
      const branding = await this.resolvePdfBranding(appSettings)
      const projectContact = this.pickProjectContact(appSettings, null)
      const generatedAt = new Date().toISOString()
      const html = buildWarehousePdfHtml({
        documentNumberDisplay,
        issuedAt: generatedAt,
        orderName: order.name,
        orderNumber,
        orderYear,
        venue: order.venue,
        startDate: order.startDate,
        endDate: order.endDate,
        draftTitle,
        draftNotes,
        issuer,
        client: order.client
          ? {
              companyName: order.client.companyName,
              nip: order.client.nip,
              address: order.client.address,
              contactName: order.client.contactName,
              email: order.client.email,
              phone: order.client.phone,
            }
          : null,
        equipmentItems: order.equipmentItems.map((e) => ({
          name: e.name,
          quantity: e.quantity,
          unit: e.equipment?.unit ?? 'szt.',
          sortOrder: e.sortOrder,
        })),
        projectContactKey: order.projectContactKey,
        projectContact,
        accentColorHex: branding.accentColorHex,
        logoUrl: branding.logoUrl,
      })

      const pdfBuffer = await this.renderPdf(html)
      const filename = `Magazyn-${documentNumberDisplay}.pdf`
      const inline =
        req.query.inline === '1' || req.query.preview === '1' || req.query.preview === 'true'
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        inline ? `inline; filename="Magazyn-podglad.pdf"` : `attachment; filename="${filename}"`,
      )
      res.send(pdfBuffer)
    } catch (error) {
      console.error('Błąd generowania PDF magazynu:', error)
      res.status(500).json({ error: 'Błąd generowania PDF magazynu' })
    }
  }

  private async renderPdf(html: string): Promise<Buffer> {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
    const launchTimeoutMs = Number(process.env.PUPPETEER_LAUNCH_TIMEOUT_MS ?? 90000)
    const browser = await puppeteer.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      timeout: Number.isFinite(launchTimeoutMs) && launchTimeoutMs > 0 ? launchTimeoutMs : 90000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    })
    const page = await browser.newPage()

    const footerMatch =
      html.match(
        /<div class="footer">\s*<div class="footer__col">[\s\S]*?<\/div>\s*<div class="footer__col">[\s\S]*?<\/div>\s*<\/div>/,
      ) ?? null
    const footerColsMatch = footerMatch?.[0].match(
      /<div class="footer">\s*<div class="footer__col">([\s\S]*?)<\/div>\s*<div class="footer__col">([\s\S]*?)<\/div>\s*<\/div>/,
    )

    const footerLabelInlineStyle =
      'font-size:6pt;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#111;margin-bottom:2px;display:block;'
    const leftHtml = footerColsMatch?.[1] ?? ''
    const rightHtml = footerColsMatch?.[2] ?? ''
    const leftStyled = leftHtml.replace(
      /<span class="footer__label">/g,
      `<span class="footer__label" style="${footerLabelInlineStyle}">`,
    )
    const rightStyled = rightHtml.replace(
      /<span class="footer__label">/g,
      `<span class="footer__label" style="${footerLabelInlineStyle}">`,
    )

    const contentX = '16mm'
    const footerTemplate = footerMatch
      ? `<style>html,body{margin:0;padding:0;width:100%;height:100%;}</style>
         <div style="width:100%; height:100%; background:#f2f2f0; border-top:1px solid #d8d8d6; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; margin-bottom:-25px; padding-bottom:25px;">
           <div style="width:100%; box-sizing:border-box; display:grid; grid-template-columns:1fr 1fr; padding:8px ${contentX} 10px; font-family:'Switzer','Helvetica Neue',Arial,sans-serif; font-size:7.5pt; color:#444; line-height:1.55; align-items:start;">
             <div style="padding:0;">${leftStyled}</div>
             <div style="padding-left:18px; border-left:1px solid #d8d8d6;">${rightStyled}</div>
           </div>
         </div>`
      : '<div style="width:100%"></div>'

    const htmlWithoutFooter = footerMatch ? html.replace(footerMatch[0], '') : html
    const contentTimeoutMs = Number(process.env.PUPPETEER_CONTENT_TIMEOUT_MS ?? 45000)
    await page.setContent(htmlWithoutFooter, {
      // networkidle0 potrafi wisieć na VPS (fonty z zewnątrz / DNS) — PDF nie wymaga idle sieci
      waitUntil: 'domcontentloaded',
      timeout: Number.isFinite(contentTimeoutMs) && contentTimeoutMs > 0 ? contentTimeoutMs : 45000,
    })
    await page.emulateMediaType('print')
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate,
      margin: { top: '0px', right: '0px', bottom: '25mm', left: '0px' },
    })
    await browser.close()
    return Buffer.from(pdfBuffer)
  }
}
