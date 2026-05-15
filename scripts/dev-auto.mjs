#!/usr/bin/env node
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawn, spawnSync } from 'node:child_process'
import dotenv from 'dotenv'

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiEnvPath = path.join(monorepoRoot, 'apps', 'api', '.env')
const composeFile = path.join(monorepoRoot, 'docker-compose.smoke.yml')
const DEFAULT_DEV_DB_URL = 'postgresql://lama:lama@127.0.0.1:54330/lamasmoke'

const useDockerDb =
  process.argv.includes('--docker') ||
  process.env.DEV_AUTO_DB === '1' ||
  process.env.SMOKE_AUTO_DB === '1'

/** Ładuje `apps/api/.env` do `process.env` zanim spawn przekaże env dziecku. */
dotenv.config({
  path: apiEnvPath,
  override: true,
})

function isPostgresUrl(url) {
  return typeof url === 'string' && /^postgres(ql)?:\/\//i.test(url.trim())
}

function configuredDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim()
  if (!fs.existsSync(apiEnvPath)) return ''
  const parsed = dotenv.parse(fs.readFileSync(apiEnvPath, 'utf8'))
  return parsed.DATABASE_URL?.trim() ?? ''
}

function failDatabaseUrl(messageLines) {
  console.error(['', ...messageLines, ''].join('\n'))
  process.exit(1)
}

function assertDatabaseUrlOrExit() {
  const url = configuredDatabaseUrl()
  if (isPostgresUrl(url)) return url
  const preview = url ? `${url.slice(0, 40)}${url.length > 40 ? '…' : ''}` : '(puste lub brak)'
  failDatabaseUrl([
    'Błąd: DATABASE_URL w apps/api/.env musi wskazywać PostgreSQL.',
    `Aktualna wartość: ${preview}`,
    '',
    'Popraw np.:',
    '  DATABASE_URL="postgresql://USER:HASLO@localhost:5432/lama_dev"',
    '',
    'Bez lokalnego Postgresa — Docker (port 54330):',
    '  npm run dev:docker',
    '  (albo: $env:DEV_AUTO_DB=1; npm run dev   w PowerShell)',
    '',
    'Wzorzec: apps/api/.env.example',
  ])
}

function dockerDaemonHint(stderrText) {
  const s = (stderrText || '').toLowerCase()
  if (
    s.includes('docker_engine') ||
    s.includes('dockerdesktoplinuxengine') ||
    s.includes('cannot find the file specified') ||
    s.includes('failed to connect to the docker api')
  ) {
    return [
      'Docker Desktop nie działa (silnik nie jest uruchomiony).',
      '',
      '1. Otwórz aplikację „Docker Desktop” z menu Start.',
      '2. Poczekaj, aż status to „Engine running” (ikona wieloryba w trayu — bez czerwonego X).',
      '3. W PowerShell sprawdź:  docker info',
      '4. Potem ponów:  npm run dev:docker',
      '',
      'Jeśli Docker się nie uruchamia: Settings → General → „Use the WSL 2 based engine” (włączone),',
      'potem zrestartuj Docker Desktop lub komputer.',
    ]
  }
  return [
    'Nie udało się uruchomić kontenera (docker compose).',
    'Sprawdź w PowerShell:  docker compose -f docker-compose.smoke.yml up -d --wait',
    'Zainstaluj Docker Desktop albo ustaw poprawny DATABASE_URL w apps/api/.env.',
  ]
}

function assertDockerDaemonRunning() {
  const info = spawnSync('docker', ['info'], {
    encoding: 'utf8',
    env: process.env,
  })
  if (info.status === 0) return
  const err = `${info.stderr || ''}\n${info.stdout || ''}`
  failDatabaseUrl(dockerDaemonHint(err))
}

function dockerComposeUpWait() {
  if (!fs.existsSync(composeFile)) {
    failDatabaseUrl(['Brak pliku docker-compose.smoke.yml w katalogu głównym repozytorium.'])
  }
  assertDockerDaemonRunning()
  console.log('Dev: start Postgres w Dockerze (port 54330)…')
  // Ścieżka względna — unika problemów ze spacjami w katalogu projektu na Windows (shell + -f).
  const r = spawnSync('docker', ['compose', '-f', 'docker-compose.smoke.yml', 'up', '-d', '--wait'], {
    cwd: monorepoRoot,
    encoding: 'utf8',
    env: process.env,
  })
  if (r.status !== 0) {
    if (r.stdout?.trim()) console.error(r.stdout.trim())
    if (r.stderr?.trim()) console.error(r.stderr.trim())
    failDatabaseUrl(dockerDaemonHint(r.stderr || r.stdout || ''))
  }
}

function npmRunDbPush(extraEnv = {}) {
  execSync('npm run db:push -w apps/api', {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  })
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(false))
    server.listen({ port }, () => {
      server.close(() => resolve(true))
    })
  })
}

async function findFreePort(startPort, maxChecks = 50) {
  for (let port = startPort; port < startPort + maxChecks; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port
  }
  throw new Error(`Nie znaleziono wolnego portu od ${startPort} do ${startPort + maxChecks - 1}`)
}

function pipeWithPrefix(stream, prefix) {
  let buffer = ''
  stream.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) console.log(`${prefix} ${line}`)
    }
  })
}

async function main() {
  let dbUrl = configuredDatabaseUrl()

  if (useDockerDb) {
    dockerComposeUpWait()
    dbUrl = process.env.DEV_DATABASE_URL?.trim() || DEFAULT_DEV_DB_URL
    process.env.DATABASE_URL = dbUrl
    console.log(`Dev: DATABASE_URL → ${dbUrl.replace(/:([^:@/]+)@/, ':***@')}`)
  } else {
    dbUrl = assertDatabaseUrlOrExit()
    process.env.DATABASE_URL = dbUrl
  }

  console.log('Przygotowuję bazę danych (prisma db push)...')
  npmRunDbPush({ DATABASE_URL: dbUrl })

  const apiPort = process.env.API_PORT ? Number(process.env.API_PORT) : await findFreePort(3000)
  const webPort = process.env.WEB_PORT ? Number(process.env.WEB_PORT) : await findFreePort(5180)
  const frontendOrigin = `http://localhost:${webPort}`
  const apiUrl = `http://localhost:${apiPort}`

  console.log(`API port: ${apiPort}`)
  console.log(`WEB port: ${webPort}`)
  console.log(`Frontend URL: ${frontendOrigin}`)
  console.log(`API URL: ${apiUrl}`)
  console.log('')

  const childEnv = {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: dbUrl,
    PORT: String(apiPort),
    FRONTEND_ORIGIN: frontendOrigin,
  }
  if (useDockerDb) {
    // Lokalny Docker — jedna baza; nie ładuj produkcyjnego COMPANY_DATABASES_JSON z .env.
    childEnv.COMPANY_DATABASES_JSON = ''
  }

  const apiProc = spawn('npm run dev -w apps/api', {
    env: childEnv,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  })

  const webProc = spawn(`npm run dev -w apps/web -- --port ${webPort}`, {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      WEB_PORT: String(webPort),
      VITE_API_TARGET: apiUrl,
    },
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  })

  pipeWithPrefix(apiProc.stdout, '[api]')
  pipeWithPrefix(apiProc.stderr, '[api]')
  pipeWithPrefix(webProc.stdout, '[web]')
  pipeWithPrefix(webProc.stderr, '[web]')

  const shutdown = () => {
    apiProc.kill('SIGTERM')
    webProc.kill('SIGTERM')
    setTimeout(() => {
      process.exit(0)
    }, 500)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  apiProc.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[api] exited with code ${code}`)
    }
  })
  webProc.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[web] exited with code ${code}`)
    }
  })
}

main().catch((error) => {
  console.error('Nie udało się uruchomić dev-auto:', error.message)
  process.exit(1)
})
