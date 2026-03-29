import { sendSmtpMail } from './smtp.mailer'

function getAppBaseUrl(): string {
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && process.env.APP_BASE_URL_PROD) return process.env.APP_BASE_URL_PROD
  return process.env.APP_BASE_URL || 'http://localhost:5173'
}

export async function sendInviteEmail(email: string, token: string): Promise<void> {
  const url = `${getAppBaseUrl().replace(/\/$/, '')}/accept-invite?token=${encodeURIComponent(token)}`
  await sendSmtpMail({
    to: email,
    subject: 'Zaproszenie do Lama Stage',
    text: `Czesc,\n\nOtrzymales zaproszenie do Lama Stage.\nAktywuj konto: ${url}\n\nLink wygasa po 48 godzinach.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.5;">
        <h2>Zaproszenie do Lama Stage</h2>
        <p>Otrzymałeś zaproszenie do aplikacji.</p>
        <p><a href="${url}" target="_blank" rel="noreferrer">Aktywuj konto</a></p>
        <p>Link wygasa po 48 godzinach.</p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${getAppBaseUrl().replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
  await sendSmtpMail({
    to: email,
    subject: 'Reset hasla - Lama Stage',
    text: `Czesc,\n\nAby ustawic nowe haslo, kliknij: ${url}\n\nLink wygasa po 60 minutach.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.5;">
        <h2>Reset hasła</h2>
        <p>Aby ustawić nowe hasło, kliknij poniżej:</p>
        <p><a href="${url}" target="_blank" rel="noreferrer">Ustaw nowe hasło</a></p>
        <p>Link wygasa po 60 minutach.</p>
      </div>
    `,
  })
}
