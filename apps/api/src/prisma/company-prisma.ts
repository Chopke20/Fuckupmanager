import { PrismaClient } from '@prisma/client'
import { getCompanyDatabaseUrl, getCompanyRegistry } from '../modules/companies/company-registry'

const clientMap = new Map<string, PrismaClient>()

function createClient(companyCode: string): PrismaClient {
  const datasourceUrl = getCompanyDatabaseUrl(companyCode)
  return new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export function getPrismaForCompany(companyCode: string): PrismaClient {
  const cached = clientMap.get(companyCode)
  if (cached) return cached
  const created = createClient(companyCode)
  clientMap.set(companyCode, created)
  return created
}

export async function connectDefaultCompanyPrisma(): Promise<void> {
  const defaultCompany = getCompanyRegistry().find((row) => row.isDefault) ?? getCompanyRegistry()[0]
  if (!defaultCompany) return
  await getPrismaForCompany(defaultCompany.code).$connect()
}

export async function disconnectAllPrismaClients(): Promise<void> {
  const all = Array.from(clientMap.values())
  await Promise.all(all.map((client) => client.$disconnect().catch(() => undefined)))
}
