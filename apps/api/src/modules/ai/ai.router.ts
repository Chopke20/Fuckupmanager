import { Router } from 'express'
import {
  generateDescription,
  generateOfferClientDescription,
  rewriteOrderDescription,
} from './ai.controller'

const router = Router()

router.post('/description', generateDescription)
router.post('/order-description', rewriteOrderDescription)
router.post('/offer-client-description', generateOfferClientDescription)

export default router
