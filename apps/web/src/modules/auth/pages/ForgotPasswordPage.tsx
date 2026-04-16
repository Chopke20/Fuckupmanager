import { FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiForgotPassword } from '../auth.api'

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const companyCode = (searchParams.get('company') || '').trim().toLowerCase()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!companyCode) {
      setError('Brak wybranej firmy. Wróć do logowania i wybierz firmę.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await apiForgotPassword(companyCode, email)
      setSent(true)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Nie udało się wysłać linku resetu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-xl">Reset hasła</h1>
          <p className="text-sm text-muted-foreground">Wyślemy link do ustawienia nowego hasła.</p>
          {!companyCode ? <p className="text-xs text-destructive mt-1">Brak parametru firmy.</p> : null}
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
        {sent && <div className="text-sm text-primary">Jeśli konto istnieje, e-mail został wysłany.</div>}
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
        <button disabled={loading} className="w-full bg-primary text-black rounded px-3 py-2 disabled:opacity-50">
          {loading ? 'Wysyłanie...' : 'Wyślij link resetu'}
        </button>
        <Link to="/login" className="block text-xs text-primary hover:underline">Powrót do logowania</Link>
      </form>
    </div>
  )
}
