import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { errorMiddleware } from './shared/middleware/error.middleware'
import { requestIdMiddleware } from './shared/middleware/request-id.middleware'
import clientsRouter from './modules/clients/clients.router'
import equipmentRouter from './modules/equipment/equipment.router'
import { ordersRouter } from './modules/orders/orders.router'
import pdfRouter from './modules/pdf/pdf.router'
import blocksRouter from './modules/blocks/blocks.router'
import calendarEventsRouter from './modules/calendar-events/calendar-events.router'
import aiRouter from './modules/ai/ai.router'
import placesRouter from './modules/places/places.router'
import financeRouter from './modules/finance/finance.router'
import authRouter from './modules/auth/auth.router'
import issuerProfilesRouter from './modules/issuer-profiles/issuer-profiles.router'
import dataportRouter from './modules/dataport/dataport.router'
import appSettingsRouter from './modules/app-settings/app-settings.router'
import { requireAuth, requireModuleAccess, requirePermission } from './shared/middleware/auth.middleware'

function splitOrigins(raw: string | undefined, fallback: string): string[] {
  const s = (raw ?? fallback).trim()
  return s.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)
}

export function createApp() {
  const app = express()

  // Security
  app.use(helmet())
  const configuredOrigins = splitOrigins(
    process.env.FRONTEND_ORIGIN ?? process.env.CORS_ORIGIN,
    'http://localhost:5173'
  )
  const allowedOrigins = new Set<string>(configuredOrigins)
  const isDev = process.env.NODE_ENV !== 'production'
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const normalized = origin.replace(/\/$/, '')
      if (allowedOrigins.has(normalized)) return callback(null, true)
      if (isDev && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalized)) {
        return callback(null, true)
      }
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    exposedHeaders: ['X-Offer-Export-Created', 'X-Offer-Number-Reused'],
  }))

  // Tracing
  app.use(requestIdMiddleware)

  // Body parsing
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // API routes
  app.use('/api/app-settings', appSettingsRouter)
  app.use('/api/auth', authRouter)
  app.use('/api', requireAuth)
  app.use('/api/clients', requireModuleAccess('clients'), clientsRouter)
  app.use('/api/equipment', requireModuleAccess('equipment'), equipmentRouter)
  app.use('/api/orders', requireModuleAccess('orders'), ordersRouter)
  app.use('/api/issuer-profiles', issuerProfilesRouter)
  app.use('/api/integrations/nip-lookup', dataportRouter)
  app.use('/api/pdf', requireModuleAccess('documents'), pdfRouter)
  app.use('/api/blocks', requireModuleAccess('blocks'), blocksRouter)
  app.use('/api/calendar-events', requireModuleAccess('calendar'), calendarEventsRouter)
  app.use('/api/ai', requirePermission('integrations.ai.use'), aiRouter)
  app.use('/api/places', requirePermission('integrations.places.use'), placesRouter)
  app.use('/api/finance', requireModuleAccess('finance'), financeRouter)

  // Error handling
  app.use(errorMiddleware)

  return app
}