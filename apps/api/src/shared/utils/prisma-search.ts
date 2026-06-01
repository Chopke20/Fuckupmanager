import type { Prisma } from '@prisma/client'

/** PostgreSQL: case-insensitive fragment match (ILIKE). */
export function prismaContainsInsensitive(value: string): { contains: string; mode: 'insensitive' } {
  return { contains: value, mode: 'insensitive' }
}

export function equipmentListSearchWhere(term: string): Prisma.EquipmentWhereInput {
  const contains = prismaContainsInsensitive(term)
  return {
    OR: [
      { name: contains },
      { description: contains },
      { internalCode: contains },
      { subcategory: contains },
      { category: contains },
    ],
  }
}
