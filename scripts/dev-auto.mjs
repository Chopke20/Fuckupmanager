#!/usr/bin/env node
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawn } from 'node:child_process'
import dotenv from 'dotenv'

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** Ładuje `apps/api/.env` do `process.env` zanim spawn przekaże env dziecku — wtedy m.in. DATAPORT_API_KEY jest zawsze widoczne. */
dotenv.config({
  path: path.join(monorepoRoot, 'apps', 'api', '.env'),
  override: true,
})

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
  console.log('Przygotowuję bazę danych (prisma db push)...')
  execSync('npm run db:push -w apps/api', { stdio: 'inherit' })

  const apiPort = process.env.API_PORT ? Number(process.env.API_PORT) : await findFreePort(3000)
  const webPort = process.env.WEB_PORT ? Number(process.env.WEB_PORT) : await findFreePort(5180)
  const frontendOrigin = `http://localhost:${webPort}`
  const apiUrl = `http://localhost:${apiPort}`

  console.log(`API port: ${apiPort}`)
  console.log(`WEB port: ${webPort}`)
  console.log(`Frontend URL: ${frontendOrigin}`)
  console.log(`API URL: ${apiUrl}`)
  console.log('')

  const apiProc = spawn('npm run dev -w apps/api', {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(apiPort),
      FRONTEND_ORIGIN: frontendOrigin,
    },
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
