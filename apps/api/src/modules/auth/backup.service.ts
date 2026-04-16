import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const BACKUP_FILENAME_PREFIX = 'lama-stage-backup'

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url || !url.startsWith('postgres')) {
    throw new Error('DATABASE_URL musi wskazywać na PostgreSQL, aby utworzyć backup.')
  }
  return new URL(url)
}

function buildBackupFilename(databaseName: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const instanceCode = process.env.INSTANCE_CODE?.trim() || 'main'
  return `${BACKUP_FILENAME_PREFIX}-${instanceCode}-${databaseName}-${timestamp}.dump`
}

export type BackupResult = {
  buffer: Buffer
  filename: string
  copiedToDir?: string
}

export async function createDatabaseBackup(): Promise<BackupResult> {
  const dbUrl = getDatabaseUrl()
  const databaseName = dbUrl.pathname.replace(/^\//, '').trim()
  if (!databaseName) {
    throw new Error('Nie udało się odczytać nazwy bazy z DATABASE_URL.')
  }

  const username = decodeURIComponent(dbUrl.username)
  const password = decodeURIComponent(dbUrl.password)
  const host = dbUrl.hostname
  const port = dbUrl.port || '5432'
  const filename = buildBackupFilename(databaseName)
  const tempPath = path.join(os.tmpdir(), filename)

  try {
    await execFileAsync(
      process.env.PG_DUMP_PATH?.trim() || 'pg_dump',
      [
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '--host',
        host,
        '--port',
        port,
        '--username',
        username,
        '--file',
        tempPath,
        databaseName,
      ],
      {
        env: {
          ...process.env,
          PGPASSWORD: password,
        },
      }
    )
  } catch (error) {
    throw new Error(`Nie udało się wykonać pg_dump. ${(error as Error).message}`)
  }

  const buffer = fs.readFileSync(tempPath)

  let copiedToDir: string | undefined
  const backupDir = process.env.BACKUP_DIR
  if (backupDir) {
    const dir = path.resolve(backupDir)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const destPath = path.join(dir, filename)
    fs.writeFileSync(destPath, buffer)
    copiedToDir = dir
  }

  try {
    fs.unlinkSync(tempPath)
  } catch {
    // ignore cleanup failure
  }

  return { buffer, filename, copiedToDir }
}
