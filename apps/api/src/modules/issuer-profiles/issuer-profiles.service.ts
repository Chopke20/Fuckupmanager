import type { PrismaClient } from '@prisma/client'
import {
  CreateIssuerProfileSchema,
  PaginationSchema,
  UpdateIssuerProfileSchema,
  type IssuerProfilePublic,
} from '@lama-stage/shared-types'
import { AppError } from '../../shared/errors/AppError'
import { prisma } from '../../prisma/client'

function toPublic(row: {
  id: string
  profileKey: string
  companyName: string
  address: string
  nip: string
  email: string
  phone: string | null
  sortOrder: number
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}): IssuerProfilePublic {
  return {
    id: row.id,
    profileKey: row.profileKey,
    companyName: row.companyName,
    address: row.address,
    nip: row.nip,
    email: row.email,
    phone: row.phone ?? undefined,
    isDefault: row.isDefault,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function generateProfileKey(): string {
  const c =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now().toString(36)}`
  return `custom_${c}`
}

export async function listIssuerProfiles(query: Record<string, unknown>) {
  const parsed = PaginationSchema.safeParse({
    page: query.page,
    limit: query.limit,
  })
  if (!parsed.success) {
    throw new AppError('Nieprawidłowe parametry paginacji', 400, 'VALIDATION_ERROR')
  }
  const { page, limit } = parsed.data
  const skip = (page - 1) * limit
  const searchRaw = typeof query.search === 'string' ? query.search.trim() : ''
  const where =
    searchRaw.length > 0
      ? {
          OR: [
            { companyName: { contains: searchRaw } },
            { profileKey: { contains: searchRaw } },
            { nip: { contains: searchRaw } },
            { email: { contains: searchRaw } },
          ],
        }
      : {}

  const [rows, total] = await prisma.$transaction([
    prisma.issuerProfile.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { companyName: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.issuerProfile.count({ where }),
  ])

  const lastPage = Math.ceil(total / limit) || 1
  return {
    data: rows.map(toPublic),
    meta: { total, page, lastPage },
  }
}

export async function getIssuerProfileById(id: string): Promise<IssuerProfilePublic> {
  const row = await prisma.issuerProfile.findUnique({ where: { id } })
  if (!row) throw new AppError('Profil nie znaleziony', 404, 'NOT_FOUND')
  return toPublic(row)
}

export async function getDefaultIssuerProfile(db: Pick<PrismaClient, 'issuerProfile'> = prisma): Promise<IssuerProfilePublic | null> {
  const row =
    (await db.issuerProfile.findFirst({ where: { isDefault: true }, orderBy: { sortOrder: 'asc' } })) ??
    (await db.issuerProfile.findFirst({ orderBy: { sortOrder: 'asc' } }))
  return row ? toPublic(row) : null
}

export async function createIssuerProfile(body: unknown) {
  const parsed = CreateIssuerProfileSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError('Nieprawidłowe dane profilu', 400, 'VALIDATION_ERROR')
  }
  const data = parsed.data
  const profileKey = (data.profileKey?.trim() || generateProfileKey()).trim()

  const existingKey = await prisma.issuerProfile.findUnique({ where: { profileKey } })
  if (existingKey) {
    throw new AppError('Profil o tym kluczu już istnieje', 400, 'DUPLICATE_KEY')
  }

  const count = await prisma.issuerProfile.count()
  const maxSort = await prisma.issuerProfile.aggregate({ _max: { sortOrder: true } })
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1
  const isDefault = count === 0

  const row = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.issuerProfile.updateMany({ data: { isDefault: false } })
    }
    return tx.issuerProfile.create({
      data: {
        profileKey,
        companyName: data.companyName.trim(),
        address: data.address.trim(),
        nip: data.nip.trim(),
        email: data.email.trim(),
        phone: data.phone?.trim() || null,
        sortOrder,
        isDefault,
      },
    })
  })

  return toPublic(row)
}

export async function updateIssuerProfile(id: string, body: unknown) {
  const parsed = UpdateIssuerProfileSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError('Nieprawidłowe dane profilu', 400, 'VALIDATION_ERROR')
  }
  const data = parsed.data
  if (Object.keys(data).length === 0) {
    throw new AppError('Brak pól do aktualizacji', 400, 'VALIDATION_ERROR')
  }

  const existing = await prisma.issuerProfile.findUnique({ where: { id } })
  if (!existing) throw new AppError('Profil nie znaleziony', 404, 'NOT_FOUND')

  const row = await prisma.issuerProfile.update({
    where: { id },
    data: {
      ...(data.companyName !== undefined ? { companyName: data.companyName.trim() } : {}),
      ...(data.address !== undefined ? { address: data.address.trim() } : {}),
      ...(data.nip !== undefined ? { nip: data.nip.trim() } : {}),
      ...(data.email !== undefined ? { email: data.email.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
    },
  })

  return toPublic(row)
}

export async function setDefaultIssuerProfile(id: string) {
  const existing = await prisma.issuerProfile.findUnique({ where: { id } })
  if (!existing) throw new AppError('Profil nie znaleziony', 404, 'NOT_FOUND')

  await prisma.$transaction([
    prisma.issuerProfile.updateMany({ data: { isDefault: false } }),
    prisma.issuerProfile.update({ where: { id }, data: { isDefault: true } }),
  ])

  return getIssuerProfileById(id)
}

export async function deleteIssuerProfile(id: string) {
  const existing = await prisma.issuerProfile.findUnique({ where: { id } })
  if (!existing) throw new AppError('Profil nie znaleziony', 404, 'NOT_FOUND')

  const count = await prisma.issuerProfile.count()
  if (count <= 1) {
    throw new AppError('Musi pozostać co najmniej jeden profil firmy', 400, 'LAST_PROFILE')
  }

  await prisma.$transaction(async (tx) => {
    await tx.issuerProfile.delete({ where: { id } })
    if (existing.isDefault) {
      const next = await tx.issuerProfile.findFirst({
        orderBy: [{ sortOrder: 'asc' }, { companyName: 'asc' }],
      })
      if (next) {
        await tx.issuerProfile.updateMany({ data: { isDefault: false } })
        await tx.issuerProfile.update({ where: { id: next.id }, data: { isDefault: true } })
      }
    }
  })

  return { success: true as const }
}
