import { Router } from 'express'
import {
  createStagePlanProject,
  deleteStagePlanProject,
  getStagePlanProject,
  listStagePlanProjects,
  updateStagePlanProject,
  upsertStagePlanProjectForOrder,
} from './stage-plan-projects.controller'
import { PdfController } from '../pdf/pdf.controller'

const router = Router()
const pdfController = new PdfController()

router.get('/', listStagePlanProjects)
router.post('/', createStagePlanProject)
router.post('/preview-pdf', pdfController.generateStagePlanPreviewPdf.bind(pdfController))
router.put('/by-order/:orderId', upsertStagePlanProjectForOrder)
router.get('/:id', getStagePlanProject)
router.patch('/:id', updateStagePlanProject)
router.delete('/:id', deleteStagePlanProject)

export default router
