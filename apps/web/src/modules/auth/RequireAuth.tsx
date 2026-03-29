import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Permission } from '@lama-stage/shared-types'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Ładowanie sesji...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth()
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Ładowanie...</div>
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { hasPermission, isLoading } = useAuth()
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Ładowanie...</div>
  }
  if (!hasPermission(permission)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
