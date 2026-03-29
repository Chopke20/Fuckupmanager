import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

interface CsvRow {
  'Imię i Nazwisko': string
  'Nazwa Firmy/Instytucji': string
  Adres: string
  Telefon: string
  Email: string
}

async function importClients() {
  try {
    const csvPath = 'c:\\Users\\PC\\Desktop\\Baza_Klientów_przebudowana.csv'
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim() !== '')

    // Pomijamy nagłówek
    const rows = lines.slice(1).map(line => {
      const columns = line.split(',')
      return {
        'Imię i Nazwisko': columns[0]?.trim() || '',
        'Nazwa Firmy/Instytucji': columns[1]?.trim() || '',
        Adres: columns[2]?.trim() || '',
        Telefon: columns[3]?.trim() || '',
        Email: columns[4]?.trim() || '',
      }
    })

    console.log(`Znaleziono ${rows.length} wierszy do importu`)

    let imported = 0
    let skipped = 0

    for (const row of rows) {
      const companyName = row['Nazwa Firmy/Instytucji']
      const contactName = row['Imię i Nazwisko']
      const address = row['Adres']
      const phone = row['Telefon']
      const email = row['Email']

      // Jeśli brak nazwy firmy i kontaktu, pomijamy
      if (!companyName && !contactName) {
        console.log(`Pominięto wiersz bez nazwy firmy i kontaktu: ${JSON.stringify(row)}`)
        skipped++
        continue
      }

      // Użyj nazwy firmy jako companyName, jeśli brak to użyj kontaktu
      const finalCompanyName = companyName || contactName

      try {
        await prisma.client.create({
          data: {
            companyName: finalCompanyName,
            contactName: contactName || null,
            address: address || null,
            phone: phone || null,
            email: email || null,
          },
        })
        console.log(`Zaimportowano: ${finalCompanyName}`)
        imported++
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`Klient już istnieje: ${finalCompanyName}`)
          skipped++
        } else {
          console.error(`Błąd przy imporcie ${finalCompanyName}:`, error.message)
        }
      }
    }

    console.log(`\n✅ Import zakończony`)
    console.log(`   Zaimportowano: ${imported}`)
    console.log(`   Pominięto: ${skipped}`)
  } catch (error) {
    console.error('Błąd importu:', error)
  } finally {
    await prisma.$disconnect()
  }
}

importClients()