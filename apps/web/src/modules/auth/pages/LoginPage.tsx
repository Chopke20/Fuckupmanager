import { FormEvent, useEffect, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import { apiListPublicCompanies, PublicCompany } from '../auth.api'

export default function LoginPage() {
  const [companies, setCompanies] = useState<PublicCompany[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login, selectedCompanyCode, setSelectedCompanyCode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }

  useEffect(() => {
    const load = async () => {
      setCompaniesLoading(true)
      setCompaniesError(null)
      try {
        const data = await apiListPublicCompanies()
        setCompanies(data)
        if (!selectedCompanyCode && data[0]?.code) {
          setSelectedCompanyCode(data[0].code)
        }
      } catch (e: unknown) {
        setCompaniesError((e as Error)?.message ?? 'Nie udało się pobrać listy firm.')
      } finally {
        setCompaniesLoading(false)
      }
    }
    load()
  }, [selectedCompanyCode, setSelectedCompanyCode])

  const selectedCompany = companies.find((item) => item.code === selectedCompanyCode) ?? null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedCompanyCode) {
      setError('Wybierz firmę przed logowaniem.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await login(selectedCompanyCode, email, password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Nie udało się zalogować.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-xl">Logowanie</h1>
          <p className="text-sm text-muted-foreground">Wybierz firmę i zaloguj się do panelu.</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Wybierz firmę</p>
          {companiesLoading ? (
            <p className="text-xs text-muted-foreground">Ładowanie listy firm...</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {companies.map((company) => {
                const selected = selectedCompanyCode === company.code
                return (
                  <button
                    key={company.code}
                    type="button"
                    onClick={() => setSelectedCompanyCode(company.code)}
                    className={`rounded border px-3 py-2 text-left transition-colors ${
                      selected ? 'border-primary bg-surface' : 'border-border hover:bg-surface'
                    }`}
                  >
                    {company.logoDarkBgUrl ? (
                      <img src={company.logoDarkBgUrl} alt={company.displayName} className="h-8 w-full object-contain object-left mb-1" />
                    ) : null}
                    <div className="text-sm font-medium">{company.displayName}</div>
                  </button>
                )
              })}
            </div>
          )}
          {companiesError ? <p className="text-xs text-destructive">{companiesError}</p> : null}
        </div>
        {selectedCompany?.loginHelpText ? (
          <p className="text-xs text-muted-foreground">{selectedCompany.loginHelpText}</p>
        ) : null}
        {error && <div className="text-sm text-red-400">{error}</div>}
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
          <Link
            to={`/forgot-password${selectedCompanyCode ? `?company=${encodeURIComponent(selectedCompanyCode)}` : ''}`}
            className="text-primary hover:underline"
          >
            Nie pamiętam hasła
          </Link>
        </div>
      </form>
    </div>
  )
}
