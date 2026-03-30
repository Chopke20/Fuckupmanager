#!/usr/bin/env node
/**
 * Smoke: jeśli API już odpowiada na /health — tylko testy; inaczej startuje zbudowane API.
 * Opcjonalnie SMOKE_AUTO_DB=1: docker compose (docker-compose.smoke.yml), db push + seed, potem API.
 *
 * Zmienne:
 * - API_URL — zdalne lub lokalne API (bez auto-startu przy URL nie-lokalnym)
 * - PORT — port tymczasowego API (domyślnie 3000)
 * - SMOKE_DATABASE_URL — nadpisuje DATABASE_URL wyłącznie dla procesów smoke (API + prisma)
 * - SMOKE_AUTO_DB=1 — uruchom Postgres w Dockerze i użyj domyślnego URL (localhost:54330)
 * - SMOKE_AUTO_DB_DOWN=1 — po smoke zatrzymaj kontener (tylko gdy SMOKE_AUTO_DB=1)
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const composeFile = path.join(root, 'docker-compose.smoke.yml')
const DEFAULT_SMOKE_DB_URL = 'postgresql://lama:lama@127.0.0.1:54330/lamasmoke'

const port = String(process.env.PORT || '3000')
const explicitUrl = process.env.API_URL?.trim()
const defaultBase = explicitUrl || `http://127.0.0.1:${port}`

function normalizeBase(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'localhost') u.hostname = '127.0.0.1'
    return u.toString().replace(/\/$/, '')
  } catch {
    return url.replace(/\/$/, '')
  }
}

const API_BASE = normalizeBase(defaultBase)

function isProbablyLocal(url) {
  try {
    const h = new URL(url).hostname
    return h === '127.0.0.1' || h === 'localhost' || h === '::1'
  } catch {
    return false
  }
}

async function healthOk(base) {
  try {
    const r = await fetch(`${base}/health`)
    if (!r.ok) return false
    const b = await r.json()
    return b?.status === 'ok'
  } catch {
    return false
  }
}

function waitForHealthLoop(base, timeoutMs, intervalMs, shouldAbort) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    let settled = false
    const finishErr = (err) => {
      if (settled) return
      settled = true
      reject(err)
    }
    const finishOk = () => {
      if (settled) return
      settled = true
      resolve(true)
    }
    const tick = async () => {
      try {
        if (shouldAbort()) {
          finishErr(
            new Error(
              'Proces API zakończył się przed gotowością. Sprawdź DATABASE_URL (postgresql://…) oraz logi powyżej.'
            )
          )
          return
        }
        if (await healthOk(base)) {
          finishOk()
          return
        }
        if (Date.now() >= deadline) {
          finishErr(new Error('API nie odpowiedziało na /health w czasie.'))
          return
        }
        setTimeout(tick, intervalMs)
      } catch (e) {
        finishErr(e)
      }
    }
    tick()
  })
}

function apiDistPath() {
  return path.join(root, 'apps', 'api', 'dist', 'index.js')
}

/** Pierwsze DATABASE_URL z env lub z apps/api/.env / root .env (kolejność jak w load-env API). */
function configuredDatabaseUrlForSmoke() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim()
  for (const p of [path.join(root, 'apps', 'api', '.env'), path.join(root, '.env')]) {
    if (!fs.existsSync(p)) continue
    const parsed = dotenv.parse(fs.readFileSync(p, 'utf8'))
    if (parsed.DATABASE_URL?.trim()) return parsed.DATABASE_URL.trim()
  }
  return ''
}

function assertPostgresUrlOrExit(url, hintDocker) {
  if (!url) return
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    console.error(
      'Smoke: DATABASE_URL musi wskazywać PostgreSQL (postgresql:// lub postgres://).\n' +
        'Sprawdź apps/api/.env lub zmienną DATABASE_URL.\n' +
        (hintDocker ? 'Z Dockerem: npm run smoke:docker\n' : '')
    )
    process.exit(1)
  }
}

let child = null
let weStarted = false
let healthReady = false

function killApi() {
  if (!child || !weStarted) return
  healthReady = true
  try {
    child.kill('SIGTERM')
  } catch {
    /* ignore */
  }
  child = null
  weStarted = false
}

process.on('SIGINT', () => {
  killApi()
  process.exit(130)
})
process.on('SIGTERM', () => {
  killApi()
  process.exit(143)
})

function npmRun(args, extraEnv) {
  const r = spawnSync('npm', args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32',
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function dockerComposeUpWait() {
  const r = spawnSync('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })
  if (r.status !== 0) {
    console.error(
      '\nSmoke: nie udało się uruchomić kontenera (docker compose). Zainstaluj Docker lub ustaw poprawny DATABASE_URL w apps/api/.env i ponów bez SMOKE_AUTO_DB.\n'
    )
    process.exit(r.status ?? 1)
  }
}

function dockerComposeDown() {
  spawnSync('docker', ['compose', '-f', composeFile, 'down', '-v'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

async function main() {
  let effectiveDbUrl = process.env.DATABASE_URL

  if (process.env.SMOKE_AUTO_DB === '1') {
    if (!fs.existsSync(composeFile)) {
      console.error('Smoke: brak pliku docker-compose.smoke.yml w root monorepo.')
      process.exit(1)
    }
    console.log('Smoke: SMOKE_AUTO_DB=1 — start Postgres (Docker)…\n')
    dockerComposeUpWait()
    effectiveDbUrl = process.env.SMOKE_DATABASE_URL || DEFAULT_SMOKE_DB_URL
    console.log('Smoke: prisma db push + seed (tymczasowa baza)…\n')
    npmRun(['run', 'db:push', '-w', 'apps/api'], { DATABASE_URL: effectiveDbUrl })
    npmRun(['run', 'db:seed', '-w', 'apps/api'], { DATABASE_URL: effectiveDbUrl })
  }

  const childEnv = { ...process.env, PORT: port }
  if (process.env.SMOKE_AUTO_DB === '1') {
    childEnv.DATABASE_URL = process.env.SMOKE_DATABASE_URL || effectiveDbUrl || DEFAULT_SMOKE_DB_URL
  } else if (process.env.SMOKE_DATABASE_URL) {
    childEnv.DATABASE_URL = process.env.SMOKE_DATABASE_URL
  }

  let base = API_BASE

  if (await healthOk(base)) {
    console.log(`Smoke: API już działa (${base})\n`)
  } else {
    if (explicitUrl && !isProbablyLocal(explicitUrl)) {
      console.error(`Smoke: ${base} nie odpowiada (health). Nie uruchamiam lokalnego API przy zdalnym API_URL.`)
      process.exit(1)
    }

    const dist = apiDistPath()
    if (!fs.existsSync(dist)) {
      console.error('Smoke: brak apps/api/dist/index.js. Uruchom: npm run build')
      process.exit(1)
    }

    if (process.env.SMOKE_AUTO_DB !== '1') {
      assertPostgresUrlOrExit(configuredDatabaseUrlForSmoke(), true)
    }

    console.log(`Smoke: start tymczasowego API (PORT=${port})…\n`)
    healthReady = false
    child = spawn(process.execPath, [dist], {
      cwd: path.join(root, 'apps', 'api'),
      env: childEnv,
      stdio: process.env.CI === 'true' ? 'pipe' : 'inherit',
    })
    weStarted = true

    let stderr = ''
    if (child.stderr && process.env.CI === 'true') {
      child.stderr.on('data', (c) => {
        stderr += c.toString()
      })
    }

    let abortStart = false
    child.on('exit', () => {
      if (healthReady) return
      abortStart = true
      if (stderr) console.error(stderr.slice(-6000))
    })

    try {
      await waitForHealthLoop(base, 90_000, 400, () => abortStart)
      healthReady = true
      console.log(`Smoke: API gotowe (${base})\n`)
    } catch (e) {
      console.error(`\n${e.message}`)
      if (!abortStart) {
        console.error(
          '\nPodpowiedź: upewnij się, że DATABASE_URL zaczyna się od postgresql:// lub postgres:// (apps/api/.env).\n' +
            'Na maszynie bez lokalnego Postgresa: zainstaluj Docker, potem  SMOKE_AUTO_DB=1 npm run smoke\n'
        )
      }
      killApi()
      if (process.env.SMOKE_AUTO_DB === '1' && process.env.SMOKE_AUTO_DB_DOWN === '1') dockerComposeDown()
      process.exit(1)
    }
  }

  const smokeScript = path.join(root, 'scripts', 'smoke-check.mjs')
  const code = await new Promise((resolve) => {
    const smoke = spawn(process.execPath, [smokeScript], {
      env: { ...process.env, API_URL: base },
      stdio: 'inherit',
    })
    smoke.on('exit', (c) => resolve(c ?? 1))
  })

  killApi()

  if (process.env.SMOKE_AUTO_DB === '1' && process.env.SMOKE_AUTO_DB_DOWN === '1') {
    dockerComposeDown()
  }

  process.exit(code)
}

main().catch((e) => {
  console.error(e)
  killApi()
  if (process.env.SMOKE_AUTO_DB === '1' && process.env.SMOKE_AUTO_DB_DOWN === '1') dockerComposeDown()
  process.exit(1)
})
