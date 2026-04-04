import { Request, Response, NextFunction } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { NotFoundError } from '../../shared/errors/AppError'
import { PaginationSchema } from '@lama-stage/shared-types'

/** Nowe kody: sprzęt = EQP-, zasoby = RES- (5 cyfr). Skan uwzględnia legacy SPR-/ZAS- przy wyliczaniu kolejnego numeru. */
const CODE_PREFIX_EQUIPMENT = 'EQP-'
const CODE_PREFIX_RESOURCES = 'RES-'
const LEGACY_PREFIX_EQUIPMENT = 'SPR-'
const LEGACY_PREFIX_RESOURCES = 'ZAS-'
const CODE_NUMBER_PAD = 5

async function getNextInternalCode(category: string): Promise<string> {
  const prefix = category === 'ZASOBY' ? CODE_PREFIX_RESOURCES : CODE_PREFIX_EQUIPMENT
  const legacyPrefix = category === 'ZASOBY' ? LEGACY_PREFIX_RESOURCES : LEGACY_PREFIX_EQUIPMENT
  const list = await prisma.equipment.findMany({
    where: {
      OR: [
        { internalCode: { not: null, startsWith: prefix } },
        { internalCode: { not: null, startsWith: legacyPrefix } },
      ],
    },
    select: { internalCode: true },
  })
  let maxNum = 0
  for (const row of list) {
    const code = row.internalCode
    if (!code) continue
    for (const p of [prefix, legacyPrefix]) {
      if (code.startsWith(p)) {
        const numPart = code.slice(p.length)
        const num = parseInt(numPart, 10)
        if (!Number.isNaN(num) && num > maxNum) maxNum = num
      }
    }
  }
  const next = maxNum + 1
  return `${prefix}${String(next).padStart(CODE_NUMBER_PAD, '0')}`
}

export const getEquipment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, subcategory, search, page: pageQuery, limit: limitQuery, deletedOnly: deletedOnlyQuery } = req.query

    const parsedPagination = PaginationSchema.safeParse({ page: pageQuery, limit: limitQuery });

    if (!parsedPagination.success) {
      return res.status(400).json({ errors: parsedPagination.error.errors });
    }

    const { page, limit } = parsedPagination.data;
    const skip = (page - 1) * limit;

    const deletedOnly = deletedOnlyQuery === 'true' || deletedOnlyQuery === '1';

    const where: Prisma.EquipmentWhereInput = { isDeleted: deletedOnly }
    // ZASOBY są tylko w zakładce Zasoby – w liście sprzętu zawsze wykluczamy
    const excludeZasoby = category !== 'ZASOBY'
    if (category && category !== 'all') {
      where.category = category as string
    } else if (!deletedOnly) {
      where.category = { not: 'ZASOBY' }
    }
    if (subcategory && category === 'ZASOBY') {
      where.subcategory = String(subcategory)
    }
    if (search) {
      const term = String(search).trim()
      where.OR = [
        { name: { contains: term } },
        { description: { contains: term } },
        { internalCode: { contains: term } },
        { subcategory: { contains: term } },
      ]
    }

    const [equipmentRaw, total] = await prisma.$transaction([
      prisma.equipment.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { name: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.equipment.count({ where }),
    ])

    const equipment = excludeZasoby
      ? equipmentRaw.filter((eq: { category: string }) => eq.category !== 'ZASOBY')
      : equipmentRaw
    const lastPage = Math.ceil(total / limit) || 1

    const parsedEquipment = equipment.map((eq) => ({
      ...eq,
      pricingRule: eq.pricingRule && typeof eq.pricingRule === 'string' ? JSON.parse(eq.pricingRule) : eq.pricingRule,
    }))
    res.json({
      data: parsedEquipment,
      meta: {
        total,
        page,
        lastPage,
      },
    })
  } catch (error) {
    next(error)
  }
}

export const getNextCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : 'AUDIO'
    const proposedCode = await getNextInternalCode(category)
    res.json({ proposedCode })
  } catch (error) {
    next(error)
  }
}

export const getEquipmentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const equipment = await prisma.equipment.findUnique({
      where: { id: id },
      include: {
        orderItems: {
          include: {
            order: true,
          },
          take: 10,
        },
        reservations: {
          orderBy: { date: 'asc' },
          take: 20,
        },
      },
    })
    if (!equipment) {
      throw new NotFoundError('Sprzęt')
    }
    // Parse pricingRule string to object
    const parsedEquipment = {
      ...equipment,
      pricingRule: equipment.pricingRule && typeof equipment.pricingRule === 'string' ? JSON.parse(equipment.pricingRule) : equipment.pricingRule,
    }
    res.json(parsedEquipment)
  } catch (error) {
    next(error)
  }
}

export const createEquipment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = { ...req.body }
    if (data.subcategory !== undefined) {
      data.subcategory = typeof data.subcategory === 'string' ? data.subcategory.trim() || null : null
    }
    const codeTrimmed = typeof data.internalCode === 'string' ? data.internalCode.trim() : ''
    if (!codeTrimmed) {
      data.internalCode = await getNextInternalCode(data.category)
    } else {
      data.internalCode = codeTrimmed
    }
    // Serialize pricingRule object to JSON string
    if (data.pricingRule && typeof data.pricingRule === 'object') {
      data.pricingRule = JSON.stringify(data.pricingRule)
    }
    const equipment = await prisma.equipment.create({
      data,
    })
    // Parse pricingRule back to object for response
    if (equipment.pricingRule && typeof equipment.pricingRule === 'string') {
      equipment.pricingRule = JSON.parse(equipment.pricingRule)
    }
    res.status(201).json(equipment)
  } catch (error) {
    next(error)
  }
}

export const updateEquipment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const data = { ...req.body }
    if (data.subcategory !== undefined) {
      data.subcategory = typeof data.subcategory === 'string' ? data.subcategory.trim() || null : null
    }
    if (data.internalCode !== undefined) {
      data.internalCode = typeof data.internalCode === 'string' ? data.internalCode.trim() || null : null
    }
    if (data.pricingRule && typeof data.pricingRule === 'object') {
      data.pricingRule = JSON.stringify(data.pricingRule)
    }
    const equipment = await prisma.equipment.update({
      where: { id: id },
      data,
    })
    if (equipment.pricingRule && typeof equipment.pricingRule === 'string') {
      equipment.pricingRule = JSON.parse(equipment.pricingRule)
    }
    res.json(equipment)
  } catch (error) {
    next(error)
  }
}

export const deleteEquipment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    await prisma.equipment.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    })
    res.json({ success: true, message: 'Pozycja przeniesiona do kosza' })
  } catch (error) {
    next(error)
  }
}

export const restoreEquipment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    await prisma.equipment.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
    })
    res.json({ success: true, message: 'Pozycja przywrócona z kosza' })
  } catch (error) {
    next(error)
  }
}

export const deleteEquipmentPermanent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    await prisma.equipment.delete({ where: { id } })
    res.json({ success: true, message: 'Pozycja usunięta na stałe' })
  } catch (error) {
    next(error)
  }
}

  export const getEquipmentCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.equipment.findMany({
      where: { category: { not: 'ZASOBY' } },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    })
    res.json(categories.map((c: { category: string }) => c.category))
  } catch (error) {
    next(error)
  }
}

export const getEquipmentAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { equipmentId, date } = req.query
    if (!equipmentId || !date) {
      return res.status(400).json({ error: 'Missing equipmentId or date' })
    }
    const parsedDate = new Date(date as string)
    const reservations = await prisma.equipmentReservation.findMany({
      where: {
        equipmentId: equipmentId as string,
        date: parsedDate,
      },
    })
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId as string },
    })
    if (!equipment) {
      throw new NotFoundError('Sprzęt')
    }
    const reservedQuantity = reservations.reduce((sum, r) => sum + r.quantity, 0)
    const available = equipment.stockQuantity - reservedQuantity
    res.json({
      equipmentId,
      date: parsedDate,
      stockQuantity: equipment.stockQuantity,
      reservedQuantity,
      available,
    })
  } catch (error) {
    next(error)
  }
}

export const getResourceSubcategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const subcategories = await prisma.equipment.findMany({
      where: {
        category: 'ZASOBY',
        subcategory: { not: null },
      },
      distinct: ['subcategory'],
      select: { subcategory: true },
      orderBy: { subcategory: 'asc' },
    })
    res.json(
      subcategories
        .map((row: { subcategory: string | null }) => row.subcategory?.trim())
        .filter((value): value is string => Boolean(value))
    )
  } catch (error) {
    next(error)
  }
}

export const clearResourceSubcategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = req.params.name || ''
    const name = decodeURIComponent(raw).trim()
    if (!name) {
      return res.status(400).json({ error: 'Nazwa kategorii jest wymagana' })
    }

    const result = await prisma.equipment.updateMany({
      where: {
        category: 'ZASOBY',
        subcategory: name,
      },
      data: {
        subcategory: null,
      },
    })

    res.json({ updated: result.count })
  } catch (error) {
    next(error)
  }
}

export const renameResourceSubcategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = req.params.name || ''
    const oldName = decodeURIComponent(raw).trim()
    const newName = typeof req.body?.newName === 'string' ? req.body.newName.trim() : ''

    if (!oldName || !newName) {
      return res.status(400).json({ error: 'Nazwa kategorii jest wymagana' })
    }

    const result = await prisma.equipment.updateMany({
      where: {
        category: 'ZASOBY',
        subcategory: oldName,
      },
      data: {
        subcategory: newName,
      },
    })

    res.json({ updated: result.count })
  } catch (error) {
    next(error)
  }
}