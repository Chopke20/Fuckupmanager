/**
 * Jednorazowa migracja starych formatów na nowe (bez zmiany schematu Prisma):
 * - Sprzęt: SPR-* → EQP-*, ZAS-* → RES-* (kolizje → następny wolny numer w sekwencji)
 * - Eksporty dokumentów: 16.3.2026, PRO-…, MAG-…, BRF-… → OFR/PRP/WHS/BRF-YY-NNNN-v#
 * - JSON snapshot (pole documentNumber tam, gdzie występuje)
 * - Order.offerNumber / offerVersion — przeliczenie z eksportów OFFER
 *
 * Uruchom z katalogu apps/api:
 *   npx ts-node scripts/migrate-legacy-codes.ts
 * Na próbę (bez zapisu):
 *   MIGRATE_DRY_RUN=1 npx ts-node scripts/migrate-legacy-codes.ts
 */
import { PrismaClient } from '@prisma/client'
import { buildDocumentNumber } from '@lama-stage/shared-types'
import type { DocumentType } from '@lama-stage/shared-types'

const prisma = new PrismaClient()
const DRY = process.env.MIGRATE_DRY_RUN === '1' || process.env.MIGRATE_DRY_RUN === 'true'
const PAD = 5

function isNewDocumentNumber(s: string): boolean {
  return /^(OFR|PRP|WHS|BRF)-\d{2}-\d{4}-v\d+$/i.test(s.trim())
}

function parseLegacyDocumentNumber(
  documentType: DocumentType,
  documentNumber: string
): { orderNum: number; version: number; year: number } | null {
  const s = documentNumber.trim()
  if (isNewDocumentNumber(s)) return null

  if (documentType === 'OFFER') {
    const m = /^(\d+)\.(\d+)\.(\d{4})$/.exec(s)
    if (!m) return null
    return { orderNum: +m[1]!, version: +m[2]!, year: +m[3]! }
  }
  if (documentType === 'PROPOSAL') {
    const m = /^PRO-(\d+)\.(\d+)\.(\d{4})$/.exec(s)
    if (!m) return null
    return { orderNum: +m[1]!, version: +m[2]!, year: +m[3]! }
  }
  if (documentType === 'WAREHOUSE') {
    const m = /^MAG-(\d+)\.(\d+)\.(\d{4})$/.exec(s)
    if (!m) return null
    return { orderNum: +m[1]!, version: +m[2]!, year: +m[3]! }
  }
  if (documentType === 'BRIEF') {
    const m = /^BRF-(\d+)\.(\d+)\.(\d{4})$/.exec(s)
    if (!m) return null
    return { orderNum: +m[1]!, version: +m[2]!, year: +m[3]! }
  }
  return null
}

function parseOfferVersionFromDocumentNumber(documentNumber: string): number {
  const mNew = /^OFR-\d{2}-\d{4}-v(\d+)$/i.exec(documentNumber.trim())
  if (mNew) {
    const v = parseInt(mNew[1]!, 10)
    return Number.isNaN(v) ? 0 : v
  }
  const parts = documentNumber.split('.')
  if (parts.length >= 3) {
    const v = parseInt(parts[1]!, 10)
    return Number.isNaN(v) ? 0 : v
  }
  return 0
}

function patchSnapshotDocumentNumber(snapshot: string, oldNum: string, newNum: string): string {
  if (oldNum === newNum) return snapshot
  try {
    const o = JSON.parse(snapshot) as Record<string, unknown>
    if (typeof o.documentNumber === 'string' && o.documentNumber === oldNum) {
      o.documentNumber = newNum
    }
    return JSON.stringify(o)
  } catch {
    return snapshot
  }
}

async function migrateEquipmentCodes(): Promise<void> {
  const rows = await prisma.equipment.findMany({
    where: {
      OR: [{ internalCode: { startsWith: 'SPR-' } }, { internalCode: { startsWith: 'ZAS-' } }],
    },
    select: { id: true, internalCode: true },
  })
  if (rows.length === 0) {
    console.log('Sprzęt: brak kodów SPR-/ZAS- do migracji.')
    return
  }

  const plan = rows
    .filter((r): r is typeof r & { internalCode: string } => Boolean(r.internalCode))
    .map((r) => ({
      id: r.id,
      oldCode: r.internalCode,
      /** Tylko prefiks ZAS- → RES; SPR- → EQP (niezależnie od kategorii). */
      useRes: r.internalCode.startsWith('ZAS-'),
    }))

  const others = await prisma.equipment.findMany({
    where: {
      id: { notIn: plan.map((p) => p.id) },
      internalCode: { not: null },
    },
    select: { internalCode: true },
  })

  const usedEqp = new Set<number>()
  const usedRes = new Set<number>()
  for (const { internalCode: c } of others) {
    if (!c) continue
    if (c.startsWith('EQP-')) {
      const n = parseInt(c.slice(4), 10)
      if (!Number.isNaN(n)) usedEqp.add(n)
    }
    if (c.startsWith('RES-')) {
      const n = parseInt(c.slice(4), 10)
      if (!Number.isNaN(n)) usedRes.add(n)
    }
  }

  function nextFree(used: Set<number>, preferred: number): number {
    let n = Math.max(1, preferred)
    while (used.has(n)) n++
    used.add(n)
    return n
  }

  const assignments = new Map<string, string>()
  for (const p of plan) {
    const prefix = p.useRes ? 'ZAS-' : 'SPR-'
    const raw = parseInt(p.oldCode.slice(prefix.length), 10)
    const preferred = Number.isNaN(raw) ? 1 : raw
    if (p.useRes) {
      const n = nextFree(usedRes, preferred)
      assignments.set(p.id, `RES-${String(n).padStart(PAD, '0')}`)
    } else {
      const n = nextFree(usedEqp, preferred)
      assignments.set(p.id, `EQP-${String(n).padStart(PAD, '0')}`)
    }
  }

  console.log(`Sprzęt: migracja ${plan.length} rekordów SPR-/ZAS- → EQP-/RES-`)

  if (DRY) {
    for (const p of plan) {
      console.log(`  [dry-run] ${p.oldCode} → ${assignments.get(p.id)}`)
    }
    return
  }

  for (const p of plan) {
    await prisma.equipment.update({
      where: { id: p.id },
      data: { internalCode: `__MIG__${p.id.replace(/-/g, '')}` },
    })
  }
  for (const p of plan) {
    await prisma.equipment.update({
      where: { id: p.id },
      data: { internalCode: assignments.get(p.id)! },
    })
  }
  console.log('Sprzęt: zakończono.')
}

async function migrateDocumentExports(): Promise<void> {
  const exports = await prisma.orderDocumentExport.findMany({
    orderBy: [{ orderId: 'asc' }, { exportedAt: 'asc' }],
    include: {
      order: { select: { id: true, orderNumber: true, orderYear: true } },
    },
  })

  let updated = 0
  let skipped = 0
  let warned = 0

  for (const exp of exports) {
    const oldNum = exp.documentNumber
    if (isNewDocumentNumber(oldNum)) {
      skipped++
      continue
    }

    const dt = exp.documentType as DocumentType
    if (!['OFFER', 'PROPOSAL', 'WAREHOUSE', 'BRIEF'].includes(dt)) {
      console.warn(`  Nieznany typ dokumentu: ${exp.documentType} (${exp.id})`)
      warned++
      continue
    }

    const parsed = parseLegacyDocumentNumber(dt, oldNum)
    if (!parsed) {
      console.warn(`  Nie rozpoznano numeru dokumentu: "${oldNum}" (${exp.id}, ${dt})`)
      warned++
      continue
    }

    const order = exp.order
    const orderNumber = order.orderNumber ?? parsed.orderNum
    const orderYear = order.orderYear ?? parsed.year
    if (orderNumber == null || orderYear == null || orderNumber < 1) {
      console.warn(`  Zlecenie ${order.id} bez orderNumber/orderYear — pomijam eksport ${exp.id}`)
      warned++
      continue
    }

    const newNum = buildDocumentNumber({
      documentType: dt,
      orderNumber,
      orderYear,
      version: parsed.version,
    })

    if (newNum === oldNum) {
      skipped++
      continue
    }

    const newSnapshot = patchSnapshotDocumentNumber(exp.snapshot, oldNum, newNum)

    if (DRY) {
      console.log(`  [dry-run] ${dt} ${oldNum} → ${newNum}`)
      updated++
      continue
    }

    try {
      await prisma.orderDocumentExport.update({
        where: { id: exp.id },
        data: { documentNumber: newNum, snapshot: newSnapshot },
      })
      updated++
    } catch (e) {
      console.error(`  Błąd aktualizacji eksportu ${exp.id}:`, e)
      warned++
    }
  }

  console.log(
    `Dokumenty: zaktualizowano ${updated}, pominięto (już nowy format) ${skipped}, ostrzeżenia ${warned}${DRY ? ' (dry-run)' : ''}.`
  )
}

async function syncAllOrderOfferMeta(): Promise<void> {
  const orderIds = await prisma.orderDocumentExport.findMany({
    where: { documentType: 'OFFER' },
    distinct: ['orderId'],
    select: { orderId: true },
  })

  if (DRY) {
    console.log(
      `Zlecenia: w dry-run pominięto synchronizację offerNumber (${orderIds.length} zleceń z eksportami OFFER).`
    )
    return
  }

  for (const { orderId } of orderIds) {
    const remaining = await prisma.orderDocumentExport.findMany({
      where: { orderId, documentType: 'OFFER' },
      orderBy: { exportedAt: 'desc' },
    })

    if (remaining.length === 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: { offerVersion: 0, offerNumber: null },
      })
      continue
    }

    let maxVersion = 0
    let documentNumberForMax: string | null = null
    for (const e of remaining) {
      const v = parseOfferVersionFromDocumentNumber(e.documentNumber)
      if (v > 0 && v >= maxVersion) {
        maxVersion = v
        documentNumberForMax = e.documentNumber
      }
    }

    if (maxVersion > 0 && documentNumberForMax) {
      await prisma.order.update({
        where: { id: orderId },
        data: { offerVersion: maxVersion, offerNumber: documentNumberForMax },
      })
    } else {
      const latest = remaining[0]!
      await prisma.order.update({
        where: { id: orderId },
        data: {
          offerVersion: remaining.length,
          offerNumber: latest.documentNumber,
        },
      })
    }
  }

  console.log(`Zlecenia: zsynchronizowano offerNumber/offerVersion dla ${orderIds.length} zleceń z eksportami OFFER.`)
}

async function main() {
  console.log(DRY ? '--- MIGRATE (DRY RUN — brak zapisu) ---' : '--- MIGRATE (zapis do bazy) ---')
  await migrateEquipmentCodes()
  await migrateDocumentExports()
  await syncAllOrderOfferMeta()
  console.log('Gotowe.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
