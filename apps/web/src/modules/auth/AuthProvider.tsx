import { Permission, resolvePermissionsForRole, UserPublic } from '@lama-stage/shared-types'
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { apiLogin, apiLogout, apiMe } from './auth.api'

interface AuthContextValue {
  user: UserPublic | null
  permissions: Permission[]
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  hasPermission: (permission: Permission) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshMe = async () => {
    try {
      const me = await apiMe()
      setUser(me)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshMe()
  }, [])

  const login = async (email: string, password: string) => {
    const me = await apiLogin(email, password)
    setUser(me)
  }

  const logout = async () => {
    await apiLogout()
    setUser(null)
  }

  const value = useMemo<AuthContextValue>(() => ({
    permissions: user?.permissions ?? (user?.role ? resolvePermissionsForRole(user.role) : []),
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    hasPermission: (permission: Permission) => {
      const permissions = user?.permissions ?? (user?.role ? resolvePermissionsForRole(user.role) : [])
      return permissions.includes(permission)
    },
    login,
    logout,
    refreshMe,
  }), [user, isLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
