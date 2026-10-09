import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../../prisma/client'

const screenSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(100),
  cabinetWidthMm: z.number().positive().max(5000),
  cabinetHeightMm: z.number().positive().max(5000),
  pitchMm: z.number().positive().max(50),
  columns: z.number().int().min(1).max(200),
  rows: z.number().int().min(1).max(200),
  targetRatio: z.number().positive().max(100),
  layoutXM: z.number().min(-500).max(500),
  layoutYM: z.number().min(-500).max(500),
})

const projectPayloadSchema = z.object({
  version: z.literal(1),
  activeScreenId: z.string().min(1),
  screens: z.array(screenSchema).min(1).max(40),
})

function parseProjectJson(raw: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['projectJson'],
        message: 'Nieprawidłowy JSON projektu LED.',
      },
    ])
  }
  const payload = projectPayloadSchema.parse(parsed)
  if (!payload.screens.some((s) => s.id === payload.activeScreenId)) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['activeScreenId'],
        message: 'activeScreenId nie należy do screens.',
      },
    ])
  }
  return JSON.stringify(payload)
}

const projectJsonSchema = z.string().min(2).transform(parseProjectJson)

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  projectJson: projectJsonSchema,
  orderId: z.string().uuid().optional().nullable(),
  offerBlockId: z.string().uuid().optional().nullable(),
})

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  projectJson: projectJsonSchema.optional(),
  orderId: z.string().uuid().nullable().optional(),
})

const upsertForOrderSchema = z.object({
  name: z.string().trim().min(1).max(200),
  projectJson: projectJsonSchema,
  offerBlockId: z.string().uuid().optional().nullable(),
})

function projectSelect() {
  return {
    id: true,
    name: true,
    projectJson: true,
    orderId: true,
    offerBlockId: true,
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

export async function listLedScreenProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 100

    const projects = await prisma.ledScreenProject.findMany({
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

export async function getLedScreenProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const project = await prisma.ledScreenProject.findUnique({
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

export async function createLedScreenProject(req: Request, res: Response, next: NextFunction) {
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
      if (parsed.offerBlockId) {
        const block = await prisma.orderOfferBlock.findFirst({
          where: { id: parsed.offerBlockId, orderId: parsed.orderId },
          select: { id: true },
        })
        if (!block) {
          res.status(404).json({
            error: 'Blok oferty nie istnieje w tym zleceniu.',
            requestId: res.locals.requestId,
          })
          return
        }
      }
      const existing = await prisma.ledScreenProject.findFirst({
        where: { orderId: parsed.orderId, offerBlockId: parsed.offerBlockId ?? null },
        select: { id: true },
      })
      if (existing) {
        res.status(409).json({
          error: 'Ten blok zlecenia ma już przypisany projekt LED.',
          requestId: res.locals.requestId,
        })
        return
      }
    }

    const project = await prisma.ledScreenProject.create({
      data: {
        name: parsed.name,
        projectJson: parsed.projectJson,
        orderId: parsed.orderId ?? null,
        offerBlockId: parsed.offerBlockId ?? null,
      },
      select: projectSelect(),
    })
    res.status(201).json({ data: project })
  } catch (error) {
    next(error)
  }
}

export async function updateLedScreenProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const parsed = updateProjectSchema.parse(req.body)

    const current = await prisma.ledScreenProject.findUnique({
      where: { id },
      select: { id: true },
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
    }

    const project = await prisma.ledScreenProject.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.projectJson !== undefined && { projectJson: parsed.projectJson }),
        ...(parsed.orderId !== undefined && { orderId: parsed.orderId }),
      },
      select: projectSelect(),
    })
    res.json({ data: project })
  } catch (error) {
    next(error)
  }
}

export async function deleteLedScreenProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    await prisma.ledScreenProject.delete({ where: { id } })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

export async function getLedScreenProjectByOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.params
    const offerBlockId =
      typeof req.query.offerBlockId === 'string' && req.query.offerBlockId.trim()
        ? req.query.offerBlockId.trim()
        : null

    const project = await prisma.ledScreenProject.findFirst({
      where: { orderId, offerBlockId },
      select: projectSelect(),
    })
    if (!project) {
      res.status(404).json({ error: 'Brak projektu LED dla tego zlecenia.', requestId: res.locals.requestId })
      return
    }
    res.json({ data: project })
  } catch (error) {
    next(error)
  }
}

export async function upsertLedScreenProjectForOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.params
    const parsed = upsertForOrderSchema.parse(req.body)
    const offerBlockId = parsed.offerBlockId ?? null

    const order = await prisma.order.findFirst({
      where: { id: orderId, isDeleted: false },
      select: { id: true },
    })
    if (!order) {
      res.status(404).json({ error: 'Zlecenie nie istnieje.', requestId: res.locals.requestId })
      return
    }

    if (offerBlockId) {
      const block = await prisma.orderOfferBlock.findFirst({
        where: { id: offerBlockId, orderId },
        select: { id: true },
      })
      if (!block) {
        res.status(404).json({
          error: 'Blok oferty nie istnieje w tym zleceniu.',
          requestId: res.locals.requestId,
        })
        return
      }
    }

    const existing = await prisma.ledScreenProject.findFirst({
      where: { orderId, offerBlockId },
      select: { id: true },
    })

    const project = existing
      ? await prisma.ledScreenProject.update({
          where: { id: existing.id },
          data: {
            name: parsed.name,
            projectJson: parsed.projectJson,
            offerBlockId,
          },
          select: projectSelect(),
        })
      : await prisma.ledScreenProject.create({
          data: {
            name: parsed.name,
            projectJson: parsed.projectJson,
            orderId,
            offerBlockId,
          },
          select: projectSelect(),
        })

    res.json({ data: project })
  } catch (error) {
    next(error)
  }
}
