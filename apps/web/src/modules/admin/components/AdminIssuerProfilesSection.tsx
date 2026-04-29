import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Star, Download } from 'lucide-react'
import {
  CreateIssuerProfileSchema,
  type IssuerProfilePublic,
  type CreateIssuerProfileInput,
} from '@lama-stage/shared-types'
import ConfirmationModal from '../../../shared/components/ConfirmationModal'
import {
  apiCreateIssuerProfile,
  apiDeleteIssuerProfile,
  apiListIssuerProfiles,
  apiSetDefaultIssuerProfile,
  apiUpdateIssuerProfile,
} from '../api/issuer-profiles.api'
import { apiNipCompanyLookup } from '../../../shared/api/nip-lookup.api'
import { useAuth } from '../../auth/AuthProvider'
import { AdminCard, AdminCardBody, AdminCardHeader, AdminPanel, AdminPanelBody, AdminPanelHeader } from './AdminSurface'

const emptyForm = (): CreateIssuerProfileInput & { profileKey?: string } => ({
  profileKey: '',
  companyName: '',
  address: '',
  nip: '',
  email: '',
  phone: '',
})

function normalizeProfileKey(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function profileToForm(p: IssuerProfilePublic): CreateIssuerProfileInput & { profileKey?: string } {
  return {
    profileKey: p.profileKey,
    companyName: p.companyName,
    address: p.address,
    nip: p.nip,
    email: p.email,
    phone: p.phone ?? '',
  }
}

export const ISSUER_PROFILES_QUERY_KEY = ['issuer-profiles'] as const

export default function AdminIssuerProfilesSection() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('admin.users.write')
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: ISSUER_PROFILES_QUERY_KEY,
    queryFn: () => apiListIssuerProfiles(1, 200),
    enabled: hasPermission('admin.users.read'),
  })

  const [editing, setEditing] = useState<IssuerProfilePublic | 'new' | null>(null)
  const [form, setForm] = useState(() => emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IssuerProfilePublic | null>(null)

  useEffect(() => {
    if (editing === null) return
    if (editing === 'new') {
      setForm(emptyForm())
    } else {
      setForm(profileToForm(editing))
    }
    setFormError(null)
  }, [editing])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ISSUER_PROFILES_QUERY_KEY })

  const createMut = useMutation({
    mutationFn: () => {
      const normalizedKey = normalizeProfileKey(form.profileKey ?? '')
      const body: CreateIssuerProfileInput = {
        ...(normalizedKey ? { profileKey: normalizedKey } : {}),
        companyName: form.companyName.trim(),
        address: form.address.trim(),
        nip: form.nip.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() || undefined,
      }
      const parsed = CreateIssuerProfileSchema.safeParse(body)
      if (!parsed.success) {
        return Promise.reject(new Error('Uzupełnij wymagane pola.'))
      }
      return apiCreateIssuerProfile(parsed.data)
    },
    onSuccess: async () => {
      setEditing(null)
      await invalidate()
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMut = useMutation({
    mutationFn: () => {
      if (editing == null || editing === 'new') return Promise.reject()
      return apiUpdateIssuerProfile(editing.id, {
        companyName: form.companyName.trim(),
        address: form.address.trim(),
        nip: form.nip.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() || undefined,
      })
    },
    onSuccess: async () => {
      setEditing(null)
      await invalidate()
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => apiSetDefaultIssuerProfile(id),
    onSuccess: () => invalidate(),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDeleteIssuerProfile(id),
    onSuccess: async () => {
      setDeleteTarget(null)
      await invalidate()
    },
  })

  const nipFetchMut = useMutation({
    mutationFn: () => apiNipCompanyLookup(form.nip),
    onSuccess: (data) => {
      setForm((f) => ({
        ...f,
        companyName: data.companyName,
        address: data.address,
        nip: data.nip,
      }))
      setFormError(null)
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: { message?: string } } } }
      const msg = ax?.response?.data?.error?.message
      setFormError(msg ?? 'Nie udało się pobrać danych po NIP.')
    },
  })

  const rows = listQuery.data?.data ?? []
  const busy =
    createMut.isPending ||
    updateMut.isPending ||
    deleteMut.isPending ||
    setDefaultMut.isPending ||
    nipFetchMut.isPending

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (editing === 'new') createMut.mutate()
    else if (editing !== null) updateMut.mutate()
  }

  if (!hasPermission('admin.users.read')) return null

  return (
    <AdminPanel>
      <AdminPanelHeader
        title="Profile firmy (wystawca dokumentow)"
        description="Wspolne zrodlo danych dla oferty i dokumentow. Domyslny profil trafia do nowych ofert."
      />
      <AdminPanelBody>

      {listQuery.isLoading && <div className="text-sm text-muted-foreground">Ładowanie profili…</div>}
      {listQuery.isError && (
        <div className="text-xs text-destructive">Nie udało się pobrać profili. Sprawdź API i sesję.</div>
      )}

      {!listQuery.isLoading && !listQuery.isError && (
        <ul className="space-y-1.5 mb-3">
          {rows.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 py-1.5 px-2 rounded border border-border/80 bg-background/50"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  {p.companyName}
                  {p.isDefault && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                      Domyślny
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">{p.profileKey}</div>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1 flex-wrap">
                  {!p.isDefault && (
                    <button
                      type="button"
                      title="Ustaw jako domyślny"
                      disabled={busy}
                      onClick={() => setDefaultMut.mutate(p.id)}
                      className="p-1.5 rounded hover:bg-surface-2 text-amber-500"
                    >
                      <Star size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Edytuj"
                    disabled={busy}
                    onClick={() => setEditing(p)}
                    className="p-1.5 rounded hover:bg-surface-2"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    title="Usuń"
                    disabled={busy || rows.length <= 1}
                    onClick={() => setDeleteTarget(p)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-red-600 disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && editing == null && (
        <button
          type="button"
          onClick={() => setEditing('new')}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-border rounded text-sm hover:bg-surface-2"
        >
          <Plus size={18} />
          Dodaj profil
        </button>
      )}

      {canManage && editing != null && (
        <AdminCard className="mt-3 border-primary/40">
          <AdminCardHeader title={editing === 'new' ? 'Nowy profil' : 'Edycja profilu'} />
          <AdminCardBody>
            <form onSubmit={submit} className="space-y-2">
            {formError && <div className="text-xs text-red-600">{formError}</div>}
          {editing === 'new' && (
            <label className="block text-xs">
              Klucz (opcjonalny, unikalny)
              <input
                value={form.profileKey ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, profileKey: e.target.value }))}
                onBlur={() =>
                  setForm((f) => ({ ...f, profileKey: normalizeProfileKey(f.profileKey ?? '') }))
                }
                placeholder="np. LAMA_STAGE — puste = wygeneruj automatycznie"
                className="mt-0.5 w-full px-2 py-1 text-sm bg-background border border-border rounded font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Dozwolone znaki: litery/cyfry/_. Spacje i polskie znaki zostaną zamienione na <span className="font-mono">_</span>.
              </p>
            </label>
          )}
          <label className="block text-xs">
            Nazwa firmy
            <input
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              className="mt-0.5 w-full px-2 py-1 text-sm bg-background border border-border rounded"
              required
            />
          </label>
          <label className="block text-xs">
            Adres
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="mt-0.5 w-full px-2 py-1 text-sm bg-background border border-border rounded"
              required
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="block text-xs">
              <span className="block">NIP</span>
              <div className="mt-0.5 flex gap-1">
                <input
                  value={form.nip}
                  onChange={(e) => setForm((f) => ({ ...f, nip: e.target.value }))}
                  className="flex-1 min-w-0 px-2 py-1 text-sm bg-background border border-border rounded"
                  placeholder="10 cyfr"
                  required
                />
                <button
                  type="button"
                  title="Pobierz nazwę i adres z GUS (DataPort.pl)"
                  disabled={busy}
                  onClick={() => nipFetchMut.mutate()}
                  className="shrink-0 px-2 py-1 text-xs border border-border rounded hover:bg-surface-2 flex items-center gap-1 whitespace-nowrap"
                >
                  <Download size={14} />
                  Pobierz
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                E-mailu nie ma w tym źródle — uzupełnij poniżej ręcznie.
              </p>
            </div>
            <label className="block text-xs">
              Telefon
              <input
                value={form.phone ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-0.5 w-full px-2 py-1 text-sm bg-background border border-border rounded"
              />
            </label>
          </div>
          <label className="block text-xs">
            E-mail
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="mt-0.5 w-full px-2 py-1 text-sm bg-background border border-border rounded"
              required
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
              {editing === 'new' ? 'Utwórz' : 'Zapisz'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={busy}
              className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-2"
            >
              Anuluj
            </button>
          </div>
            </form>
          </AdminCardBody>
        </AdminCard>
      )}

      <ConfirmationModal
        isOpen={deleteTarget != null}
        title="Usunąć profil?"
        message={
          deleteTarget
            ? `Profil „${deleteTarget.companyName}” zostanie usunięty. Operacji nie cofniesz.`
            : ''
        }
        confirmLabel="Usuń"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
      />
      </AdminPanelBody>
    </AdminPanel>
  )
}
