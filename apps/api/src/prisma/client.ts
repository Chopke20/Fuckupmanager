import { PrismaClient } from '@prisma/client'
import { getCurrentCompanyPrisma } from '../shared/context/company-context'

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getCurrentCompanyPrisma() as unknown as Record<PropertyKey, unknown>
    const value = client[prop]
    if (typeof value === 'function') {
      return (value as Function).bind(client)
    }
    return value
  },
}) as PrismaClient