import { Router } from 'express'
import {
  createStagePlanProject,
  deleteStagePlanProject,
  getStagePlanProject,
  listStagePlanProjects,
  updateStagePlanProject,
  upsertStagePlanProjectForOrder,
} from './stage-plan-projects.controller'

const router = Router()

router.get('/', listStagePlanProjects)
router.post('/', createStagePlanProject)
router.put('/by-order/:orderId', upsertStagePlanProjectForOrder)
router.get('/:id', getStagePlanProject)
router.patch('/:id', updateStagePlanProject)
router.delete('/:id', deleteStagePlanProject)

export default router
