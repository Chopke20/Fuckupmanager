import { FormEvent, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiAcceptInvite } from '../auth.api'

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await apiAcceptInvite(token, password, passwordConfirm)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Nie udało się aktywować konta.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-red-400">Brak tokenu zaproszenia.</div>
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-xl">Aktywacja konta</h1>
          <p className="text-sm text-muted-foreground">Ustaw hasło i zakończ aktywację konta.</p>
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
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
        <button disabled={loading} className="w-full bg-primary text-black rounded px-3 py-2 disabled:opacity-50">
          {loading ? 'Aktywowanie...' : 'Aktywuj konto'}
        </button>
      </form>
    </div>
  )
}
