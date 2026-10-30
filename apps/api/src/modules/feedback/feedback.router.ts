import { Router } from 'express'
import { postBugReport } from './feedback.controller'
import { createUserRateLimit } from './feedback.rate-limit'

const router = Router()

/** 5 zgłoszeń / 10 min na użytkownika w firmie */
const bugReportLimit = createUserRateLimit(5, 10 * 60 * 1000)

router.post('/bug-report', bugReportLimit, postBugReport)

export default router
