/**
 * Przypisuje unikalne kody SPR-00001, ZAS-00001 wszystkim rekordom w equipment.
 * Uruchom przed `prisma db push` po dodaniu @unique na internalCode, jeśli w bazie są duplikaty.
 * np. npx ts-node scripts/normalize-internal-codes.ts (z katalogu apps/api)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PREFIX_EQUIPMENT = 'SPR-'
const PREFIX_RESOURCES = 'ZAS-'
const PAD = 5

async function main() {
  const equipment = await prisma.equipment.findMany({
    where: { category: { not: 'ZASOBY' } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })
  let idx = 1
  for (const eq of equipment) {
    await prisma.equipment.update({
      where: { id: eq.id },
      data: { internalCode: `${PREFIX_EQUIPMENT}${String(idx).padStart(PAD, '0')}` },
    })
    idx += 1
  }
  console.log(`Przypisano ${equipment.length} kodów SPR-*`)

  const resources = await prisma.equipment.findMany({
    where: { category: 'ZASOBY' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })
  idx = 1
  for (const res of resources) {
    await prisma.equipment.update({
      where: { id: res.id },
      data: { internalCode: `${PREFIX_RESOURCES}${String(idx).padStart(PAD, '0')}` },
    })
    idx += 1
  }
  console.log(`Przypisano ${resources.length} kodów ZAS-*`)
  console.log('Kody znormalizowane. Możesz uruchomić: npx prisma db push')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
