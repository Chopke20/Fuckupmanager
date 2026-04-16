import { type AppSettingsPublic } from '@lama-stage/shared-types'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { apiGetPublicAppSettings } from './branding.api'

type BrandingContextValue = {
  settings: AppSettingsPublic | null
  isLoading: boolean
  refresh: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined)

function applyDocumentBranding(settings: AppSettingsPublic | null) {
  const title = settings?.brandName?.trim() || 'Panel operacyjny'
  document.title = title
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettingsPublic | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = async () => {
    try {
      const data = await apiGetPublicAppSettings()
      setSettings(data)
      applyDocumentBranding(data)
    } catch {
      setSettings(null)
      applyDocumentBranding(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const value = useMemo<BrandingContextValue>(() => ({
    settings,
    isLoading,
    refresh,
  }), [settings, isLoading])

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding() {
  const context = useContext(BrandingContext)
  if (!context) {
    throw new Error('useBranding must be used inside BrandingProvider')
  }
  return context
}
