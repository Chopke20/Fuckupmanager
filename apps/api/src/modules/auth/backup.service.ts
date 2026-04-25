import fs from 'fs'
import os from 'os'
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lama-pgdump-'))
  const tmpDumpPath = path.join(tmpDir, `backup-${companyCode}.dump`)
  const dumpArgs = [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--dbname',
    company.databaseUrl,
    '--file',
    tmpDumpPath,
  ]

  try {
    await execFileAsync(pgDumpPath, dumpArgs, { maxBuffer: 64 * 1024 * 1024 })
    const stat = fs.statSync(tmpDumpPath)
    if (!stat.isFile() || stat.size <= 0) {
      throw new Error(`Backup firmy '${companyCode}' ma nieprawidłowy rozmiar (${stat.size} B).`)
    }
    const buffer = fs.readFileSync(tmpDumpPath)
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
  } finally {
    try {
      if (fs.existsSync(tmpDumpPath)) fs.unlinkSync(tmpDumpPath)
      fs.rmdirSync(tmpDir)
    } catch {
      // ignore tmp cleanup errors
    }
  }
}
