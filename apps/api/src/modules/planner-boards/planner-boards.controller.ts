import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../../prisma/client'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const blockSectionSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().max(120).default(''),
  text: z.string().max(4000),
  color: z.string().max(32).optional(),
})

const blockSchema = z.object({
  id: z.string().min(1).max(80),
  dayOffset: z.number().int().min(0).max(13),
  startMin: z.number().int().min(0).max(24 * 60),
  endMin: z.number().int().min(0).max(24 * 60),
  title: z.string().trim().min(1).max(120),
  body: z.string().max(2000).optional(),
  sections: z.array(blockSectionSchema).max(40).default([]),
  color: z.string().max(32).optional(),
  orderId: z.string().uuid().optional(),
  orderLabel: z.string().max(120).optional(),
})

const noteSchema = z.object({
  id: z.string().min(1).max(80),
  y: z.number().min(0).max(100000),
  title: z.string().max(120).optional(),
  body: z.string().max(4000),
  color: z.string().max(32).optional(),
})

export const boardPayloadSchema = z
  .object({
    version: z.literal(1),
    range: z.object({
      startDate: z.string().regex(ISO_DATE),
      dayCount: z.number().int().min(1).max(14),
    }),
    time: z.object({
      startHour: z.number().int().min(0).max(23),
      endHour: z.number().int().min(1).max(24),
      snapMinutes: z.union([z.literal(5), z.literal(15), z.literal(30)]),
    }),
    blocks: z.array(blockSchema).max(500),
    notes: z.array(noteSchema).max(200),
  })
  .superRefine((val, ctx) => {
    if (val.time.endHour <= val.time.startHour) {
      ctx.addIssue({
        code: 'custom',
        path: ['time', 'endHour'],
        message: 'endHour musi być większe od startHour.',
      })
    }
    for (let i = 0; i < val.blocks.length; i++) {
      const b = val.blocks[i]
      if (!b) continue
      if (b.endMin <= b.startMin) {
        ctx.addIssue({
          code: 'custom',
          path: ['blocks', i, 'endMin'],
          message: 'endMin musi być większe od startMin.',
        })
      }
      if (b.dayOffset >= val.range.dayCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['blocks', i, 'dayOffset'],
          message: 'dayOffset poza zakresem dayCount.',
        })
      }
    }
  })

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Stare przypięcie na sekcji → na blok (przed Zod strip). */
function liftSectionOrdersToBlocks(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.blocks)) return raw
  return {
    ...obj,
    blocks: obj.blocks.map((item) => {
      if (!item || typeof item !== 'object') return item
      const b = item as Record<string, unknown>
      if (typeof b.orderId === 'string' && UUID_RE.test(b.orderId)) return b
      if (!Array.isArray(b.sections)) return b
      for (const sec of b.sections) {
        if (!sec || typeof sec !== 'object') continue
        const s = sec as Record<string, unknown>
        if (typeof s.orderId === 'string' && UUID_RE.test(s.orderId)) {
          return {
            ...b,
            orderId: s.orderId,
            ...(typeof s.orderLabel === 'string' && s.orderLabel.trim()
              ? { orderLabel: s.orderLabel.trim().slice(0, 120) }
              : {}),
          }
        }
      }
      return b
    }),
  }
}

function parseBoardJson(raw: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['boardJson'],
        message: 'Nieprawidłowy JSON tablicy planera.',
      },
    ])
  }
  const payload = boardPayloadSchema.parse(liftSectionOrdersToBlocks(parsed))
  return JSON.stringify(payload)
}

const boardJsonSchema = z.string().min(2).transform(parseBoardJson)

const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(200),
  boardJson: boardJsonSchema,
})

const updateBoardSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  boardJson: boardJsonSchema.optional(),
})

function boardSelect() {
  return {
    id: true,
    name: true,
    boardJson: true,
    createdAt: true,
    updatedAt: true,
  } as const
}

export async function listPlannerBoards(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 100

    const boards = await prisma.plannerBoard.findMany({
      where: search
        ? {
            name: { contains: search, mode: 'insensitive' },
          }
        : undefined,
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
      select: boardSelect(),
    })
    res.json({ data: boards })
  } catch (error) {
    next(error)
  }
}

export async function getPlannerBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const board = await prisma.plannerBoard.findUnique({
      where: { id },
      select: boardSelect(),
    })
    if (!board) {
      res.status(404).json({ error: 'Tablica nie istnieje.', requestId: res.locals.requestId })
      return
    }
    res.json({ data: board })
  } catch (error) {
    next(error)
  }
}

export async function createPlannerBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createBoardSchema.parse(req.body)
    const board = await prisma.plannerBoard.create({
      data: {
        name: parsed.name,
        boardJson: parsed.boardJson,
      },
      select: boardSelect(),
    })
    res.status(201).json({ data: board })
  } catch (error) {
    next(error)
  }
}

export async function updatePlannerBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const parsed = updateBoardSchema.parse(req.body)

    const current = await prisma.plannerBoard.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!current) {
      res.status(404).json({ error: 'Tablica nie istnieje.', requestId: res.locals.requestId })
      return
    }

    const board = await prisma.plannerBoard.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.boardJson !== undefined && { boardJson: parsed.boardJson }),
      },
      select: boardSelect(),
    })
    res.json({ data: board })
  } catch (error) {
    next(error)
  }
}

export async function deletePlannerBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    await prisma.plannerBoard.delete({ where: { id } })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
