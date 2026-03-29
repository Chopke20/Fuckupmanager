import fs from 'fs'
import path from 'path'

const BACKUP_FILENAME_PREFIX = 'lama-stage-backup'

/**
 * Resolves absolute path to SQLite database file from DATABASE_URL.
 * Supports file:./dev.db (relative to schema dir) and file:/absolute/path.
 */
function resolveDatabasePath(): string {
  const explicitPath = process.env.BACKUP_DATABASE_PATH
  if (explicitPath && fs.existsSync(explicitPath)) {
    return path.resolve(explicitPath)
  }

  const url = process.env.DATABASE_URL
  if (!url || !url.startsWith('file:')) {
    throw new Error('DATABASE_URL must be a file: URL (SQLite) for backup.')
  }

  const relativePath = url.replace(/^file:\/?/, '').trim()
  const fileName = path.basename(relativePath)

  const candidates = [
    path.join(process.cwd(), 'prisma', fileName),
    path.join(process.cwd(), 'apps/api/prisma', fileName),
    path.resolve(process.cwd(), relativePath),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Nie znaleziono pliku bazy danych. Sprawdź DATABASE_URL lub ustaw BACKUP_DATABASE_PATH. Próbowano: ${candidates.join(', ')}`
  )
}

export type BackupResult = {
  buffer: Buffer
  filename: string
  copiedToDir?: string
}

/**
 * Creates a full backup of the SQLite database:
 * - Reads the DB file and returns it as buffer
 * - If BACKUP_DIR is set, also copies the file there (external backup location)
 */
export async function createDatabaseBackup(): Promise<BackupResult> {
  const dbPath = resolveDatabasePath()
  const buffer = fs.readFileSync(dbPath)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `${BACKUP_FILENAME_PREFIX}-${timestamp}.db`

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

  return { buffer, filename, copiedToDir }
}
