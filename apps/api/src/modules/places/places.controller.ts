import { Request, Response, NextFunction } from 'express'

/** Nowe Places API (v1) – więcej wyników, ograniczenie do Polski. Fallback na legacy gdy v1 niedostępne. */
type PlacePrediction = {
  placeId?: string
  text?: { text?: string }
  structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }
}
type Suggestion = { placePrediction?: PlacePrediction; queryPrediction?: { text?: { text?: string } } }
type AutocompleteResponse = { suggestions?: Suggestion[] }

type LegacyPrediction = { description: string; place_id: string }

function mapLegacyPredictions(predictions: LegacyPrediction[], max: number) {
  return predictions.slice(0, max).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mapsUrl: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.place_id)}`,
  }))
}

/** Viewport Polski (low = SW, high = NE) – twarde ograniczenie wyników do Polski */
const POLAND_VIEWPORT = {
  low: { latitude: 49.0, longitude: 14.0 },
  high: { latitude: 55.0, longitude: 24.5 },
}

async function autocompleteNew(apiKey: string, query: string): Promise<{ placeId: string; description: string; mapsUrl: string }[]> {
  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      input: query,
      languageCode: 'pl',
      regionCode: 'PL',
      locationBias: { rectangle: POLAND_VIEWPORT },
      includeQueryPredictions: false,
    }),
  })
  if (!response.ok) return []
  const payload = (await response.json()) as AutocompleteResponse
  const suggestions = payload.suggestions ?? []
  return suggestions
    .filter((s): s is Suggestion & { placePrediction: PlacePrediction } => !!s.placePrediction?.placeId)
    .slice(0, 20)
    .map((s) => {
      const p = s.placePrediction!
      const main = p.structuredFormat?.mainText?.text ?? p.text?.text ?? ''
      const secondary = p.structuredFormat?.secondaryText?.text ?? ''
      const description = secondary ? `${main}, ${secondary}` : main
      return {
        placeId: p.placeId!,
        description: description || p.text?.text || '',
        mapsUrl: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.placeId!)}`,
      }
    })
    .filter((d) => d.description)
}

async function autocompleteLegacy(apiKey: string, query: string): Promise<{ placeId: string; description: string; mapsUrl: string }[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
  url.searchParams.set('input', query)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('language', 'pl')
  url.searchParams.set('components', 'country:pl')
  const response = await fetch(url.toString())
  if (!response.ok) return []
  const payload = (await response.json()) as { status?: string; predictions?: LegacyPrediction[]; error_message?: string }
  if (payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
    if (payload.status === 'REQUEST_DENIED' && payload.error_message) {
      console.warn('[places] legacy REQUEST_DENIED:', payload.error_message)
    }
    return []
  }
  return mapLegacyPredictions(payload.predictions ?? [], 20)
}

/** Magazyn – punkt startowy do liczenia odległości drogowej (w jedną stronę). */
const WAREHOUSE_ORIGIN = 'Wał Miedzeszyński 251, Warszawa'

/** Cache odległości po placeId (km), żeby nie dzwonić do API przy każdym odświeżeniu. */
const distanceCache = new Map<string, number>()
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 24 h
const cacheTimestamps = new Map<string, number>()

function getCachedDistanceKm(placeId: string): number | null {
  const ts = cacheTimestamps.get(placeId)
  if (ts && Date.now() - ts < CACHE_TTL_MS) {
    const km = distanceCache.get(placeId)
    if (typeof km === 'number') return km
  }
  return null
}

function setCachedDistanceKm(placeId: string, km: number) {
  distanceCache.set(placeId, km)
  cacheTimestamps.set(placeId, Date.now())
}

type DistanceMatrixElement = { status: string; distance?: { value: number; text: string }; duration?: { value: number; text: string } }
type DistanceMatrixResponse = { rows?: { elements?: DistanceMatrixElement[] }[] }

export const getDistanceFromWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const placeId = typeof req.query.placeId === 'string' ? req.query.placeId.trim() : ''
    if (!placeId) {
      return res.status(400).json({ error: 'Brak placeId' })
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return res.json({ data: { distanceKm: null } })
    }

    const cached = getCachedDistanceKm(placeId)
    if (cached !== null) {
      return res.json({ data: { distanceKm: cached } })
    }

    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.set('origins', WAREHOUSE_ORIGIN)
    url.searchParams.set('destinations', `place_id:${placeId}`)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('language', 'pl')
    url.searchParams.set('mode', 'driving')
    url.searchParams.set('units', 'metric')

    const response = await fetch(url.toString())
    if (!response.ok) {
      return res.json({ data: { distanceKm: null } })
    }

    const payload = (await response.json()) as DistanceMatrixResponse
    const element = payload.rows?.[0]?.elements?.[0]
    const valueM = element?.status === 'OK' && element?.distance?.value ? element.distance.value : null
    const distanceKm = valueM != null ? Math.round((valueM / 1000) * 10) / 10 : null

    if (distanceKm !== null) {
      setCachedDistanceKm(placeId, distanceKm)
    }

    return res.json({ data: { distanceKm } })
  } catch (error) {
    next(error)
  }
}

export const autocompletePlaces = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : ''
    if (!query || query.length < 2) {
      return res.json({ data: [] })
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return res.json({ data: [] })
    }

    let data = await autocompleteNew(apiKey, query)
    if (data.length === 0) {
      data = await autocompleteLegacy(apiKey, query)
    }

    return res.json({ data })
  } catch (error) {
    next(error)
  }
}
