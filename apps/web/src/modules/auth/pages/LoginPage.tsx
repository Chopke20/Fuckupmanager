import { FormEvent, useMemo, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import { useBranding } from '../../branding/BrandingProvider'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { settings } = useBranding()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const currentLoginUrl = useMemo(() => `${window.location.origin}/login`, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Nie udało się zalogować.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-xl bg-card border border-border rounded-lg p-6 space-y-5">
        {settings?.loginOptions?.length ? (
          <div className="space-y-3">
            <div>
              <h1 className="text-lg font-semibold">Wybierz firmę</h1>
              <p className="text-sm text-muted-foreground">Kliknij logo, aby przejść do właściwej instancji logowania.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {settings.loginOptions.map((option) => {
                const normalizedUrl = option.loginUrl.replace(/\/$/, '')
                const isCurrent = normalizedUrl === currentLoginUrl.replace(/\/$/, '')
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      if (!isCurrent) window.location.href = option.loginUrl
                    }}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      isCurrent ? 'border-primary bg-surface' : 'border-border hover:bg-surface'
                    }`}
                  >
                    <div className="bg-white rounded-md min-h-20 flex items-center justify-center p-3 mb-2">
                      {option.logoUrl ? (
                        <img src={option.logoUrl} alt={option.label} className="max-h-12 w-auto object-contain" />
                      ) : (
                        <span className="text-sm font-semibold text-black">{option.label}</span>
                      )}
                    </div>
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {isCurrent ? 'Ta instancja jest aktualnie wybrana.' : 'Przejdź do logowania tej firmy.'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
        <div>
          <h1 className="text-xl">Logowanie</h1>
          <p className="text-sm text-muted-foreground">
            {settings?.loginHeadline || `Zaloguj się do panelu ${settings?.brandName || 'operacyjnego'}.`}
          </p>
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
        {settings?.logoDarkBgUrl ? (
          <div className="bg-black rounded-lg px-4 py-5 flex items-center justify-center">
            <img src={settings.logoDarkBgUrl} alt={settings.brandName || 'Logo'} className="max-h-16 w-auto object-contain" />
          </div>
        ) : null}
        <div className="space-y-1">
          <label className="text-sm">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Hasło</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            required
          />
        </div>
        <button
          disabled={loading}
          className="w-full bg-primary text-black font-medium rounded px-3 py-2 disabled:opacity-50"
        >
          {loading ? 'Logowanie...' : 'Zaloguj'}
        </button>
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>Konto tworzy Admin przez zaproszenie.</span>
          <Link to="/forgot-password" className="text-primary hover:underline">Nie pamiętam hasła</Link>
        </div>
        {settings?.supportEmail || settings?.supportPhone ? (
          <div className="text-xs text-muted-foreground border-t border-border pt-3">
            Kontakt: {[settings.supportEmail, settings.supportPhone].filter(Boolean).join(' · ')}
          </div>
        ) : null}
      </form>
    </div>
  )
}
