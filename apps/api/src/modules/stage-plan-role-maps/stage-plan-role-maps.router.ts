import { Router } from 'express'
import {
  bulkUpsertStagePlanRoleMaps,
  deleteStagePlanRoleMap,
  listStagePlanRoleMaps,
  upsertStagePlanRoleMap,
} from './stage-plan-role-maps.controller'

const router = Router()

router.get('/', listStagePlanRoleMaps)
router.put('/bulk', bulkUpsertStagePlanRoleMaps)
router.put('/', upsertStagePlanRoleMap)
router.delete('/:roleKey', deleteStagePlanRoleMap)

export default router
