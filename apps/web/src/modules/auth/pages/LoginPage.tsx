import { FormEvent, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../AuthProvider'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }

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
      <form onSubmit={onSubmit} className="w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-xl">Logowanie</h1>
          <p className="text-sm text-muted-foreground">Zaloguj się do panelu Lama Stage.</p>
        </div>
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
          <Link to="/forgot-password" className="text-primary hover:underline">Nie pamiętam hasła</Link>
        </div>
      </form>
    </div>
  )
}
