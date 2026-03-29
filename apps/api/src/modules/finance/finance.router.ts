import { Router } from 'express'
import { FinanceController } from './finance.controller'

const router = Router()
const controller = new FinanceController()

router.get('/exchange-rate/eur', controller.getEurExchangeRate.bind(controller))
router.get('/transport-pricing', controller.getTransportPricingSettings.bind(controller))
router.put('/transport-pricing', controller.updateTransportPricingSettings.bind(controller))
router.get('/transport-pricing/quote', controller.getTransportQuote.bind(controller))

export default router
