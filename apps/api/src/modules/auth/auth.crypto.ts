import crypto from 'crypto'

const SCRYPT_KEYLEN = 64

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex')
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':')
  if (!salt || !hash) return false
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN)
  const hashBuffer = Buffer.from(hash, 'hex')
  if (hashBuffer.length !== derived.length) return false
  return crypto.timingSafeEqual(hashBuffer, derived)
}
