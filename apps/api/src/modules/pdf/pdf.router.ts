import { Router } from 'express'
import { PdfController } from './pdf.controller'

const router = Router()
const pdfController = new PdfController()

router.post('/offer/:orderId/preview', pdfController.previewOffer.bind(pdfController))
router.post('/offer/:orderId/generate', pdfController.generateOffer.bind(pdfController))
router.post('/offer/export/:exportId', pdfController.exportOfferFromSnapshot.bind(pdfController))
router.get('/warehouse/:orderId/generate', pdfController.generateWarehousePdf.bind(pdfController))

export default router