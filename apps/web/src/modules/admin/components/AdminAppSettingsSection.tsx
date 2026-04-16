import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginOption, UpdateAppSettingsInput } from '@lama-stage/shared-types'
import { apiGetAdminAppSettings, apiUpdateAppSettings } from '../../branding/branding.api'
import { useBranding } from '../../branding/BrandingProvider'

type AppSettingsDraft = UpdateAppSettingsInput & {
  loginOptions: LoginOption[]
}

const APP_SETTINGS_QUERY_KEY = ['admin-app-settings'] as const

const emptyLoginOption = (): LoginOption => ({
  id: '',
  label: '',
  loginUrl: '',
  logoUrl: '',
})

export default function AdminAppSettingsSection() {
  const queryClient = useQueryClient()
  const { refresh } = useBranding()
  const settingsQuery = useQuery({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: apiGetAdminAppSettings,
  })

  const [draft, setDraft] = useState<AppSettingsDraft>({
    brandName: '',
    brandTagline: '',
    loginHeadline: '',
    supportEmail: '',
    supportPhone: '',
    websiteUrl: '',
    legalFooter: '',
    logoDarkBgUrl: '',
    logoLightBgUrl: '',
    documentLogoUrl: '',
    primaryColorHex: '',
    loginOptions: [],
    documentFooterText: '',
    emailSenderName: '',
    emailFooterText: '',
    replyToEmail: '',
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!settingsQuery.data) return
    setDraft({
      brandName: settingsQuery.data.brandName,
      brandTagline: settingsQuery.data.brandTagline ?? '',
      loginHeadline: settingsQuery.data.loginHeadline ?? '',
      supportEmail: settingsQuery.data.supportEmail ?? '',
      supportPhone: settingsQuery.data.supportPhone ?? '',
      websiteUrl: settingsQuery.data.websiteUrl ?? '',
      legalFooter: settingsQuery.data.legalFooter ?? '',
      logoDarkBgUrl: settingsQuery.data.logoDarkBgUrl ?? '',
      logoLightBgUrl: settingsQuery.data.logoLightBgUrl ?? '',
      documentLogoUrl: settingsQuery.data.documentLogoUrl ?? '',
      primaryColorHex: settingsQuery.data.primaryColorHex ?? '',
      loginOptions: settingsQuery.data.loginOptions,
      documentFooterText: settingsQuery.data.documentFooterText ?? '',
      emailSenderName: settingsQuery.data.emailSenderName ?? '',
      emailFooterText: settingsQuery.data.emailFooterText ?? '',
      replyToEmail: settingsQuery.data.replyToEmail ?? '',
    })
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      setError(null)
      const payload: UpdateAppSettingsInput = {
        brandName: (draft.brandName ?? '').trim(),
        brandTagline: draft.brandTagline?.trim() || null,
        loginHeadline: draft.loginHeadline?.trim() || null,
        supportEmail: draft.supportEmail?.trim() || null,
        supportPhone: draft.supportPhone?.trim() || null,
        websiteUrl: draft.websiteUrl?.trim() || null,
        legalFooter: draft.legalFooter?.trim() || null,
        logoDarkBgUrl: draft.logoDarkBgUrl?.trim() || null,
        logoLightBgUrl: draft.logoLightBgUrl?.trim() || null,
        documentLogoUrl: draft.documentLogoUrl?.trim() || null,
        primaryColorHex: draft.primaryColorHex?.trim() || null,
        loginOptions: draft.loginOptions
          .filter((row) => row.id.trim() || row.label.trim() || row.loginUrl.trim() || row.logoUrl?.trim())
          .map((row) => ({
            id: row.id.trim(),
            label: row.label.trim(),
            loginUrl: row.loginUrl.trim(),
            logoUrl: row.logoUrl?.trim() || undefined,
          })),
        documentFooterText: draft.documentFooterText?.trim() || null,
        emailSenderName: draft.emailSenderName?.trim() || null,
        emailFooterText: draft.emailFooterText?.trim() || null,
        replyToEmail: draft.replyToEmail?.trim() || null,
      }
      return apiUpdateAppSettings(payload)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: APP_SETTINGS_QUERY_KEY }),
        refresh(),
      ])
    },
    onError: (err: Error) => setError(err.message),
  })

  if (settingsQuery.isLoading) {
    return <section className="bg-card border border-border rounded-lg p-4 text-sm text-muted-foreground">Ładowanie ustawień...</section>
  }

  if (settingsQuery.isError) {
    return <section className="bg-card border border-border rounded-lg p-4 text-sm text-destructive">Nie udało się pobrać ustawień instancji.</section>
  }

  return (
    <div className="space-y-5">
      <section className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Firma i branding</h2>
          <p className="text-xs text-muted-foreground">
            Te ustawienia wpływają na login, lewy górny róg aplikacji i podstawowe dane kontaktowe tej instancji.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Nazwa aplikacji</span>
            <input
              value={draft.brandName ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, brandName: e.target.value }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Podtytuł</span>
            <input
              value={draft.brandTagline ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, brandTagline: e.target.value }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1">Tekst na ekranie logowania</span>
          <textarea
            value={draft.loginHeadline ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, loginHeadline: e.target.value }))}
            rows={2}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
          />
        </label>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Logo na ciemne tło (URL)</span>
            <input
              value={draft.logoDarkBgUrl ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, logoDarkBgUrl: e.target.value }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Logo na jasne tło (URL)</span>
            <input
              value={draft.logoLightBgUrl ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, logoLightBgUrl: e.target.value }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">E-mail kontaktowy</span>
            <input
              value={draft.supportEmail ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, supportEmail: e.target.value }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Telefon kontaktowy</span>
            <input
              value={draft.supportPhone ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, supportPhone: e.target.value }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Strona WWW</span>
            <input
              value={draft.websiteUrl ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, websiteUrl: e.target.value }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Kolor przewodni (HEX, opcjonalnie)</span>
            <input
              value={draft.primaryColorHex ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, primaryColorHex: e.target.value }))}
              placeholder="#16a34a"
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1">Stopka prawna</span>
          <input
            value={draft.legalFooter ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, legalFooter: e.target.value }))}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
          />
        </label>
      </section>

      <section className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Wybór firmy na logowaniu</h2>
          <p className="text-xs text-muted-foreground">
            Kliknięcie w logo przenosi użytkownika do odpowiedniej instancji. Dodaj tylko te firmy, które mają aktywny adres logowania.
          </p>
        </div>

        <div className="space-y-3">
          {draft.loginOptions.map((option, idx) => (
            <div key={`${idx}-${option.id}`} className="grid md:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end border border-border rounded p-3">
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1">ID</span>
                <input
                  value={option.id}
                  onChange={(e) =>
                    setDraft((prev) => {
                      const next = [...prev.loginOptions]
                      next[idx] = { ...option, id: e.target.value }
                      return { ...prev, loginOptions: next }
                    })
                  }
                  className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1">Nazwa firmy</span>
                <input
                  value={option.label}
                  onChange={(e) =>
                    setDraft((prev) => {
                      const next = [...prev.loginOptions]
                      next[idx] = { ...option, label: e.target.value }
                      return { ...prev, loginOptions: next }
                    })
                  }
                  className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
                />
              </label>
              <div className="grid md:grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-xs font-medium text-muted-foreground mb-1">Adres logowania</span>
                  <input
                    value={option.loginUrl}
                    onChange={(e) =>
                      setDraft((prev) => {
                        const next = [...prev.loginOptions]
                        next[idx] = { ...option, loginUrl: e.target.value }
                        return { ...prev, loginOptions: next }
                      })
                    }
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-muted-foreground mb-1">Logo (URL)</span>
                  <input
                    value={option.logoUrl ?? ''}
                    onChange={(e) =>
                      setDraft((prev) => {
                        const next = [...prev.loginOptions]
                        next[idx] = { ...option, logoUrl: e.target.value }
                        return { ...prev, loginOptions: next }
                      })
                    }
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, loginOptions: prev.loginOptions.filter((_, rowIdx) => rowIdx !== idx) }))}
                className="px-3 py-2 text-xs border border-border rounded hover:bg-surface"
              >
                Usuń
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDraft((prev) => ({ ...prev, loginOptions: [...prev.loginOptions, emptyLoginOption()] }))}
            className="px-3 py-2 text-xs border border-border rounded hover:bg-surface w-fit"
          >
            + Dodaj firmę do wyboru
          </button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Dokumenty i komunikacja</h2>
          <p className="text-xs text-muted-foreground">
            Te ustawienia są używane jako fallback dla PDF i wiadomości e-mail tej instancji.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Logo dokumentów PDF (URL)</span>
            <input
              value={draft.documentLogoUrl ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, documentLogoUrl: e.target.value }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Nazwa nadawcy e-mail</span>
            <input
              value={draft.emailSenderName ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, emailSenderName: e.target.value }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Reply-to</span>
            <input
              value={draft.replyToEmail ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, replyToEmail: e.target.value }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Stopka dokumentu</span>
            <input
              value={draft.documentFooterText ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, documentFooterText: e.target.value }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1">Stopka e-mail</span>
          <textarea
            value={draft.emailFooterText ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, emailFooterText: e.target.value }))}
            rows={3}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
          />
        </label>
      </section>

      {error && <div className="text-xs text-destructive">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-primary text-black rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Zapisywanie...' : 'Zapisz ustawienia'}
        </button>
        <button
          type="button"
          onClick={() => settingsQuery.data && setDraft({
            brandName: settingsQuery.data.brandName,
            brandTagline: settingsQuery.data.brandTagline ?? '',
            loginHeadline: settingsQuery.data.loginHeadline ?? '',
            supportEmail: settingsQuery.data.supportEmail ?? '',
            supportPhone: settingsQuery.data.supportPhone ?? '',
            websiteUrl: settingsQuery.data.websiteUrl ?? '',
            legalFooter: settingsQuery.data.legalFooter ?? '',
            logoDarkBgUrl: settingsQuery.data.logoDarkBgUrl ?? '',
            logoLightBgUrl: settingsQuery.data.logoLightBgUrl ?? '',
            documentLogoUrl: settingsQuery.data.documentLogoUrl ?? '',
            primaryColorHex: settingsQuery.data.primaryColorHex ?? '',
            loginOptions: settingsQuery.data.loginOptions,
            documentFooterText: settingsQuery.data.documentFooterText ?? '',
            emailSenderName: settingsQuery.data.emailSenderName ?? '',
            emailFooterText: settingsQuery.data.emailFooterText ?? '',
            replyToEmail: settingsQuery.data.replyToEmail ?? '',
          })}
          className="px-3 py-2 text-sm border border-border rounded hover:bg-surface"
        >
          Przywróć wartości zapisane
        </button>
      </div>
    </div>
  )
}
