import { AsyncLocalStorage } from 'node:async_hooks'
import type { PrismaClient } from '@prisma/client'
import { getDefaultCompany } from '../../modules/companies/company-registry'
import { getPrismaForCompany } from '../../prisma/company-prisma'

type CompanyRequestContext = {
  companyCode: string
  prisma: PrismaClient
}

const storage = new AsyncLocalStorage<CompanyRequestContext>()

function normalizeCompanyCode(input: string): string {
  return input.trim().toLowerCase()
}

export function runWithCompanyContext<T>(companyCode: string, fn: () => Promise<T>): Promise<T> {
  const normalized = normalizeCompanyCode(companyCode)
  const prisma = getPrismaForCompany(normalized)
  return storage.run({ companyCode: normalized, prisma }, fn)
}

export function getCurrentCompanyCode(): string {
  const store = storage.getStore()
  if (store?.companyCode) return store.companyCode
  return getDefaultCompany().code
}

export function getCurrentCompanyPrisma(): PrismaClient {
  const store = storage.getStore()
  if (store?.prisma) return store.prisma
  return getPrismaForCompany(getDefaultCompany().code)
}
