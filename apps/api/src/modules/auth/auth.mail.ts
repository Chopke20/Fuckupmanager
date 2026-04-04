import { sendSmtpMail } from './smtp.mailer'

function getAppBaseUrl(): string {
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && process.env.APP_BASE_URL_PROD) return process.env.APP_BASE_URL_PROD
  return process.env.APP_BASE_URL || 'http://localhost:5173'
}

function inviteTtlHours(): number {
  const n = Number(process.env.INVITE_TTL_HOURS ?? 48)
  return Number.isFinite(n) && n > 0 ? n : 48
}

function resetTtlMinutes(): number {
  const n = Number(process.env.RESET_TTL_MINUTES ?? 60)
  return Number.isFinite(n) && n > 0 ? n : 60
}

/** Odmiana: „48 godzin”, „1 godzinę”, „2 godziny”. */
function polishHoursPhrase(n: number): string {
  if (!Number.isFinite(n) || n < 1) return `${n} godzin`
  const mod10 = n % 10
  const mod100 = n % 100
  let form: 'godzinę' | 'godziny' | 'godzin'
  if (mod10 === 1 && mod100 !== 11) form = 'godzinę'
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = 'godziny'
  else form = 'godzin'
  return `${n} ${form}`
}

/** Odmiana: „60 minut”, „1 minutę”, „2 minuty”. */
function polishMinutesPhrase(n: number): string {
  if (!Number.isFinite(n) || n < 1) return `${n} minut`
  const mod10 = n % 10
  const mod100 = n % 100
  let form: 'minutę' | 'minuty' | 'minut'
  if (mod10 === 1 && mod100 !== 11) form = 'minutę'
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = 'minuty'
  else form = 'minut'
  return `${n} ${form}`
}

/** Szablon transakcyjny — tabele + inline CSS dla typowych klientów pocztowych. */
function transactionalEmailHtml(opts: {
  preheader: string
  title: string
  /** Krótki akapit w HTML — tylko treści z kodu (bez danych użytkownika). */
  introHtml: string
  ctaUrl: string
  ctaLabel: string
  expiresLine: string
}): string {
  const { preheader, title, introHtml, ctaUrl, ctaLabel, expiresLine } = opts
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background-color:#ecece8;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</span>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:10px;border:1px solid #d8d8d6;overflow:hidden;">
        <tr>
          <td style="padding:24px 28px 8px 28px;background-color:#111111;">
            <p style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#00e676;">
              Lama Stage
            </p>
            <p style="margin:8px 0 0 0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:600;line-height:1.3;color:#ffffff;">
              ${esc(title)}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px 28px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.55;color:#222222;">
            <p style="margin:0 0 16px 0;">${introHtml}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td align="center" style="border-radius:8px;background-color:#0d7a4d;">
                  <a href="${esc(ctaUrl)}" target="_blank" rel="noreferrer" style="display:inline-block;padding:14px 28px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                    ${esc(ctaLabel)}
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:#555555;">
              Jeśli przycisk nie działa, skopiuj i wklej ten adres w przeglądarce:<br/>
              <span style="word-break:break-all;color:#0d7a4d;">${esc(ctaUrl)}</span>
            </p>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#666666;">
              ${esc(expiresLine)}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 24px 28px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.5;color:#888888;">
            <p style="margin:0;padding-top:20px;border-top:1px solid #e8e8e6;">
              Wiadomość wysłana automatycznie — nie odpowiadaj na ten e-mail.<br/>
              Jeśli nie oczekiwałeś tej wiadomości, możesz ją zignorować; Twoje konto pozostanie bez zmian.
            </p>
            <p style="margin:12px 0 0 0;">
              <strong>Lama Stage</strong> · <a href="https://www.lamastage.pl" style="color:#0d7a4d;text-decoration:none;">lamastage.pl</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim()
}

export async function sendInviteEmail(email: string, token: string): Promise<void> {
  const base = getAppBaseUrl().replace(/\/$/, '')
  const url = `${base}/accept-invite?token=${encodeURIComponent(token)}`
  const hours = inviteTtlHours()
  const hoursLabel = polishHoursPhrase(hours)

  await sendSmtpMail({
    to: email,
    subject: 'Zaproszenie do systemu Lama Stage',
    text: [
      'Dzień dobry,',
      '',
      'Otrzymałeś zaproszenie do konta w systemie Lama Stage (wewnętrzna aplikacja operacyjna firmy).',
      'Aby aktywować konto i ustawić hasło, otwórz link:',
      url,
      '',
      `Link jest ważny przez ok. ${hoursLabel}. Po tym czasie poproś administratora o ponowne wysłanie zaproszenia.`,
      '',
      'Jeśli nie spodziewałeś się tej wiadomości, zignoruj ją.',
      '',
      '—',
      'Lama Stage · https://www.lamastage.pl',
    ].join('\n'),
    html: transactionalEmailHtml({
      preheader: 'Aktywuj konto w systemie Lama Stage — link ważny ograniczony czas.',
      title: 'Zaproszenie do systemu',
      introHtml:
        'Administrator nadał Ci dostęp do <strong>Lama Stage</strong>. Kliknij przycisk poniżej, aby dokończyć rejestrację i ustawić bezpieczne hasło.',
      ctaUrl: url,
      ctaLabel: 'Aktywuj konto',
      expiresLine: `Link aktywacyjny jest ważny przez ok. ${hoursLabel}. Po upływie tego czasu poproś administratora o ponowne wysłanie zaproszenia.`,
    }),
  })
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const base = getAppBaseUrl().replace(/\/$/, '')
  const url = `${base}/reset-password?token=${encodeURIComponent(token)}`
  const minutes = resetTtlMinutes()
  const minutesLabel = polishMinutesPhrase(minutes)

  await sendSmtpMail({
    to: email,
    subject: 'Reset hasła — Lama Stage',
    text: [
      'Dzień dobry,',
      '',
      'Otrzymaliśmy prośbę o zresetowanie hasła do konta Lama Stage.',
      'Aby ustawić nowe hasło, otwórz link (tylko jeśli to Ty złożyłeś wniosek):',
      url,
      '',
      `Link jest ważny przez ok. ${minutesLabel}. Po tym czasie użyj ponownie opcji „Nie pamiętam hasła” na stronie logowania.`,
      '',
      'Jeśli nie prosiłeś o reset, zignoruj tę wiadomość — hasło pozostanie bez zmian.',
      '',
      '—',
      'Lama Stage · https://www.lamastage.pl',
    ].join('\n'),
    html: transactionalEmailHtml({
      preheader: 'Ustaw nowe hasło do Lama Stage — link ważny krótko.',
      title: 'Reset hasła',
      introHtml:
        'Użyto opcji odzyskiwania dostępu do <strong>Lama Stage</strong>. Jeśli to Ty inicjowałeś tę operację, kliknij przycisk i ustaw nowe hasło.',
      ctaUrl: url,
      ctaLabel: 'Ustaw nowe hasło',
      expiresLine: `Ze względów bezpieczeństwa link jest ważny przez ok. ${minutesLabel}.`,
    }),
  })
}
