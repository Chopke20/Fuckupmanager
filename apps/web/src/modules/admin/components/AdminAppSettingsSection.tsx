import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppSettings } from '@lama-stage/shared-types'
import { apiGetAppSettings, apiUpdateAppSettings } from '../../auth/auth.api'
import { applyCompanyTheme, normalizeHexColor, THEME_DEFAULT_PRIMARY_HEX } from '../../../lib/companyTheme'
import { AdminCard, AdminCardBody, AdminCardHeader, AdminPanel, AdminPanelBody, AdminPanelHeader } from './AdminSurface'

const EMPTY_SETTINGS: AppSettings = {
  brandName: 'Lama Stage',
  brandTagline: null,
  loginHeadline: null,
  supportEmail: null,
  supportPhone: null,
  websiteUrl: null,
  legalFooter: null,
  logoDarkBgUrl: null,
  logoLightBgUrl: null,
  primaryColorHex: null,
  documentFooterText: null,
  warehouseAddress: null,
  projectContacts: null,
  defaultProjectContactId: null,
  emailSenderName: null,
  emailFooterText: null,
  replyToEmail: null,
}

export default function AdminAppSettingsSection() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<AppSettings>(EMPTY_SETTINGS)
  const [message, setMessage] = useState<string | null>(null)

  const settingsQuery = useQuery({
    queryKey: ['admin-app-settings'],
    queryFn: apiGetAppSettings,
  })

  useEffect(() => {
    if (!settingsQuery.data) return
    setDraft(settingsQuery.data)
  }, [settingsQuery.data])

  useEffect(() => {
    applyCompanyTheme(draft.primaryColorHex ?? null)
  }, [draft.primaryColorHex])

  const mutation = useMutation({
    mutationFn: apiUpdateAppSettings,
    onSuccess: async (updated) => {
      setDraft(updated)
      setMessage('Zapisano ustawienia firmy.')
      applyCompanyTheme(updated.primaryColorHex ?? null)
      await queryClient.invalidateQueries({ queryKey: ['admin-app-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['auth-me'] })
    },
    onError: (err: unknown) => {
      setMessage((err as Error)?.message ?? 'Nie udało się zapisać ustawień.')
    },
  })

  const setField = (field: keyof AppSettings, value: string | null) => {
    setDraft((prev) => ({ ...prev, [field]: value ? value : null }))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    mutation.mutate(draft)
  }

  const primaryHexPreview = normalizeHexColor(draft.primaryColorHex) ?? THEME_DEFAULT_PRIMARY_HEX
  const isPrimaryHexValid = draft.primaryColorHex == null || draft.primaryColorHex.trim() === ''
    ? true
    : normalizeHexColor(draft.primaryColorHex) != null

  if (settingsQuery.isLoading) {
    return (
      <AdminPanel>
        <AdminPanelHeader title="Tozsamosc firmy i komunikacja" description="Ładowanie ustawień firmy..." />
      </AdminPanel>
    )
  }

  return (
    <AdminPanel>
      <AdminPanelHeader
        title="Tozsamosc firmy i komunikacja"
        description="Ustawienia kontroluja wyglad firmy w systemie, panelu logowania, dokumentach i wiadomosciach."
      />
      <AdminPanelBody>
        <form className="space-y-3" onSubmit={onSubmit}>
          <AdminCard>
            <AdminCardHeader
              title="Podstawowa identyfikacja"
              description="Nazwa i hasla widoczne dla uzytkownikow."
            />
            <AdminCardBody>
              <div className="grid md:grid-cols-2 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Nazwa firmy</span>
              <input
                value={draft.brandName ?? ''}
                onChange={(e) => setField('brandName', e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Tagline (opcjonalnie)</span>
              <input
                value={draft.brandTagline ?? ''}
                onChange={(e) => setField('brandTagline', e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              />
            </label>
              </div>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Kolor przewodni aplikacji"
              description="Steruje akcentami interfejsu i dokumentami PDF."
            />
            <AdminCardBody>
              <div className="grid md:grid-cols-[120px_1fr_auto] gap-2 items-end">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Kolor</span>
              <input
                type="color"
                value={primaryHexPreview}
                onChange={(e) => setField('primaryColorHex', e.target.value)}
                className="w-full h-10 bg-surface border border-border rounded px-1 py-1"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">HEX (np. #00FF88)</span>
              <input
                value={draft.primaryColorHex ?? ''}
                onChange={(e) => setField('primaryColorHex', e.target.value.toUpperCase())}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm font-mono"
                placeholder="#00FF88"
              />
            </label>
            <button
              type="button"
              className="h-10 px-3 border border-border rounded text-sm hover:bg-surface"
                onClick={() => {
                  setField('primaryColorHex', null)
                  applyCompanyTheme(null)
                }}
            >
              Domyślny
            </button>
              </div>
              {!isPrimaryHexValid ? (
                <p className="mt-2 text-xs text-destructive">Nieprawidłowy format koloru. Użyj 6-znakowego kodu HEX.</p>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Podgląd:</span>
                <button type="button" className="bg-primary text-black rounded px-3 py-1.5 text-xs">
                  Przycisk primary
                </button>
              </div>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Logo i warianty tla"
              description="Adresy logo dla jasnego i ciemnego tla."
            />
            <AdminCardBody>
              <div className="grid md:grid-cols-2 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Logo (ciemne tlo)</span>
              <input
                value={draft.logoDarkBgUrl ?? ''}
                onChange={(e) => setField('logoDarkBgUrl', e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Logo (jasne tlo)</span>
              <input
                value={draft.logoLightBgUrl ?? ''}
                onChange={(e) => setField('logoLightBgUrl', e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              />
            </label>
              </div>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Uzycie logo"
              description="Brak wyboru = logo nie jest pokazywane."
            />
            <AdminCardBody>
              <div className="grid md:grid-cols-3 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Panel główny</span>
              <select
                value={draft.sidebarLogoVariant ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, sidebarLogoVariant: (e.target.value || null) as any }))}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              >
                <option value="">Nie pokazuj</option>
                <option value="DARK">Ciemne</option>
                <option value="LIGHT">Jasne</option>
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Panel logowania</span>
              <select
                value={draft.loginLogoVariant ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, loginLogoVariant: (e.target.value || null) as any }))}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              >
                <option value="">Nie pokazuj</option>
                <option value="DARK">Ciemne</option>
                <option value="LIGHT">Jasne</option>
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Dokumenty (PDF)</span>
              <select
                value={draft.documentsLogoVariant ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, documentsLogoVariant: (e.target.value || null) as any }))}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              >
                <option value="">Nie pokazuj</option>
                <option value="DARK">Ciemne</option>
                <option value="LIGHT">Jasne</option>
              </select>
            </label>
              </div>
            </AdminCardBody>
          </AdminCard>
        {/* Siedziba magazynu + opiekunowie projektu są w Admin → Dokumenty i komunikacja → Transport. */}
          <AdminCard>
            <AdminCardHeader
              title="Kontakt widoczny dla uzytkownikow"
              description="Dane kontaktowe pokazywane w interfejsie."
            />
            <AdminCardBody>
              <div className="grid md:grid-cols-3 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">E-mail kontaktowy</span>
              <input
                value={draft.supportEmail ?? ''}
                onChange={(e) => setField('supportEmail', e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Telefon</span>
              <input
                value={draft.supportPhone ?? ''}
                onChange={(e) => setField('supportPhone', e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">WWW</span>
              <input
                value={draft.websiteUrl ?? ''}
                onChange={(e) => setField('websiteUrl', e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              />
            </label>
              </div>
            </AdminCardBody>
          </AdminCard>
          <AdminCard>
            <AdminCardHeader
              title="Nadawca wiadomosci e-mail"
              description="Podpis i adres reply-to dla automatycznych wiadomosci."
            />
            <AdminCardBody>
              <div className="grid md:grid-cols-2 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Nazwa nadawcy e-mail</span>
              <input
                value={draft.emailSenderName ?? ''}
                onChange={(e) => setField('emailSenderName', e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Reply-to e-mail</span>
              <input
                value={draft.replyToEmail ?? ''}
                onChange={(e) => setField('replyToEmail', e.target.value)}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              />
            </label>
              </div>
            </AdminCardBody>
          </AdminCard>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="bg-primary text-black rounded px-3 py-2 text-sm disabled:opacity-50"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Zapisywanie...' : 'Zapisz ustawienia'}
            </button>
            {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
          </div>
        </form>
      </AdminPanelBody>
    </AdminPanel>
  )
}
