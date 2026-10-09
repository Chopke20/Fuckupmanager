import { Router } from 'express'
import {
  createLedScreenProject,
  deleteLedScreenProject,
  getLedScreenProject,
  getLedScreenProjectByOrder,
  listLedScreenProjects,
  updateLedScreenProject,
  upsertLedScreenProjectForOrder,
} from './led-screen-projects.controller'

const router = Router()

router.get('/', listLedScreenProjects)
router.post('/', createLedScreenProject)
router.get('/by-order/:orderId', getLedScreenProjectByOrder)
router.put('/by-order/:orderId', upsertLedScreenProjectForOrder)
router.get('/:id', getLedScreenProject)
router.patch('/:id', updateLedScreenProject)
router.delete('/:id', deleteLedScreenProject)

export default router
