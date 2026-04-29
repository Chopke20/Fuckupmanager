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

function svgToDataUri(svg: string): string {
  const trimmed = svg.trim()
  const base64 = Buffer.from(trimmed, 'utf8').toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

const TOINEN_LOGO_SVG = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 18.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
\t viewBox="0 0 519.4 200.6" enable-background="new 0 0 519.4 200.6" xml:space="preserve">
<g id="Layer_1">
\t<g>
\t\t<polygon points="14.1,23.4 65.6,23.4 65.6,42.1 48.6,42.1 48.6,97.9 30.1,97.9 30.1,42.1 14.1,42.1 \t\t"/>
\t\t<path d="M106.1,22.9c-21.5,0-38.9,17.4-38.9,38.9c0,21.5,17.4,38.9,38.9,38.9S145,83.2,145,61.7C145,40.3,127.5,22.9,106.1,22.9z
\t\t\t M106.1,84.5C95,84.5,86,74.6,86,62.4s9-22.1,20.1-22.1s20.1,9.9,20.1,22.1S117.2,84.5,106.1,84.5z"/>
\t\t<rect x="152.4" y="24.6" width="19.6" height="75.5"/>
\t\t<polygon fill="#5FB29E" points="143.7,182.2 126.8,182.2 155.1,110.5 172,110.5 \t\t"/>
\t\t<polygon fill="#5FB29E" points="112.3,182.2 95.4,182.2 123.7,110.5 140.6,110.5 \t\t"/>
\t\t<rect x="430.3" y="107.7" width="19.6" height="75.5"/>
\t\t<path d="M225.8,23.4c-12.7,0-19.8,4.8-23.7,9.4v-8.2h-19.6v75.5h19.6c0,0,0-36.1,0-40.8s1-19.1,15.1-19.5
\t\t\tc12.5-0.3,12.5,11.2,12.5,11.2v49.1h19.6V51C249.4,51,251.8,23.4,225.8,23.4z"/>
\t\t<path d="M388,23.4c-12.7,0-19.8,4.8-23.7,9.4v-8.2h-19.6v75.5h19.6c0,0,0-36.1,0-40.8s1-19.1,15.1-19.5C392,39.5,392,51,392,51
\t\t\tv49.1h19.6V51C411.6,51,414,23.4,388,23.4z"/>
\t\t<path d="M225.7,108.7c-12.2,0-19,4.6-22.7,9v-7.8h-18.9v72.4H203v-39.1c0,0,1-18.7,14.5-18.7c12.1,0,12,10.7,12,10.7v47.1h18.9
\t\t\tv-47.1C248.4,135.1,250.7,108.7,225.7,108.7z"/>
\t\t<path d="M229.6,138.6v43.6h18.9v-39.1c0,0,1-18.4,14.5-18.7c12-0.3,12,10.7,12,10.7v47.1h18.9v-47.1c0,0,1-26.5-22.7-26.5
\t\t\tc-12.2,0-19,4.6-22.7,9"/>
\t\t<g>
\t\t\t<path d="M335.2,61.8c0-21.8-17.4-39.5-39-39.5c-21.5,0-39,17.7-39,39.5c0,21.8,17.4,39.5,39,39.5c16.5,0,26.6-7.1,33.7-16.3
\t\t\t\tl-15.1-7.9c-4.3,5-9.3,8.2-18.7,8.2c-9.7,0-19.4-7.5-21.8-17.6H318h17.2 M296.9,39.1c10.2,0,16.7,5.6,20.6,14.1h-41.1
\t\t\t\tC280.2,44.8,286.7,39.1,296.9,39.1z"/>
\t\t</g>
\t\t<g>
\t\t\t<path d="M493.5,124.7c3.7,0,7.2,1.1,10.2,3.1v-18.9c-3.3-0.9-6.7-1.4-10.2-1.4c-21.2,0-38.4,17.2-38.4,38.4
\t\t\t\tc0,21.2,17.2,38.4,38.4,38.4c3.5,0,7-0.5,10.2-1.4v-17.7c-3,2-6.5,3.1-10.2,3.1c-11,0-19.9-9.8-19.9-21.8
\t\t\t\tC473.6,134.5,482.5,124.7,493.5,124.7z"/>
\t\t</g>
\t\t<path d="M349.8,110.3v38.3v1.4c0,0.9,0,2.2,0,4.2c0,12.6-10.9,13.3-12.8,13.2c-2,0.1-12.8-0.6-12.8-13.2c0-2,0-3.3,0-4.2v-1.4
\t\t\tv-38.3h-18v46.4c0,0-0.1,27.8,30.8,27.8s30.8-27.8,30.8-27.8v-46.4H349.8z"/>
\t\t<path d="M399.7,168.5c4.9,0,14.5-4.9,5.2-11.7s-26.5-9.1-27.9-26.1c-1.4-17,12.1-20.9,15.7-21.5c8.6-1.5,18.4-1.3,29.9,10.3
\t\t\tl-10.9,10.9c0,0-5.6-6.2-10.8-6.2s-6.7,2.6-6.7,2.6s-3.6,3.9,2.6,7.5c5.8,3.3,21.4,6.6,27.1,21c5,12.4-5.6,29.1-24.2,29.1
\t\t\tc-17.5,0-25.8-12.3-25.8-12.3l11.1-12.4C385.1,159.6,391.2,168.5,399.7,168.5z"/>
\t\t<path fill="#E30613" d="M427.6,153.6"/>
\t</g>
</g>
<g id="Layer_2">
</g>
</svg>`

const TOINEN_LOGO_DATA_URI = svgToDataUri(TOINEN_LOGO_SVG)

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
        logoUrl: TOINEN_LOGO_DATA_URI,
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
          let draftInTx = await loadOfferDraftPayload(tx, orderId, fresh)
          // Important: apply special modes inside TX as well, because we re-load the draft from DB here.
          // Otherwise, preview can look correct while "Generate" persists a snapshot with default issuer/footer.
          ;({ draftPayload: draftInTx } = this.applyToinenMusicModeIfEnabled(
            appSettings,
            draftInTx,
            branding,
            projectContact,
          ))
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
