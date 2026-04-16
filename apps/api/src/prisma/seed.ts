import { PrismaClient, type Prisma } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import csv from 'csv-parser'
import { hashPassword } from '../modules/auth/auth.crypto'
import { ROLE_PERMISSION_MAP } from '@lama-stage/shared-types'

const prisma = new PrismaClient()

const DATA_DIR = path.resolve(__dirname, '..', '..', 'prisma', 'data')

async function seedClients() {
  const filePath = path.join(DATA_DIR, 'klienci.csv')
  if (!fs.existsSync(filePath)) {
    console.log('Plik CSV klientów (prisma/data/klienci.csv) nie znaleziony, pomijam seed.')
    return
  }

  const clients: Prisma.ClientCreateInput[] = []
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (row: Record<string, string | undefined>) => {
        const companyName = row['Nazwa Firmy/Instytucji']?.trim()
        const contactName = row['Imię i Nazwisko']?.trim()
        const address = row['Adres']?.trim()
        const phone = row['Telefon']?.trim()
        const email = row['Email']?.trim()

        if (companyName || contactName) {
          clients.push({
            companyName: companyName || `Klient ${contactName || 'bez nazwy'}`,
            contactName: contactName || null,
            address: address || null,
            phone: phone || null,
            email: email || null,
          })
        }
      })
      .on('end', resolve)
      .on('error', reject)
  })

  console.log(`Znaleziono ${clients.length} klientów w CSV`)

  for (const client of clients) {
    await prisma.client.upsert({
      where: { companyName: client.companyName },
      update: client,
      create: client,
    })
  }

  console.log('✅ Klienci zaseedowani')
}

async function seedUsers() {
  await prisma.roleDefinition.upsert({
    where: { roleKey: 'ADMIN' },
    update: {
      displayName: 'Administrator',
      description: 'Pełne uprawnienia systemowe',
      permissionsJson: JSON.stringify(ROLE_PERMISSION_MAP.ADMIN),
      isSystem: true,
    },
    create: {
      roleKey: 'ADMIN',
      displayName: 'Administrator',
      description: 'Pełne uprawnienia systemowe',
      permissionsJson: JSON.stringify(ROLE_PERMISSION_MAP.ADMIN),
      isSystem: true,
    },
  })
  await prisma.roleDefinition.upsert({
    where: { roleKey: 'OPERATOR_FULL' },
    update: {
      displayName: 'Operator (pełny)',
      description: 'Pełny dostęp operacyjny bez panelu admin',
      permissionsJson: JSON.stringify(ROLE_PERMISSION_MAP.OPERATOR_FULL),
      isSystem: true,
    },
    create: {
      roleKey: 'OPERATOR_FULL',
      displayName: 'Operator (pełny)',
      description: 'Pełny dostęp operacyjny bez panelu admin',
      permissionsJson: JSON.stringify(ROLE_PERMISSION_MAP.OPERATOR_FULL),
      isSystem: true,
    },
  })

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'biuro@lamastage.pl').trim().toLowerCase()
  const adminUsername = (process.env.SEED_ADMIN_USERNAME || 'admin').trim() || 'admin'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin1234'
  const adminFullName = process.env.SEED_ADMIN_FULL_NAME || 'Rafał Szydłowski'

  const operatorEmail = (process.env.SEED_OPERATOR_EMAIL || 'operator@lamastage.pl').trim().toLowerCase()
  const operatorUsername = (process.env.SEED_OPERATOR_USERNAME || 'operator').trim() || 'operator'
  const operatorPassword = process.env.SEED_OPERATOR_PASSWORD || 'operator123'
  const operatorFullName = process.env.SEED_OPERATOR_FULL_NAME || 'Operator Lama'

  const adminExisting = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { username: adminUsername },
      ],
    },
  })
  const admin = adminExisting
    ? await prisma.user.update({
        where: { id: adminExisting.id },
        data: {
          email: adminEmail,
          username: adminUsername,
          fullName: adminFullName,
          role: 'ADMIN',
          isActive: true,
          emailVerifiedAt: new Date(),
          passwordHash: hashPassword(adminPassword),
          mustChangePassword: true,
        },
      })
    : await prisma.user.create({
        data: {
          email: adminEmail,
          username: adminUsername,
          fullName: adminFullName,
          role: 'ADMIN',
          isActive: true,
          emailVerifiedAt: new Date(),
          passwordHash: hashPassword(adminPassword),
          mustChangePassword: true,
        },
      })

  const operatorExisting = await prisma.user.findFirst({
    where: {
      OR: [
        { email: operatorEmail },
        { username: operatorUsername },
      ],
    },
  })
  if (operatorExisting) {
    await prisma.user.update({
      where: { id: operatorExisting.id },
      data: {
        email: operatorEmail,
        username: operatorUsername,
        fullName: operatorFullName,
        role: 'OPERATOR_FULL',
        isActive: true,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword(operatorPassword),
        mustChangePassword: true,
        createdById: admin.id,
      },
    })
  } else {
    await prisma.user.create({
      data: {
        email: operatorEmail,
        username: operatorUsername,
        fullName: operatorFullName,
        role: 'OPERATOR_FULL',
        isActive: true,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword(operatorPassword),
        mustChangePassword: true,
        createdById: admin.id,
      },
    })
  }

  console.log('✅ Użytkownicy startowi utworzeni/zaktualizowani')
}

async function seedEquipment() {
  const filePath = path.join(DATA_DIR, 'sprzet.csv')
  if (!fs.existsSync(filePath)) {
    console.log('Plik CSV sprzętu (prisma/data/sprzet.csv) nie znaleziony, pomijam seed.')
    return
  }

  const equipment: Prisma.EquipmentCreateInput[] = []
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (row: Record<string, string | undefined>) => {
        const category = row['Kategoria']?.trim()
        const name = row['Nazwa']?.trim()
        const priceStr = row['Cena']?.trim()
        let price = 0
        if (priceStr && priceStr.includes('/')) {
          const parts = priceStr.replace('=', '').split('/')
          price = parseFloat(parts[0]?.replace(',', '.') || '0')
        } else {
          price = parseFloat(priceStr?.replace(',', '.') || '0')
        }

        if (category && name && !Number.isNaN(price) && price >= 0) {
          equipment.push({
            name,
            description: `${category} - ${name}`,
            category,
            dailyPrice: price,
            stockQuantity: 1,
            unit: 'szt.',
            visibleInOffer: true,
          })
        }
      })
      .on('end', resolve)
      .on('error', reject)
  })

  console.log(`Znaleziono ${equipment.length} pozycji sprzętu w CSV`)

  for (const eq of equipment) {
    const existing = await prisma.equipment.findFirst({
      where: { name: eq.name, category: eq.category },
    })
    if (existing) {
      await prisma.equipment.update({
        where: { id: existing.id },
        data: eq,
      })
    } else {
      await prisma.equipment.create({
        data: eq,
      })
    }
  }

  console.log('✅ Sprzęt zaseedowany')
}

async function seedResources() {
  const filePath = path.join(DATA_DIR, 'zasoby.csv')
  if (!fs.existsSync(filePath)) {
    console.log('Plik CSV zasobów (prisma/data/zasoby.csv) nie znaleziony, pomijam seed.')
    return
  }

  const resources: Prisma.EquipmentCreateInput[] = []
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (row: Record<string, string | undefined>) => {
        const kategoria = row['Kategoria']?.trim()
        const name = row['Nazwa']?.trim()
        const priceStr = row['Cena']?.trim()
        const price = parseFloat(priceStr?.replace(',', '.') || '0')

        if (name && !Number.isNaN(price) && price >= 0) {
          resources.push({
            name,
            description: '',
            category: 'ZASOBY',
            subcategory: kategoria || null,
            dailyPrice: price,
            stockQuantity: 1,
            unit: 'szt.',
            visibleInOffer: true,
          })
        }
      })
      .on('end', resolve)
      .on('error', reject)
  })

  console.log(`Znaleziono ${resources.length} zasobów w CSV`)

  for (const res of resources) {
    const existing = await prisma.equipment.findFirst({
      where: { name: res.name, category: 'ZASOBY' },
    })
    if (existing) {
      await prisma.equipment.update({
        where: { id: existing.id },
        data: res,
      })
    } else {
      await prisma.equipment.create({
        data: res,
      })
    }
  }

  console.log('✅ Zasoby zaseedowane')
}

/** Przypisuje unikalne kody EQP-00001, RES-00001 itd. wszystkim rekordom (nadpisuje istniejące). */
async function normalizeInternalCodes() {
  const PREFIX_EQUIPMENT = 'EQP-'
  const PREFIX_RESOURCES = 'RES-'
  const PAD = 5

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
  if (equipment.length > 0) console.log(`  Przypisano ${equipment.length} kodów EQP-*`)

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
  if (resources.length > 0) console.log(`  Przypisano ${resources.length} kodów RES-*`)
  console.log('✅ Kody wewnętrzne znormalizowane')
}

async function seedOrders() {
  const clients = await prisma.client.findMany({ take: 5 })
  if (clients.length === 0) {
    console.log('Brak klientów, pomijam seed zleceń')
    return
  }

  const venues = ['Gdańsk', 'Warszawa', 'Kraków', 'Wrocław', 'Poznań']

  const orders = [
    {
      name: 'Event konferencyjny Tech Summit',
      description: 'Konferencja technologiczna z prezentacjami i networkingiem',
      status: 'CONFIRMED',
      venue: venues[0],
      dateFrom: new Date('2025-06-15'),
      dateTo: new Date('2025-06-17'),
      clientId: clients[0]!.id,
      discountGlobal: 10,
      vatRate: 23,
      isRecurring: false,
    },
    {
      name: 'Wesele Anna i Piotr',
      description: 'Pełna obsługa techniczna wesela',
      status: 'CONFIRMED',
      venue: venues[1],
      dateFrom: new Date('2025-07-22'),
      dateTo: new Date('2025-07-23'),
      clientId: clients[1]?.id || clients[0]!.id,
      discountGlobal: 0,
      vatRate: 23,
      isRecurring: false,
    },
    {
      name: 'Koncert rockowy Summer Fest',
      description: 'Scena główna, nagłośnienie, oświetlenie',
      status: 'OFFER_SENT',
      venue: venues[2],
      dateFrom: new Date('2025-08-10'),
      dateTo: new Date('2025-08-11'),
      clientId: clients[2]?.id || clients[0]!.id,
      discountGlobal: 5,
      vatRate: 23,
      isRecurring: false,
    },
    {
      name: 'Targi biznesowe Expo 2025',
      description: 'Stoisko z multimediami i prezentacjami',
      status: 'DRAFT',
      venue: venues[3],
      dateFrom: new Date('2025-09-05'),
      dateTo: new Date('2025-09-07'),
      clientId: clients[3]?.id || clients[0]!.id,
      discountGlobal: 0,
      vatRate: 23,
      isRecurring: false,
    },
  ]

  for (const orderData of orders) {
    try {
      await prisma.order.create({
        data: orderData,
      })
    } catch (error) {
      // Ignore duplicate errors
      console.log(`Zlecenie "${orderData.name}" już istnieje, pomijam.`)
    }
  }

  console.log(`✅ ${orders.length} przykładowe zlecenia zaseedowane`)
}

async function normalizeRemovedOrderStatuses() {
  const result = await prisma.order.updateMany({
    where: { status: 'IN_PROGRESS' },
    data: { status: 'CONFIRMED' },
  })
  if (result.count > 0) {
    console.log(`✅ Zmieniono ${result.count} zleceń z IN_PROGRESS na CONFIRMED`)
  }
}

async function normalizeResourceSubcategoriesFromDescription() {
  const resources = await prisma.equipment.findMany({
    where: { category: 'ZASOBY' },
    select: { id: true, description: true, subcategory: true },
  })

  let migrated = 0
  for (const resource of resources) {
    const description = resource.description || ''
    const legacyMatch = description.match(/Kategoria:\s*(.+)/i)
    const legacySubcategory = legacyMatch?.[1]?.trim()
    const currentSubcategory = resource.subcategory?.trim()

    const nextSubcategory = currentSubcategory || legacySubcategory || null
    const shouldClearDescription = description.length > 0

    if (nextSubcategory !== currentSubcategory || shouldClearDescription) {
      await prisma.equipment.update({
        where: { id: resource.id },
        data: {
          subcategory: nextSubcategory,
          description: '',
        },
      })
      migrated += 1
    }
  }

  if (migrated > 0) {
    console.log(`✅ Zaktualizowano ${migrated} zasobów: podkategorie + wyzerowane opisy`)
  }
}

async function seedIssuerProfiles() {
  const defaults: Array<{
    profileKey: string
    companyName: string
    address: string
    nip: string
    email: string
    phone: string | null
    sortOrder: number
    isDefault: boolean
  }> = [
    {
      profileKey: 'LAMA_STAGE',
      companyName: 'Lama Stage S. C.',
      address: 'W. Pytlasińskiego 16/13, 00-777 Warszawa',
      nip: '7011187626',
      email: 'biuro@lamastage.pl',
      phone: '793 435 302, 504 361 781',
      sortOrder: 0,
      isDefault: true,
    },
    {
      profileKey: 'LAMA_STAGE_OLD',
      companyName: 'Lama Stage s.c. Michał Rokicki, Rafał Szydłowski',
      address: 'Lindleya 16, 02-013 Warszawa',
      nip: '7011187626',
      email: 'biuro@lamastage.pl',
      phone: '793 435 302, 504 361 781',
      sortOrder: 1,
      isDefault: false,
    },
  ]

  for (const row of defaults) {
    await prisma.issuerProfile.upsert({
      where: { profileKey: row.profileKey },
      create: row,
      update: {
        companyName: row.companyName,
        address: row.address,
        nip: row.nip,
        email: row.email,
        phone: row.phone,
        sortOrder: row.sortOrder,
        isDefault: row.isDefault,
      },
    })
  }

  const def = await prisma.issuerProfile.findFirst({ where: { isDefault: true } })
  if (!def) {
    const first = await prisma.issuerProfile.findFirst({ orderBy: { sortOrder: 'asc' } })
    if (first) {
      await prisma.issuerProfile.update({ where: { id: first.id }, data: { isDefault: true } })
    }
  }

  console.log('✅ Profile firmy (issuer) zaseedowane')
}

async function seedAppSettings() {
  await prisma.appSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      instanceCode: process.env.INSTANCE_CODE?.trim() || 'main',
      brandName: 'Lama Stage',
      brandTagline: 'Fuckup Manager',
      loginHeadline: 'Zaloguj się do panelu operacyjnego.',
      supportEmail: 'biuro@lamastage.pl',
      supportPhone: '793 435 302, 504 361 781',
      websiteUrl: 'https://www.lamastage.pl',
      legalFooter: 'Lama Stage © 2026',
      emailSenderName: 'Lama Stage',
      emailFooterText: 'Wiadomość wysłana automatycznie. Jeśli nie oczekiwałeś tej wiadomości, możesz ją zignorować.',
      documentFooterText: 'Dokument wygenerowany automatycznie z systemu Lama Stage.',
    },
    update: {
      instanceCode: process.env.INSTANCE_CODE?.trim() || 'main',
    },
  })

  console.log('✅ Ustawienia aplikacji zaseedowane')
}

async function main() {
  console.log('Rozpoczynam seeding bazy danych...')
  await seedUsers()
  await seedAppSettings()
  await seedIssuerProfiles()
  await seedClients()
  await seedEquipment()
  await seedResources()
  await normalizeResourceSubcategoriesFromDescription()
  await normalizeInternalCodes()
  await seedOrders()
  await normalizeRemovedOrderStatuses()
  console.log('✅ Seeding zakończony')
}

main()
  .catch((e) => {
    console.error('Błąd seedowania:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })