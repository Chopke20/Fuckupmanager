import { Router } from 'express'
import { postPublicBugReport } from './feedback.controller'
import { createIpRateLimit } from './feedback.public-rate-limit'

const router = Router()

/** 5 zgłoszeń / 10 min na IP (publiczny Spinacz) */
const publicBugLimit = createIpRateLimit(5, 10 * 60 * 1000)

router.post('/bug-report', publicBugLimit, postPublicBugReport)

export default router
