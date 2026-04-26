import { Permission, resolvePermissionsForRole, UserPublic } from '@lama-stage/shared-types'
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { apiLogin, apiLogout, apiMe } from './auth.api'
import { applyCompanyTheme, resetCompanyTheme } from '../../lib/companyTheme'

interface AuthContextValue {
  user: UserPublic | null
  permissions: Permission[]
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  selectedCompanyCode: string | null
  setSelectedCompanyCode: (companyCode: string | null) => void
  hasPermission: (permission: Permission) => boolean
  login: (companyCode: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCompanyCode, setSelectedCompanyCode] = useState<string | null>(() => {
    const saved = window.localStorage.getItem('selected_company_code')
    return saved && saved.trim().length > 0 ? saved : null
  })

  const refreshMe = async () => {
    try {
      const me = await apiMe()
      setUser(me)
      if (me.companyCode) {
        setSelectedCompanyCode(me.companyCode)
        window.localStorage.setItem('selected_company_code', me.companyCode)
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshMe()
  }, [])

  useEffect(() => {
    if (user?.primaryColorHex) {
      applyCompanyTheme(user.primaryColorHex)
      return
    }
    resetCompanyTheme()
  }, [user?.primaryColorHex])

  const login = async (companyCode: string, email: string, password: string) => {
    const me = await apiLogin(companyCode, email, password)
    setUser(me)
    setSelectedCompanyCode(companyCode)
    window.localStorage.setItem('selected_company_code', companyCode)
  }

  const logout = async () => {
    await apiLogout()
    setUser(null)
    resetCompanyTheme()
  }

  const value = useMemo<AuthContextValue>(() => ({
    permissions: user?.permissions ?? (user?.role ? resolvePermissionsForRole(user.role) : []),
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    selectedCompanyCode,
    setSelectedCompanyCode: (companyCode: string | null) => {
      setSelectedCompanyCode(companyCode)
      if (companyCode) window.localStorage.setItem('selected_company_code', companyCode)
      else window.localStorage.removeItem('selected_company_code')
    },
    hasPermission: (permission: Permission) => {
      const permissions = user?.permissions ?? (user?.role ? resolvePermissionsForRole(user.role) : [])
      return permissions.includes(permission)
    },
    login,
    logout,
    refreshMe,
  }), [user, isLoading, selectedCompanyCode])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
