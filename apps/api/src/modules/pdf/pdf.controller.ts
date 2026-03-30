import { Request, Response } from 'express'
import { prisma } from '../../prisma/client'
import puppeteer from 'puppeteer'
import { ZodError } from 'zod'
import { OrderOfferSnapshotSchema, type OrderOfferSnapshot } from '@lama-stage/shared-types'
import { buildOfferHtmlV5, type OrderLike } from './offer-v5-builder'
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
  const num = order.orderNumber ?? 0
  const ver = nextVersion ?? (order.offerVersion ?? 0)
  if (num === 0) return order.offerNumber ?? '—'
  return `${num}.${ver}.${year}`
}

export class PdfController {
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
      const draftPayload = await loadOfferDraftPayload(prisma, orderId, order)
      const nextVer = (order.offerVersion ?? 0) + 1
      const offerNumberDisplay = getOfferNumberDisplay(order, nextVer)
      const generatedAt = new Date().toISOString()
      const snapshot = buildOrderOfferSnapshotFromOrder(order, draftPayload, {
        generatedAt,
        documentNumber: offerNumberDisplay,
      })
      const html = buildOfferHtmlV5(orderOfferSnapshotToPdfOrderLike(snapshot), offerNumberDisplay, {
        issuedAt: generatedAt,
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
   * względem ostatniego eksportu. Format numeru: `{numerZleceniaWRoku}.{wersjaOferty}.{rok}`.
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

      const draftPayload = await loadOfferDraftPayload(prisma, orderId, order)
      const generatedAt = new Date().toISOString()
      const newVersion = (order.offerVersion ?? 0) + 1
      const candidateOfferNumber = `${orderNumber}.${newVersion}.${orderYear}`

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

      const html = parsed.success
        ? buildOfferHtmlV5(orderOfferSnapshotToPdfOrderLike(parsed.data), exportRecord.documentNumber, {
            issuedAt,
          })
        : buildOfferHtmlV5(raw as OrderLike, exportRecord.documentNumber, { issuedAt })
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

  private async renderPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true })
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
    await page.setContent(htmlWithoutFooter, { waitUntil: 'networkidle0' })
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
