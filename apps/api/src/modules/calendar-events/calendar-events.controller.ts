import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../../prisma/client'

const createCalendarEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  allDay: z.boolean().optional(),
})

const updateCalendarEventSchema = createCalendarEventSchema.partial()

export const getCalendarEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined
    const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined

    const where = from && to
      ? {
          OR: [
            { dateFrom: { lte: to }, dateTo: { gte: from } },
          ],
        }
      : undefined

    const events = await prisma.calendarNoteEvent.findMany({
      where,
      orderBy: [{ dateFrom: 'asc' }],
    })
    res.json({ data: events })
  } catch (error) {
    next(error)
  }
}

export const createCalendarEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createCalendarEventSchema.parse(req.body)
    const event = await prisma.calendarNoteEvent.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        dateFrom: new Date(parsed.dateFrom),
        dateTo: new Date(parsed.dateTo),
        allDay: parsed.allDay ?? true,
      },
    })
    res.status(201).json({ data: event })
  } catch (error) {
    next(error)
  }
}

export const updateCalendarEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const parsed = updateCalendarEventSchema.parse(req.body)
    const event = await prisma.calendarNoteEvent.update({
      where: { id },
      data: {
        ...(parsed.title !== undefined && { title: parsed.title }),
        ...(parsed.description !== undefined && { description: parsed.description }),
        ...(parsed.dateFrom !== undefined && { dateFrom: new Date(parsed.dateFrom) }),
        ...(parsed.dateTo !== undefined && { dateTo: new Date(parsed.dateTo) }),
        ...(parsed.allDay !== undefined && { allDay: parsed.allDay }),
      },
    })
    res.json({ data: event })
  } catch (error) {
    next(error)
  }
}

export const deleteCalendarEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    await prisma.calendarNoteEvent.delete({ where: { id } })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
