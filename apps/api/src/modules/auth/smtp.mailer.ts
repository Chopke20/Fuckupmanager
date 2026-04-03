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

function readConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM
  if (!host || !port || !user || !pass || !from) {
    throw new AppError('Brak konfiguracji SMTP w env.', 500, 'SMTP_CONFIG_MISSING')
  }
  return { host, port, user, pass, from }
}

/** Fail fast before persisting invitations / reset tokens when SMTP is not configured. */
export function assertSmtpMailConfigured(): void {
  readConfig()
}

function onceData(socket: SocketLike): Promise<string> {
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      cleanup()
      resolve(chunk.toString('utf8'))
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      socket.off('data', onData)
      socket.off('error', onError)
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

function buildMessage(config: SmtpConfig, payload: MailPayload): string {
  const boundary = `----lama-${Date.now().toString(36)}`
  const subject = mimeEncodeUtf8(payload.subject)
  return [
    `From: ${config.from}`,
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
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: config.host, port: config.port }, () => resolve(socket))
    socket.once('error', reject)
  })
}

function createTlsSocket(config: SmtpConfig): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: config.host, port: config.port, servername: config.host }, () => resolve(socket))
    socket.once('error', reject)
  })
}

function upgradeToTls(socket: net.Socket, config: SmtpConfig): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({ socket, servername: config.host }, () => resolve(secure))
    secure.once('error', reject)
  })
}

async function openSmtpConnection(config: SmtpConfig): Promise<SocketLike> {
  if (config.port === 465) {
    const secureSocket = await createTlsSocket(config)
    await readResponse(secureSocket)
    await sendCommand(secureSocket, `EHLO ${config.host}`, [250])
    return secureSocket
  }

  const plainSocket = await createPlainSocket(config)
  await readResponse(plainSocket)
  await sendCommand(plainSocket, `EHLO ${config.host}`, [250])
  await sendCommand(plainSocket, 'STARTTLS', [220])
  const secureSocket = await upgradeToTls(plainSocket, config)
  await sendCommand(secureSocket, `EHLO ${config.host}`, [250])
  return secureSocket
}

export async function sendSmtpMail(payload: MailPayload): Promise<void> {
  const config = readConfig()
  const socket = await openSmtpConnection(config)
  try {
    await sendCommand(socket, 'AUTH LOGIN', [334])
    await sendCommand(socket, Buffer.from(config.user).toString('base64'), [334])
    await sendCommand(socket, Buffer.from(config.pass).toString('base64'), [235])
    await sendCommand(socket, `MAIL FROM:<${config.from.match(/<(.+)>/)?.[1] ?? config.from}>`, [250])
    await sendCommand(socket, `RCPT TO:<${payload.to}>`, [250, 251])
    await sendCommand(socket, 'DATA', [354])

    const message = `${buildMessage(config, payload)}\r\n.\r\n`
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
