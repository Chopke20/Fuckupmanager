import { Router } from 'express'
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from './calendar-events.controller'

const router = Router()

router.get('/', getCalendarEvents)
router.post('/', createCalendarEvent)
router.put('/:id', updateCalendarEvent)
router.delete('/:id', deleteCalendarEvent)

export default router
