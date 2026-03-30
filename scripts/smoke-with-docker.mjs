#!/usr/bin/env node
/** Ustawia SMOKE_AUTO_DB=1 i uruchamia smoke (Postgres w Dockerze z docker-compose.smoke.yml). */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'run-smoke.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, SMOKE_AUTO_DB: '1' },
})
process.exit(r.status ?? 1)
