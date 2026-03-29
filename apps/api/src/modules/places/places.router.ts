import { Router } from 'express'
import { autocompletePlaces, getDistanceFromWarehouse } from './places.controller'

const router = Router()

router.get('/autocomplete', autocompletePlaces)
router.get('/distance', getDistanceFromWarehouse)

export default router
