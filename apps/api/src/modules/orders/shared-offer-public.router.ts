import { Router } from 'express'
import {
  getSharedOffer,
  putSharedOfferLines,
  postSharedOfferPdf,
} from './shared-offer-public.controller'

const router = Router()

router.get('/:token', getSharedOffer)
router.put('/:token', putSharedOfferLines)
router.post('/:token/pdf', postSharedOfferPdf)

export default router
