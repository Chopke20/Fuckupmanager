import net from 'net'
import tls from 'tls'
import { AppError } from '../../shared/errors/AppError'

type SocketLike = net.Socket | tls.TLSSocket

interface MailPayload {
  to: string
  subject: string
  html: string
  text: string
}

interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

function stripEnvQuotes(value: string): string {
  const s = value.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim()
  }
  return s
}

/** Zwraca adres e-mail z pola From (nagłówek lub sam adres). */
function parseFromEmail(fromRaw: string): string {
  const s = stripEnvQuotes(fromRaw)
  const angle = s.match(/<([^>]+)>/)
  const inner = angle?.[1]?.trim()
  if (inner) return inner.toLowerCase()
  return s.toLowerCase()
}

/**
 * Niektórzy dostawcy (np. Hostido) wymagają: nagłówek From = konto uwierzytelnione.
 * Envelope MAIL FROM musi być spójny z AUTH — używamy zawsze SMTP_USER.
 */
function resolveSmtpFromIdentity(config: SmtpConfig): { envelopeFrom: string; fromHeader: string } {
  const userMailbox = stripEnvQuotes(config.user)
  const userEmail = userMailbox.toLowerCase()
  const fromDeclared = stripEnvQuotes(config.from)
  if (parseFromEmail(fromDeclared) === userEmail) {
    return { envelopeFrom: userMailbox, fromHeader: fromDeclared }
  }
  return { envelopeFrom: userMailbox, fromHeader: userMailbox }
}

/**
 * RFC 5321: argument EHLO to domena klienta, nie hostname serwera SMTP.
 * Błędne EHLO smtp.gmail.com potrafi psuć sesje z niektórymi dostawcami.
 */
function smtpEhloIdentifier(): string {
  const explicit = process.env.SMTP_EHLO_DOMAIN?.trim()
  if (explicit) return explicit.replace(/\s+/g, '') || 'localhost'
  const isProd = process.env.NODE_ENV === 'production'
  const base =
    (isProd && process.env.APP_BASE_URL_PROD?.trim()) || process.env.APP_BASE_URL?.trim()
  if (base) {
    try {
      const host = new URL(base.startsWith('http') ? base : `https://${base}`).hostname
      if (host) return host
    } catch {
      /* ignore */
    }
  }
  return 'localhost'
}

function readConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.SMTP_FROM?.trim()
  if (!host || !port || !user || !pass || !from) {
    throw new AppError('Brak konfiguracji SMTP w env.', 500, 'SMTP_CONFIG_MISSING')
  }
  return {
    host: stripEnvQuotes(host),
    port,
    user: stripEnvQuotes(user),
    pass: stripEnvQuotes(pass),
    from: stripEnvQuotes(from),
  }
}

/** Fail fast before persisting invitations / reset tokens when SMTP is not configured. */
export function assertSmtpMailConfigured(): void {
  readConfig()
}

function smtpReadTimeoutMs(): number {
  const n = Number(process.env.SMTP_READ_TIMEOUT_MS ?? 25000)
  return Number.isFinite(n) && n > 0 ? n : 25000
}

function smtpConnectTimeoutMs(): number {
  const n = Number(process.env.SMTP_CONNECT_TIMEOUT_MS ?? 20000)
  return Number.isFinite(n) && n > 0 ? n : 20000
}

function onceData(socket: SocketLike): Promise<string> {
  const readMs = smtpReadTimeoutMs()
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      socket.off('data', onData)
      socket.off('error', onError)
      reject(new Error(`SMTP: brak odpowiedzi serwera w ciągu ${Math.round(readMs / 1000)} s`))
    }, readMs)

    const onData = (chunk: Buffer) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.off('data', onData)
      socket.off('error', onError)
      resolve(chunk.toString('utf8'))
    }
    const onError = (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.off('data', onData)
      socket.off('error', onError)
      reject(error)
    }
    socket.once('data', onData)
    socket.once('error', onError)
  })
}

function parseResponseCode(raw: string): number {
  const code = Number(raw.slice(0, 3))
  if (!Number.isFinite(code)) return 0
  return code
}

async function readResponse(socket: SocketLike): Promise<string> {
  let raw = await onceData(socket)
  while (raw.length >= 4 && raw[3] === '-') {
    const tail = await onceData(socket)
    raw += tail
    const lastLine = raw.trimEnd().split(/\r?\n/).pop() ?? ''
    if (lastLine[3] !== '-') break
  }
  return raw
}

async function sendCommand(socket: SocketLike, command: string, expectedCodes: number[]): Promise<string> {
  socket.write(`${command}\r\n`)
  const response = await readResponse(socket)
  const code = parseResponseCode(response)
  if (!expectedCodes.includes(code)) {
    throw new AppError(`SMTP command failed (${command}): ${response}`, 502, 'SMTP_COMMAND_FAILED')
  }
  return response
}

function mimeEncodeUtf8(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

function buildMessage(fromHeader: string, payload: MailPayload): string {
  const boundary = `----lama-${Date.now().toString(36)}`
  const subject = mimeEncodeUtf8(payload.subject)
  return [
    `From: ${fromHeader}`,
    `To: ${payload.to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    payload.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    payload.html,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

function createPlainSocket(config: SmtpConfig): Promise<net.Socket> {
  const ms = smtpConnectTimeoutMs()
  return new Promise((resolve, reject) => {
    let settled = false
    const socket = net.createConnection({ host: config.host, port: config.port })
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      socket.destroy()
      socket.off('connect', onConnect)
      socket.off('error', onError)
      reject(new Error(`SMTP: nie udało się połączyć z ${config.host}:${config.port} w ciągu ${Math.round(ms / 1000)} s (firewall / zły host / port)?`))
    }, ms)

    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.off('connect', onConnect)
      socket.off('error', onError)
      fn()
    }

    const onConnect = () => done(() => resolve(socket))
    const onError = (err: Error) => done(() => reject(err))
    socket.once('connect', onConnect)
    socket.once('error', onError)
  })
}

function createTlsSocket(config: SmtpConfig): Promise<tls.TLSSocket> {
  const ms = smtpConnectTimeoutMs()
  return new Promise((resolve, reject) => {
    let settled = false
    const socket = tls.connect({ host: config.host, port: config.port, servername: config.host })
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      socket.destroy()
      socket.off('secureConnect', onSecure)
      socket.off('error', onError)
      reject(new Error(`SMTP (TLS): timeout połączenia z ${config.host}:${config.port} (${Math.round(ms / 1000)} s)`))
    }, ms)

    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.off('secureConnect', onSecure)
      socket.off('error', onError)
      fn()
    }

    const onSecure = () => done(() => resolve(socket))
    const onError = (err: Error) => done(() => reject(err))
    socket.once('secureConnect', onSecure)
    socket.once('error', onError)
  })
}

function upgradeToTls(socket: net.Socket, config: SmtpConfig): Promise<tls.TLSSocket> {
  const ms = smtpConnectTimeoutMs()
  return new Promise((resolve, reject) => {
    let settled = false
    const secure = tls.connect({ socket, servername: config.host })
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      secure.destroy()
      reject(new Error(`SMTP STARTTLS: timeout (${Math.round(ms / 1000)} s)`))
    }, ms)

    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      secure.off('secureConnect', onSecure)
      secure.off('error', onError)
      fn()
    }

    const onSecure = () => done(() => resolve(secure))
    const onError = (err: Error) => done(() => reject(err))
    secure.once('secureConnect', onSecure)
    secure.once('error', onError)
  })
}

async function openSmtpConnection(config: SmtpConfig): Promise<SocketLike> {
  const ehlo = smtpEhloIdentifier()
  if (config.port === 465) {
    const secureSocket = await createTlsSocket(config)
    await readResponse(secureSocket)
    await sendCommand(secureSocket, `EHLO ${ehlo}`, [250])
    return secureSocket
  }

  const plainSocket = await createPlainSocket(config)
  await readResponse(plainSocket)
  await sendCommand(plainSocket, `EHLO ${ehlo}`, [250])
  await sendCommand(plainSocket, 'STARTTLS', [220])
  const secureSocket = await upgradeToTls(plainSocket, config)
  await sendCommand(secureSocket, `EHLO ${ehlo}`, [250])
  return secureSocket
}

export async function sendSmtpMail(payload: MailPayload): Promise<void> {
  const config = readConfig()
  const { envelopeFrom, fromHeader } = resolveSmtpFromIdentity(config)
  const socket = await openSmtpConnection(config)
  try {
    await sendCommand(socket, 'AUTH LOGIN', [334])
    await sendCommand(socket, Buffer.from(config.user, 'utf8').toString('base64'), [334])
    await sendCommand(socket, Buffer.from(config.pass, 'utf8').toString('base64'), [235])
    await sendCommand(socket, `MAIL FROM:<${envelopeFrom}>`, [250])
    await sendCommand(socket, `RCPT TO:<${payload.to}>`, [250, 251])
    await sendCommand(socket, 'DATA', [354])

    const message = `${buildMessage(fromHeader, payload)}\r\n.\r\n`
    socket.write(message)
    const dataResponse = await readResponse(socket)
    const dataCode = parseResponseCode(dataResponse)
    if (![250].includes(dataCode)) {
      throw new AppError(`SMTP DATA failed: ${dataResponse}`, 502, 'SMTP_DATA_FAILED')
    }

    await sendCommand(socket, 'QUIT', [221])
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('Nie udało się wysłać e-maila SMTP.', 502, 'SMTP_SEND_FAILED', { message: (error as Error).message })
  } finally {
    socket.end()
  }
}
