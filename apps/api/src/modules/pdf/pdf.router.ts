import { Router } from 'express'
import { PdfController } from './pdf.controller'

const router = Router()
const pdfController = new PdfController()

router.post('/offer/:orderId/preview', pdfController.previewOffer.bind(pdfController))
router.post('/offer/:orderId/generate', pdfController.generateOffer.bind(pdfController))
/** Parked Excel export — UI hidden (`OFFER_EXCEL_EXPORT_VISIBLE`). Keep routes. */
router.post('/offer/:orderId/excel', pdfController.exportOfferExcel.bind(pdfController))
router.post('/offer/export/:exportId', pdfController.exportOfferFromSnapshot.bind(pdfController))
router.post('/offer/export/:exportId/excel', pdfController.exportOfferExcelFromSnapshot.bind(pdfController))
router.get('/warehouse/:orderId/generate', pdfController.generateWarehousePdf.bind(pdfController))
router.get('/stage-plan/:orderId/generate', pdfController.generateStagePlanPdf.bind(pdfController))

export default router