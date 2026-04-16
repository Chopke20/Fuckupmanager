import fs from 'fs'
import path from 'path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getCompanyByCode } from '../companies/company-registry'

const execFileAsync = promisify(execFile)
const BACKUP_FILENAME_PREFIX = 'lama-stage-pg-backup'

function sanitizeCompanyCode(input: string): string {
  const normalized = input.trim().toLowerCase()
  if (!/^[a-z0-9_-]{2,32}$/.test(normalized)) {
    throw new Error('Nieprawidłowy kod firmy dla backupu.')
  }
  return normalized
}

export type BackupResult = {
  buffer: Buffer
  filename: string
  copiedToDir?: string
}

export async function createDatabaseBackup(companyCodeRaw: string): Promise<BackupResult> {
  const companyCode = sanitizeCompanyCode(companyCodeRaw)
  const company = getCompanyByCode(companyCode)
  if (!company) {
    throw new Error(`Nieznana firma '${companyCode}'.`)
  }

  const pgDumpPath = process.env.PG_DUMP_PATH?.trim() || 'pg_dump'
  const dumpArgs = [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--dbname',
    company.databaseUrl,
    '--file',
    '-',
  ]

  const { stdout } = await execFileAsync(pgDumpPath, dumpArgs, {
    encoding: 'buffer',
    maxBuffer: 512 * 1024 * 1024,
  })
  const buffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `${BACKUP_FILENAME_PREFIX}-${companyCode}-${timestamp}.dump`

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
