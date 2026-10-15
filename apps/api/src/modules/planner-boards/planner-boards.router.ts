import { Router } from 'express'
import {
  createPlannerBoard,
  deletePlannerBoard,
  getPlannerBoard,
  listPlannerBoards,
  updatePlannerBoard,
} from './planner-boards.controller'
import { PdfController } from '../pdf/pdf.controller'

const router = Router()
const pdfController = new PdfController()

router.get('/', listPlannerBoards)
router.post('/', createPlannerBoard)
router.post('/preview-pdf', pdfController.generatePlannerPreviewPdf.bind(pdfController))
router.get('/:id', getPlannerBoard)
router.patch('/:id', updatePlannerBoard)
router.delete('/:id', deletePlannerBoard)

export default router
