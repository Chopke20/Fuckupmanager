import './load-env'
import { createApp } from './app'
import { connectDefaultCompanyPrisma, disconnectAllPrismaClients } from './prisma/company-prisma'

const PORT = process.env.PORT || 3000

async function main() {
  const app = createApp()

  try {
    await connectDefaultCompanyPrisma()
    console.log('✅ Połączono z bazą danych')
  } catch (error) {
    console.error('❌ Błąd połączenia z bazą danych:', error)
    process.exit(1)
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Serwer API działa na porcie ${PORT}`)
    console.log(`📡 Health check: http://localhost:${PORT}/health`)
  })

  process.on('SIGTERM', async () => {
    console.log('🛑 Otrzymano SIGTERM, zamykanie serwera...')
    await disconnectAllPrismaClients()
    server.close(() => {
      console.log('✅ Serwer zamknięty')
      process.exit(0)
    })
  })
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
