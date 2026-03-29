/**
 * Jednorazowy backfill: ustawia orderYear i orderNumber dla zleceń,
 * które jeszcze ich nie mają (np. utworzonych przed wprowadzeniem numeracji).
 * Uruchom: npx ts-node scripts/backfill-order-numbers.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: { orderNumber: null },
    orderBy: [{ createdAt: 'asc' }],
  });

  if (orders.length === 0) {
    console.log('Brak zleceń do backfillu.');
    return;
  }

  // Grupuj po roku (z createdAt)
  const byYear = new Map<number, typeof orders>();
  for (const o of orders) {
    const year = new Date(o.createdAt).getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(o);
  }

  for (const [year, list] of byYear) {
    const seq = await prisma.orderYearSequence.upsert({
      where: { year },
      create: { year, lastNumber: 0 },
      update: {},
    });
    let next = seq.lastNumber + 1;
    for (const order of list) {
      await prisma.order.update({
        where: { id: order.id },
        data: { orderYear: year, orderNumber: next },
      });
      next++;
    }
    await prisma.orderYearSequence.update({
      where: { year },
      data: { lastNumber: next - 1 },
    });
    console.log(`Rok ${year}: ustawiono ${list.length} zleceń (numery ${seq.lastNumber + 1}–${next - 1}).`);
  }
  console.log('Backfill zakończony.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
