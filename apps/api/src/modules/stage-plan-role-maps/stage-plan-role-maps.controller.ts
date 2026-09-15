import { Request, Response, NextFunction } from 'express'
import {
  BulkUpsertStagePlanRoleMapsSchema,
  UpsertStagePlanRoleMapSchema,
} from '@lama-stage/shared-types'
import { prisma } from '../../prisma/client'

function serializeMap(row: {
  id: string
  roleKey: string
  action: string
  equipmentId: string | null
  attachToRoleKey: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    roleKey: row.roleKey,
    action: row.action,
    equipmentId: row.equipmentId,
    attachToRoleKey: row.attachToRoleKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listStagePlanRoleMaps(_req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.stagePlanRoleMap.findMany({
      orderBy: [{ roleKey: 'asc' }],
    })
    res.json({ data: rows.map(serializeMap) })
  } catch (error) {
    next(error)
  }
}

export async function upsertStagePlanRoleMap(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = UpsertStagePlanRoleMapSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Nieprawidłowe dane mapowania.',
        details: parsed.error.flatten(),
        requestId: res.locals.requestId,
      })
    }
    const data = parsed.data
    if (data.action === 'map' && data.equipmentId) {
      const eq = await prisma.equipment.findFirst({
        where: { id: data.equipmentId, isDeleted: false },
        select: { id: true },
      })
      if (!eq) {
        return res.status(400).json({
          error: 'Nie znaleziono pozycji sprzętu.',
          requestId: res.locals.requestId,
        })
      }
    }

    const row = await prisma.stagePlanRoleMap.upsert({
      where: { roleKey: data.roleKey },
      create: {
        roleKey: data.roleKey,
        action: data.action,
        equipmentId: data.action === 'map' ? data.equipmentId ?? null : null,
        attachToRoleKey: data.action === 'attach' ? data.attachToRoleKey ?? null : null,
      },
      update: {
        action: data.action,
        equipmentId: data.action === 'map' ? data.equipmentId ?? null : null,
        attachToRoleKey: data.action === 'attach' ? data.attachToRoleKey ?? null : null,
      },
    })
    res.json({ data: serializeMap(row) })
  } catch (error) {
    next(error)
  }
}

export async function bulkUpsertStagePlanRoleMaps(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = BulkUpsertStagePlanRoleMapsSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Nieprawidłowe dane mapowania.',
        details: parsed.error.flatten(),
        requestId: res.locals.requestId,
      })
    }

    const equipmentIds = parsed.data.maps
      .filter((item) => item.action === 'map' && item.equipmentId)
      .map((item) => item.equipmentId as string)
    if (equipmentIds.length > 0) {
      const found = await prisma.equipment.findMany({
        where: { id: { in: equipmentIds }, isDeleted: false },
        select: { id: true },
      })
      if (found.length !== new Set(equipmentIds).size) {
        return res.status(400).json({
          error: 'Jedna z pozycji sprzętu nie istnieje.',
          requestId: res.locals.requestId,
        })
      }
    }

    const results = await prisma.$transaction(
      parsed.data.maps.map((data) =>
        prisma.stagePlanRoleMap.upsert({
          where: { roleKey: data.roleKey },
          create: {
            roleKey: data.roleKey,
            action: data.action,
            equipmentId: data.action === 'map' ? data.equipmentId ?? null : null,
            attachToRoleKey: data.action === 'attach' ? data.attachToRoleKey ?? null : null,
          },
          update: {
            action: data.action,
            equipmentId: data.action === 'map' ? data.equipmentId ?? null : null,
            attachToRoleKey: data.action === 'attach' ? data.attachToRoleKey ?? null : null,
          },
        })
      )
    )
    res.json({ data: results.map(serializeMap) })
  } catch (error) {
    next(error)
  }
}

export async function deleteStagePlanRoleMap(req: Request, res: Response, next: NextFunction) {
  try {
    const roleKey = typeof req.params.roleKey === 'string' ? decodeURIComponent(req.params.roleKey) : ''
    if (!roleKey) {
      return res.status(400).json({ error: 'Brak roleKey', requestId: res.locals.requestId })
    }
    await prisma.stagePlanRoleMap.deleteMany({ where: { roleKey } })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}
