import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

/**
 * Musi być importowane przed `./app`.
 * - `override: true` dla `apps/api/.env` — nadpisuje puste/zepsute wartości z otoczenia (spawn, Windows).
 * - Kilka ścieżek: `__dirname` (src lub dist), potem `cwd` (np. start z roota monorepo).
 */
const envRoot = path.resolve(__dirname, '../../..', '.env')

/** Kolejność: plik obok `src`/`dist`, potem `.env` z cwd (np. `apps/api`), potem monorepo root → `apps/api/.env`. */
const apiEnvCandidates = [
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps', 'api', '.env'),
]

let loadedApi = false
for (const p of apiEnvCandidates) {
  if (!fs.existsSync(p)) continue
  dotenv.config({ path: p, override: true })
  loadedApi = true
  break
}

if (fs.existsSync(envRoot)) {
  dotenv.config({ path: envRoot, override: false })
}

if (process.env.NODE_ENV === 'development' && !loadedApi) {
  console.warn(
    '[load-env] Nie znaleziono pliku .env dla API. Szukano m.in.:',
    apiEnvCandidates.join(', ')
  )
}
