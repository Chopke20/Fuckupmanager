import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { parseStagePlanJson } from '@lama-stage/shared-types'
import { prisma } from '../../prisma/client'

const planJsonSchema = z.string().min(2).refine(
  (raw) => parseStagePlanJson(raw) !== null,
  { message: 'Nieprawidłowy plan sceny (JSON).' }
)

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  planJson: planJsonSchema,
  orderId: z.string().uuid().optional().nullable(),
})

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  planJson: planJsonSchema.optional(),
  orderId: z.string().uuid().nullable().optional(),
})

const upsertForOrderSchema = z.object({
  name: z.string().trim().min(1).max(200),
  planJson: planJsonSchema,
})

function projectSelect() {
  return {
    id: true,
    name: true,
    planJson: true,
    orderId: true,
    createdAt: true,
    updatedAt: true,
    order: {
      select: {
        id: true,
        name: true,
        orderYear: true,
        orderNumber: true,
      },
    },
  } as const
}

export async function listStagePlanProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 100

    const projects = await prisma.stagePlanProject.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { order: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
      select: projectSelect(),
    })
    res.json({ data: projects })
  } catch (error) {
    next(error)
  }
}

export async function getStagePlanProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const project = await prisma.stagePlanProject.findUnique({
      where: { id },
      select: projectSelect(),
    })
    if (!project) {
      res.status(404).json({ error: 'Projekt nie istnieje.', requestId: res.locals.requestId })
      return
    }
    res.json({ data: project })
  } catch (error) {
    next(error)
  }
}

export async function createStagePlanProject(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createProjectSchema.parse(req.body)
    if (parsed.orderId) {
      const order = await prisma.order.findFirst({
        where: { id: parsed.orderId, isDeleted: false },
        select: { id: true },
      })
      if (!order) {
        res.status(404).json({ error: 'Zlecenie nie istnieje.', requestId: res.locals.requestId })
        return
      }
      const existing = await prisma.stagePlanProject.findUnique({
        where: { orderId: parsed.orderId },
        select: { id: true },
      })
      if (existing) {
        res.status(409).json({
          error: 'To zlecenie ma już przypisany projekt sceny.',
          requestId: res.locals.requestId,
        })
        return
      }
    }

    const project = await prisma.stagePlanProject.create({
      data: {
        name: parsed.name,
        planJson: parsed.planJson,
        orderId: parsed.orderId ?? null,
      },
      select: projectSelect(),
    })
    res.status(201).json({ data: project })
  } catch (error) {
    next(error)
  }
}

export async function updateStagePlanProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const parsed = updateProjectSchema.parse(req.body)

    const current = await prisma.stagePlanProject.findUnique({
      where: { id },
      select: { id: true, orderId: true },
    })
    if (!current) {
      res.status(404).json({ error: 'Projekt nie istnieje.', requestId: res.locals.requestId })
      return
    }

    if (parsed.orderId !== undefined && parsed.orderId !== null) {
      const order = await prisma.order.findFirst({
        where: { id: parsed.orderId, isDeleted: false },
        select: { id: true },
      })
      if (!order) {
        res.status(404).json({ error: 'Zlecenie nie istnieje.', requestId: res.locals.requestId })
        return
      }
      const conflict = await prisma.stagePlanProject.findFirst({
        where: { orderId: parsed.orderId, NOT: { id } },
        select: { id: true },
      })
      if (conflict) {
        res.status(409).json({
          error: 'To zlecenie ma już przypisany projekt sceny.',
          requestId: res.locals.requestId,
        })
        return
      }
    }

    const project = await prisma.stagePlanProject.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.planJson !== undefined && { planJson: parsed.planJson }),
        ...(parsed.orderId !== undefined && { orderId: parsed.orderId }),
      },
      select: projectSelect(),
    })
    res.json({ data: project })
  } catch (error) {
    next(error)
  }
}

export async function deleteStagePlanProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    await prisma.stagePlanProject.delete({ where: { id } })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

export async function upsertStagePlanProjectForOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.params
    const parsed = upsertForOrderSchema.parse(req.body)

    const order = await prisma.order.findFirst({
      where: { id: orderId, isDeleted: false },
      select: { id: true },
    })
    if (!order) {
      res.status(404).json({ error: 'Zlecenie nie istnieje.', requestId: res.locals.requestId })
      return
    }

    const existing = await prisma.stagePlanProject.findUnique({
      where: { orderId },
      select: { id: true },
    })

    const project = existing
      ? await prisma.stagePlanProject.update({
          where: { id: existing.id },
          data: { name: parsed.name, planJson: parsed.planJson },
          select: projectSelect(),
        })
      : await prisma.stagePlanProject.create({
          data: {
            name: parsed.name,
            planJson: parsed.planJson,
            orderId,
          },
          select: projectSelect(),
        })

    res.json({ data: project })
  } catch (error) {
    next(error)
  }
}
