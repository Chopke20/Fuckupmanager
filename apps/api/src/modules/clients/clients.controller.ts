import { Request, Response, NextFunction } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { NotFoundError } from '../../shared/errors/AppError'
import { PaginationSchema } from '@lama-stage/shared-types'

export const getClients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page: pageQuery, limit: limitQuery, search: searchQuery, deletedOnly: deletedOnlyQuery } = req.query;

    const parsedPagination = PaginationSchema.safeParse({ page: pageQuery, limit: limitQuery });

    if (!parsedPagination.success) {
      return res.status(400).json({ errors: parsedPagination.error.errors });
    }

    const { page, limit } = parsedPagination.data;
    const skip = (page - 1) * limit;

    const deletedOnly = deletedOnlyQuery === 'true' || deletedOnlyQuery === '1';

    const term = typeof searchQuery === 'string' ? searchQuery.trim() : '';
    const where: Prisma.ClientWhereInput = deletedOnly ? { isDeleted: true } : { isDeleted: false }
    if (term) {
      where.OR = [
        { companyName: { contains: term } },
        { contactName: { contains: term } },
        { email: { contains: term } },
        { phone: { contains: term } },
        { nip: { contains: term } },
        { address: { contains: term } },
      ];
    }

    const [clients, total] = await prisma.$transaction([
      prisma.client.findMany({
        where,
        orderBy: { companyName: 'asc' },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    const lastPage = Math.ceil(total / limit);

    res.json({
      data: clients,
      meta: {
        total,
        page,
        lastPage,
      },
    });
  } catch (error) {
    next(error)
  }
}

export const getClientById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const client = await prisma.client.findFirst({
      where: { id: id },
      include: {
        orders: {
          orderBy: { dateFrom: 'desc' },
          take: 10,
        },
      },
    })
    if (!client) {
      throw new NotFoundError('Klient')
    }
    res.json({ data: client })
  } catch (error) {
    next(error)
  }
}

function toOpt(value: unknown): string | null | undefined {
  if (value == null) return undefined
  const s = typeof value === 'string' ? value.trim() : String(value).trim()
  return s === '' ? null : s
}

export const createClient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : ''
    if (!companyName) {
      return res.status(400).json({ message: 'Nazwa firmy jest wymagana.' })
    }
    const data = {
      companyName,
      contactName: toOpt(body.contactName),
      address: toOpt(body.address),
      nip: toOpt(body.nip),
      email: toOpt(body.email),
      phone: toOpt(body.phone),
      notes: toOpt(body.notes),
    }
    const client = await prisma.client.create({ data })
    res.status(201).json({ data: client })
  } catch (error) {
    next(error)
  }
}

export const updateClient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const client = await prisma.client.update({
      where: { id: id },
      data: req.body,
    })
    res.json({ data: client })
  } catch (error) {
    next(error)
  }
}

export const deleteClient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    await prisma.client.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    })
    res.json({ success: true, message: 'Klient przeniesiony do kosza' })
  } catch (error) {
    next(error)
  }
}

export const restoreClient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    await prisma.client.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
    })
    res.json({ success: true, message: 'Klient przywrócony z kosza' })
  } catch (error) {
    next(error)
  }
}

export const deleteClientPermanent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    await prisma.client.delete({ where: { id } })
    res.json({ success: true, message: 'Klient usunięty na stałe' })
  } catch (error) {
    next(error)
  }
}
