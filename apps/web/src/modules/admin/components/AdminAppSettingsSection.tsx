import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppSettings } from '@lama-stage/shared-types'
import { apiGetAppSettings, apiUpdateAppSettings } from '../../auth/auth.api'

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
  projectContactName: null,
  projectContactPhone: null,
  projectContactEmail: null,
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

  const mutation = useMutation({
    mutationFn: apiUpdateAppSettings,
    onSuccess: async (updated) => {
      setDraft(updated)
      setMessage('Zapisano ustawienia firmy.')
      await queryClient.invalidateQueries({ queryKey: ['admin-app-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['auth-me'] })
    },
    onError: (err: unknown) => {
      setMessage((err as Error)?.message ?? 'Nie udało się zapisać ustawień.')
    },
  })

  const setField = (field: keyof AppSettings, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value || null }))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    mutation.mutate(draft)
  }

  if (settingsQuery.isLoading) {
    return <section className="bg-card border border-border rounded-lg p-4 text-sm text-muted-foreground">Ładowanie ustawień firmy...</section>
  }

  return (
    <section className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Firma i branding</h2>
        <p className="text-xs text-muted-foreground">Ustaw tylko kluczowe elementy personalizacji dla tej firmy.</p>
      </div>
      <form className="space-y-3" onSubmit={onSubmit}>
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
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Logo (ciemne tło)</span>
            <input
              value={draft.logoDarkBgUrl ?? ''}
              onChange={(e) => setField('logoDarkBgUrl', e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Logo (jasne tło)</span>
            <input
              value={draft.logoLightBgUrl ?? ''}
              onChange={(e) => setField('logoLightBgUrl', e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="text-xs space-y-1 block">
          <span className="text-muted-foreground">Siedziba magazynu (do liczenia km transportu)</span>
          <input
            value={draft.warehouseAddress ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, warehouseAddress: e.target.value || null }))}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            placeholder="Np. Wał Miedzeszyński 251, Warszawa"
          />
        </label>
        <div className="border border-border rounded p-3 bg-surface-2/20 space-y-2">
          <div className="text-xs font-semibold">Opiekun projektu (PDF)</div>
          <p className="text-[11px] text-muted-foreground">
            Dane widoczne w stopce PDF jako „Opiekun projektu”. Edytuje tylko Admin.
          </p>
          <div className="grid md:grid-cols-3 gap-2">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Imię i nazwisko</span>
              <input
                value={draft.projectContactName ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, projectContactName: e.target.value || null }))}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
                placeholder="Np. Tadeusz Mikołajczyk"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Telefon</span>
              <input
                value={draft.projectContactPhone ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, projectContactPhone: e.target.value || null }))}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
                placeholder="Np. 666 666 666"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">E-mail</span>
              <input
                value={draft.projectContactEmail ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, projectContactEmail: e.target.value || null }))}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
                placeholder="Np. kontakt@twojafirma.pl"
              />
            </label>
          </div>
        </div>
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
        <button
          type="submit"
          className="bg-primary text-black rounded px-3 py-2 text-sm disabled:opacity-50"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Zapisywanie...' : 'Zapisz ustawienia'}
        </button>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </form>
    </section>
  )
}
