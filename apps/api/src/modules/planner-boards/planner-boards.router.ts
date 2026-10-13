import { Router } from 'express'
import {
  createPlannerBoard,
  deletePlannerBoard,
  getPlannerBoard,
  listPlannerBoards,
  updatePlannerBoard,
} from './planner-boards.controller'

const router = Router()

router.get('/', listPlannerBoards)
router.post('/', createPlannerBoard)
router.get('/:id', getPlannerBoard)
router.patch('/:id', updatePlannerBoard)
router.delete('/:id', deletePlannerBoard)

export default router
