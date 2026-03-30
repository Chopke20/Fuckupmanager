import { Request, Response } from 'express'
import type { TransportPricingSettings } from '@prisma/client'
import { prisma } from '../../prisma/client'
import { UpdateTransportPricingSettingsSchema } from '@lama-stage/shared-types'
import { writeAuditLog } from '../auth/audit.service'

const NBP_EUR_URL = 'https://api.nbp.pl/api/exchangerates/rates/A/EUR/?format=json'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12h

interface NbpRateResponse {
  table: string
  currency: string
  code: string
  rates: Array<{ no: string; effectiveDate: string; mid: number }>
}

let eurCache: { rate: number; date: string; fetchedAt: number } | null = null

type TransportRange = { fromKm: number; toKm: number; flatNet: number }

const DEFAULT_TRANSPORT_RANGES: TransportRange[] = [
  { fromKm: 0, toKm: 50, flatNet: 150 },
  { fromKm: 50, toKm: 100, flatNet: 250 },
]

function round2(value: number) {
  return Number(value.toFixed(2))
}

function normalizeRanges(input: unknown): TransportRange[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const rows = input
    .map((raw) => {
      const row = raw as Record<string, unknown>
      return {
        fromKm: Number(row.fromKm),
        toKm: Number(row.toKm),
        flatNet: Number(row.flatNet),
      }
    })
    .filter(
      (row) =>
        Number.isFinite(row.fromKm) &&
        Number.isFinite(row.toKm) &&
        Number.isFinite(row.flatNet) &&
        row.fromKm >= 0 &&
        row.toKm > row.fromKm &&
        row.flatNet >= 0
    )
    .sort((a, b) => a.fromKm - b.fromKm)
    .map((row) => ({
      fromKm: round2(row.fromKm),
      toKm: round2(row.toKm),
      flatNet: round2(row.flatNet),
    }))

  if (rows.length === 0) return null
  const firstRow = rows[0]
  if (!firstRow || firstRow.fromKm !== 0) return null

  for (let i = 0; i < rows.length - 1; i += 1) {
    const current = rows[i]
    const next = rows[i + 1]
    if (!current || !next) return null
    if (current.toKm !== next.fromKm) return null
  }

  return rows
}

export class FinanceController {
  private async getOrCreateTransportSettings(): Promise<TransportPricingSettings> {
    return prisma.transportPricingSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        rangesJson: JSON.stringify(DEFAULT_TRANSPORT_RANGES),
      },
      update: {},
    })
  }

  private getNormalizedSettings(settings: TransportPricingSettings) {
    const fromJson = (() => {
      try {
        return normalizeRanges(JSON.parse(settings.rangesJson ?? '[]'))
      } catch {
        return null
      }
    })()

    const fromLegacy = normalizeRanges([
      {
        fromKm: 0,
        toKm: settings.shortDistanceKm ?? 50,
        flatNet: settings.shortDistanceNet ?? 150,
      },
      {
        fromKm: settings.shortDistanceKm ?? 50,
        toKm: settings.mediumDistanceKm ?? 100,
        flatNet: settings.mediumDistanceNet ?? 250,
      },
    ])

    const ranges = fromJson ?? fromLegacy ?? DEFAULT_TRANSPORT_RANGES
    const longDistancePerKm = Number.isFinite(Number(settings.longDistancePerKm))
      ? round2(Number(settings.longDistancePerKm))
      : 1.15

    return {
      ranges,
      longDistancePerKm,
      updatedAt: settings.updatedAt.toISOString(),
    }
  }

  async getEurExchangeRate(_req: Request, res: Response) {
    try {
      const now = Date.now()
      if (eurCache && now - eurCache.fetchedAt < CACHE_TTL_MS) {
        return res.json({
          data: { rate: eurCache.rate, date: eurCache.date, source: 'NBP' },
        })
      }

      const response = await fetch(NBP_EUR_URL)
      if (!response.ok) {
        throw new Error(`NBP API error: ${response.status}`)
      }
      const json = (await response.json()) as NbpRateResponse
      const rate = json?.rates?.[0]?.mid
      const date = json?.rates?.[0]?.effectiveDate

      if (rate == null || !date) {
        throw new Error('Invalid NBP response')
      }

      eurCache = { rate, date, fetchedAt: now }
      res.json({ data: { rate, date, source: 'NBP' } })
    } catch (error) {
      console.warn('FinanceController.getEurExchangeRate:', error)
      res.status(502).json({
        error: 'Nie udało się pobrać kursu EUR. Wpisz kurs ręcznie.',
      })
    }
  }

  async getTransportPricingSettings(_req: Request, res: Response) {
    const rawSettings = await this.getOrCreateTransportSettings()
    const settings = this.getNormalizedSettings(rawSettings)

    res.json({
      data: {
        ranges: settings.ranges,
        longDistancePerKm: settings.longDistancePerKm,
        updatedAt: settings.updatedAt,
      },
    })
  }

  async updateTransportPricingSettings(req: Request, res: Response) {
    const parsed = UpdateTransportPricingSettingsSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Nieprawidłowe ustawienia transportu',
        details: parsed.error.flatten(),
      })
    }

    const payload = parsed.data
    const ranges = [...payload.ranges]
      .sort((a, b) => a.fromKm - b.fromKm)
      .map((row) => ({
        fromKm: round2(row.fromKm),
        toKm: round2(row.toKm),
        flatNet: round2(row.flatNet),
      }))

    const beforeRaw = await this.getOrCreateTransportSettings()
    const before = this.getNormalizedSettings(beforeRaw)
    const first = ranges[0] ?? DEFAULT_TRANSPORT_RANGES[0] ?? { fromKm: 0, toKm: 50, flatNet: 150 }
    const second = ranges[1] ?? first
    const updated = await prisma.transportPricingSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        rangesJson: JSON.stringify(ranges),
        shortDistanceKm: first.toKm,
        mediumDistanceKm: second.toKm,
        shortDistanceNet: first.flatNet,
        mediumDistanceNet: second.flatNet,
        longDistancePerKm: payload.longDistancePerKm,
      },
      update: {
        rangesJson: JSON.stringify(ranges),
        shortDistanceKm: first.toKm,
        mediumDistanceKm: second.toKm,
        shortDistanceNet: first.flatNet,
        mediumDistanceNet: second.flatNet,
        longDistancePerKm: payload.longDistancePerKm,
      },
    })
    const after = this.getNormalizedSettings(updated)

    const user = res.locals.user as { id?: string; email?: string } | undefined
    const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined
    if (user?.id && user?.email) {
      const details = {
        before: {
          ranges: before.ranges,
          longDistancePerKm: before.longDistancePerKm,
        },
        after: {
          ranges: after.ranges,
          longDistancePerKm: after.longDistancePerKm,
        },
      }
      try {
        await writeAuditLog({
          actorUserId: user.id,
          actorEmail: user.email,
          module: 'finance',
          action: 'TRANSPORT_PRICING_UPDATE',
          targetType: 'TransportPricingSettings',
          targetId: String(updated.id),
          details: JSON.stringify(details),
          requestId: requestId ?? null,
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        })
      } catch (error) {
        console.warn('FinanceController.updateTransportPricingSettings audit log failed:', error)
      }
    }

    res.json({
      data: {
        ranges: after.ranges,
        longDistancePerKm: after.longDistancePerKm,
        updatedAt: after.updatedAt,
      },
    })
  }

  async getTransportQuote(req: Request, res: Response) {
    const distanceRaw = req.query.distanceKm
    const tripsRaw = req.query.trips
    const distanceKm = Number(distanceRaw)
    const trips = Number(tripsRaw ?? 1)

    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      return res.status(400).json({ error: 'distanceKm musi być liczbą >= 0' })
    }
    if (!Number.isFinite(trips) || trips < 1) {
      return res.status(400).json({ error: 'trips musi być liczbą >= 1' })
    }

    const rawSettings = await this.getOrCreateTransportSettings()
    const settings = this.getNormalizedSettings(rawSettings)
    const maxRangeToKm = settings.ranges[settings.ranges.length - 1]?.toKm ?? 0
    const roundTripDistanceKm = Number((distanceKm * 2).toFixed(2))

    let mode: 'RANGE_FLAT' | 'LONG_KM'
    let baseNetPerTrip: number
    let formula: string

    const matchedRange = settings.ranges.find((row) => roundTripDistanceKm >= row.fromKm && roundTripDistanceKm < row.toKm)
    if (matchedRange) {
      mode = 'RANGE_FLAT'
      baseNetPerTrip = matchedRange.flatNet
      formula = `roundTripDistanceKm(${roundTripDistanceKm}) = distanceKm(${distanceKm}) * 2 w przedziale [${matchedRange.fromKm}, ${matchedRange.toKm}) => flatNet(${matchedRange.flatNet})`
    } else {
      mode = 'LONG_KM'
      baseNetPerTrip = Number((roundTripDistanceKm * settings.longDistancePerKm).toFixed(2))
      formula = `roundTripDistanceKm(${roundTripDistanceKm}) >= lastRangeToKm(${maxRangeToKm}) => roundTripDistanceKm * longDistancePerKm(${settings.longDistancePerKm})`
    }

    const totalNet = Number((baseNetPerTrip * trips).toFixed(2))

    res.json({
      data: {
        distanceKm,
        roundTripDistanceKm,
        trips,
        mode,
        baseNetPerTrip,
        totalNet,
        formula,
        longDistanceFromKm: maxRangeToKm,
        matchedRange: matchedRange ?? null,
        settings: {
          ranges: settings.ranges,
          longDistancePerKm: settings.longDistancePerKm,
          updatedAt: settings.updatedAt,
        },
      },
    })
  }
}
