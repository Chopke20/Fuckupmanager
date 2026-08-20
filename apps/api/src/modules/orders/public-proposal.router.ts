import { Router } from 'express'
import {
  getPublicProposal,
  postPublicProposalEvent,
  postPublicProposalSignals,
  getPublicProposalPdf,
} from './public-proposal.controller'

const router = Router()

router.get('/:token', getPublicProposal)
router.post('/:token/events', postPublicProposalEvent)
router.post('/:token/signals', postPublicProposalSignals)
router.get('/:token/pdf', getPublicProposalPdf)

export default router
