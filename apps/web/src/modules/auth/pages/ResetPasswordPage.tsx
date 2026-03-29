import { FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiResetPassword } from '../auth.api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await apiResetPassword(token, password, passwordConfirm)
      setSuccess(true)
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Nie udało się ustawić hasła.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-red-400">Brak tokenu resetu.</div>
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-xl">Nowe hasło</h1>
          <p className="text-sm text-muted-foreground">Ustaw nowe hasło do konta.</p>
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
        {success && (
          <div className="text-sm text-primary">
            Hasło zostało zmienione. <Link to="/login" className="underline">Przejdź do logowania</Link>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm">Hasło</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Powtórz hasło</label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            minLength={8}
            required
          />
        </div>
        <button disabled={loading || success} className="w-full bg-primary text-black rounded px-3 py-2 disabled:opacity-50">
          {loading ? 'Zapisywanie...' : 'Ustaw hasło'}
        </button>
      </form>
    </div>
  )
}
