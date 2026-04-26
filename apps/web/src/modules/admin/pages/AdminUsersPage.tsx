import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { PERMISSIONS, Permission, UserPublic } from '@lama-stage/shared-types'
import ConfirmationModal from '../../../shared/components/ConfirmationModal'
import {
  apiAdminResetPassword,
  apiAssignUserRole,
  apiCreateRole,
  apiDeactivateUser,
  apiDeleteRole,
  apiDownloadDatabaseBackup,
  apiInviteUser,
  apiListAuditLogs,
  apiListRoles,
  apiListUsers,
  apiUpdateRole,
} from '../../auth/auth.api'
import { useAuth } from '../../auth/AuthProvider'
import { formatRoleLabel } from '../../../lib/roleLabels'
import { financeApi } from '../../orders/api/pdf.api'
import AdminIssuerProfilesSection from '../components/AdminIssuerProfilesSection'
import AdminAppSettingsSection from '../components/AdminAppSettingsSection'
import { apiGetAppSettings, apiUpdateAppSettings } from '../../auth/auth.api'
import { api } from '../../../shared/api/client'

type TransportRangeDraft = {
  fromKm: number
  toKm: number
  flatNet: number
}

type TransportSettingsDraft = {
  ranges: TransportRangeDraft[]
  longDistancePerKm: number
}

type ProjectContactDraft = { id: string; name: string; phone?: string | null; email?: string | null }

const DEFAULT_TRANSPORT_DRAFT: TransportSettingsDraft = {
  ranges: [
    { fromKm: 0, toKm: 50, flatNet: 150 },
    { fromKm: 50, toKm: 100, flatNet: 250 },
  ],
  longDistancePerKm: 1.15,
}

function normalizeRanges(ranges: TransportRangeDraft[]) {
  return [...ranges]
    .map((row) => ({
      fromKm: Number(row.fromKm) || 0,
      toKm: Number(row.toKm) || 0,
      flatNet: Number(row.flatNet) || 0,
    }))
    .sort((a, b) => a.fromKm - b.fromKm)
}

function validateRanges(ranges: TransportRangeDraft[]) {
  if (ranges.length === 0) return 'Dodaj co najmniej jeden przedział.'
  const firstRow = ranges[0]
  if (!firstRow || firstRow.fromKm !== 0) return 'Pierwszy przedział musi zaczynać się od 0 km.'

  for (let i = 0; i < ranges.length; i += 1) {
    const row = ranges[i]
    if (!row) return `Wiersz ${i + 1}: brak danych.`
    if (row.toKm <= row.fromKm) return `Wiersz ${i + 1}: "do km" musi być większe od "od km".`
    if (row.flatNet < 0) return `Wiersz ${i + 1}: stawka nie może być ujemna.`
    const next = ranges[i + 1]
    if (next && row.toKm !== next.fromKm) {
      return `Wiersz ${i + 2}: "od km" musi być równe "do km" poprzedniego wiersza.`
    }
  }

  return null
}

export default function AdminUsersPage() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFullName, setInviteFullName] = useState('')
  const [inviteRole, setInviteRole] = useState('OPERATOR_FULL')
  const [deactivateTarget, setDeactivateTarget] = useState<UserPublic | null>(null)
  const [newRoleKey, setNewRoleKey] = useState('')
  const [newRoleDisplayName, setNewRoleDisplayName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')
  const [newRolePermissions, setNewRolePermissions] = useState<Permission[]>([])
  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<Permission[]>([])
  const [roleDeleteTarget, setRoleDeleteTarget] = useState<string | null>(null)
  const [transportDraft, setTransportDraft] = useState<TransportSettingsDraft>(DEFAULT_TRANSPORT_DRAFT)
  const [transportError, setTransportError] = useState<string | null>(null)
  const [warehouseQuery, setWarehouseQuery] = useState('')
  const [warehouseSuggestions, setWarehouseSuggestions] = useState<Array<{ placeId: string; description: string }>>([])
  const [warehouseLoading, setWarehouseLoading] = useState(false)
  const [warehouseAddress, setWarehouseAddress] = useState<string>('')
  const [projectContacts, setProjectContacts] = useState<ProjectContactDraft[]>([])
  const [defaultProjectContactId, setDefaultProjectContactId] = useState<string>('')
  const [projectContactsError, setProjectContactsError] = useState<string | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'branding' | 'documents' | 'backup'>('users')

  const canReadUsers = hasPermission('admin.users.read')
  const canReadAudit = hasPermission('admin.audit.read')
  const canReadRoles = hasPermission('admin.roles.read')
  const canManageUsers = hasPermission('admin.users.write')
  const canManageRoles = hasPermission('admin.roles.write')
  const canBackup = hasPermission('admin.backup')

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiListUsers(1, 100),
    enabled: canReadUsers,
  })
  const auditQuery = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => apiListAuditLogs(1, 200),
    enabled: canReadAudit,
  })
  const rolesQuery = useQuery({
    queryKey: ['admin-roles'],
    queryFn: apiListRoles,
    enabled: canReadRoles,
  })

  const inviteMutation = useMutation({
    mutationFn: () => apiInviteUser(inviteEmail, inviteRole, inviteFullName || undefined),
    onSuccess: async () => {
      setInviteEmail('')
      setInviteFullName('')
      setInviteRole('OPERATOR_FULL')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      ])
    },
  })

  const resetMutation = useMutation({
    mutationFn: (userId: string) => apiAdminResetPassword(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => apiDeactivateUser(userId),
    onSuccess: async () => {
      setDeactivateTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] }),
      ])
    },
  })
  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => apiAssignUserRole(userId, role),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] }),
      ])
    },
  })
  const createRoleMutation = useMutation({
    mutationFn: () => apiCreateRole({
      roleKey: newRoleKey.trim().toUpperCase(),
      displayName: newRoleDisplayName.trim(),
      description: newRoleDescription.trim() || undefined,
      permissions: newRolePermissions,
    }),
    onSuccess: async () => {
      setNewRoleKey('')
      setNewRoleDisplayName('')
      setNewRoleDescription('')
      setNewRolePermissions([])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-roles'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] }),
      ])
    },
  })
  const updateRoleMutation = useMutation({
    mutationFn: ({ roleKey, permissions }: { roleKey: string; permissions: Permission[] }) => apiUpdateRole(roleKey, { permissions }),
    onSuccess: async () => {
      setEditingRoleKey(null)
      setEditingPermissions([])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-roles'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] }),
      ])
    },
  })
  const deleteRoleMutation = useMutation({
    mutationFn: (roleKey: string) => apiDeleteRole(roleKey),
    onSuccess: async () => {
      setRoleDeleteTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-roles'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] }),
      ])
    },
  })
  const auditRows = useMemo(() => auditQuery.data?.data || [], [auditQuery.data])
  const transportSettingsQuery = useQuery({
    queryKey: ['transport-pricing-settings'],
    queryFn: financeApi.getTransportPricingSettings,
  })
  const appSettingsQuery = useQuery({
    queryKey: ['admin-app-settings'],
    queryFn: apiGetAppSettings,
  })
  const appSettingsMutation = useMutation({
    mutationFn: apiUpdateAppSettings,
    onSuccess: async (updated) => {
      setWarehouseAddress(updated.warehouseAddress ?? '')
      await queryClient.invalidateQueries({ queryKey: ['admin-app-settings'] })
    },
  })
  const transportSettingsMutation = useMutation({
    mutationFn: financeApi.updateTransportPricingSettings,
    onSuccess: async (data) => {
      setTransportDraft({
        ranges: data.ranges,
        longDistancePerKm: data.longDistancePerKm,
      })
      setTransportError(null)
      await queryClient.invalidateQueries({ queryKey: ['transport-pricing-settings'] })
    },
  })


  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data])
  const roles = useMemo(() => rolesQuery.data?.data || [], [rolesQuery.data])

  useEffect(() => {
    const data = transportSettingsQuery.data
    if (!data) return
    setTransportDraft({
      ranges: data.ranges,
      longDistancePerKm: data.longDistancePerKm,
    })
  }, [transportSettingsQuery.data])

  useEffect(() => {
    const s = appSettingsQuery.data
    if (!s) return
    setWarehouseAddress(s.warehouseAddress ?? '')
    const list = (s.projectContacts ?? []) as ProjectContactDraft[]
    setProjectContacts(Array.isArray(list) ? list : [])
    setDefaultProjectContactId(s.defaultProjectContactId ?? '')
  }, [appSettingsQuery.data])

  useEffect(() => {
    const q = (warehouseQuery || '').trim()
    if (q.length < 2) {
      setWarehouseSuggestions([])
      setWarehouseLoading(false)
      return
    }
    const t = setTimeout(async () => {
      try {
        setWarehouseLoading(true)
        const res = await api.get<{ data: Array<{ placeId: string; description: string }> }>('/places/autocomplete', { query: q })
        setWarehouseSuggestions((res.data ?? []).map((x) => ({ placeId: x.placeId, description: x.description })))
      } catch {
        setWarehouseSuggestions([])
      } finally {
        setWarehouseLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [warehouseQuery])

  const handleInvite = (e: FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    inviteMutation.mutate()
  }

  const inviteErrorMessage = (() => {
    const err = inviteMutation.error
    if (!err) return null
    if (isAxiosError(err)) {
      if (err.code === 'ECONNABORTED') {
        return 'Serwer nie odpowiedział na czas (często wolny lub zablokowany SMTP). Sprawdź SMTP_HOST / port i firewall na VPS.'
      }
      const msg = err.response?.data && typeof err.response.data === 'object' && err.response.data !== null && 'error' in err.response.data
        ? (err.response.data as { error?: { message?: string } }).error?.message
        : undefined
      return msg || err.message
    }
    return err instanceof Error ? err.message : 'Nie udało się wysłać zaproszenia.'
  })()

  const togglePermission = (perm: Permission, list: Permission[], setter: (next: Permission[]) => void) => {
    if (list.includes(perm)) setter(list.filter((p) => p !== perm))
    else setter([...list, perm])
  }

  return (
    <div className="space-y-5">
      <section className="bg-card border border-border rounded-lg p-4">
        <h1 className="text-lg font-semibold mb-1">Ustawienia administratora</h1>
        <p className="text-sm text-muted-foreground">Zarządzaj dostępami, danymi firmy, dokumentami i backupami tej instancji.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveTab('users')} className={`px-3 py-1.5 text-xs rounded border ${activeTab === 'users' ? 'bg-surface border-primary text-primary' : 'border-border text-muted-foreground'}`}>Użytkownicy i role</button>
          <button type="button" onClick={() => setActiveTab('branding')} className={`px-3 py-1.5 text-xs rounded border ${activeTab === 'branding' ? 'bg-surface border-primary text-primary' : 'border-border text-muted-foreground'}`}>Firma i branding</button>
          <button type="button" onClick={() => setActiveTab('documents')} className={`px-3 py-1.5 text-xs rounded border ${activeTab === 'documents' ? 'bg-surface border-primary text-primary' : 'border-border text-muted-foreground'}`}>Dokumenty i komunikacja</button>
          <button type="button" onClick={() => setActiveTab('backup')} className={`px-3 py-1.5 text-xs rounded border ${activeTab === 'backup' ? 'bg-surface border-primary text-primary' : 'border-border text-muted-foreground'}`}>Backup i odtwarzanie</button>
        </div>
      </section>

      {activeTab === 'branding' && <AdminAppSettingsSection />}
      {activeTab === 'documents' && <AdminIssuerProfilesSection />}

      {canBackup && activeTab === 'backup' && (
      <section className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Backup bazy danych</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Pobierz pełną kopię bazy PostgreSQL dla tej firmy. Zachowaj kopię w bezpiecznym miejscu przed wdrożeniem i testami.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              setBackupError(null)
              try {
                await apiDownloadDatabaseBackup()
              } catch (e) {
                setBackupError((e as Error)?.message ?? 'Nie udało się pobrać backupu.')
              }
            }}
            className="bg-primary text-black rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            Pobierz backup bazy (.dump)
          </button>
        </div>
        {backupError && <p className="text-xs text-destructive mt-2">{backupError}</p>}
      </section>
      )}

      {activeTab === 'documents' && (
      <section className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Ustawienia transportu (globalne)</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Te wartości są używane do automatycznej wyceny transportu we wszystkich nowych i edytowanych zleceniach.
        </p>
        <div className="mb-4 border border-border rounded p-3 bg-surface-2/20 space-y-2">
          <div className="text-xs font-semibold">Siedziba magazynu (punkt startowy do km)</div>
          <div className="relative">
            <input
              value={warehouseQuery || warehouseAddress}
              onChange={(e) => {
                setWarehouseQuery(e.target.value)
                setWarehouseAddress(e.target.value)
              }}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              placeholder="Wpisz adres i wybierz z podpowiedzi Google"
            />
            {warehouseLoading ? (
              <div className="absolute right-3 top-2.5 text-xs text-muted-foreground">Ładowanie…</div>
            ) : null}
            {warehouseSuggestions.length > 0 && (
              <div className="absolute z-30 mt-1 w-full bg-card border border-border rounded shadow-lg max-h-56 overflow-auto">
                {warehouseSuggestions.map((s) => (
                  <button
                    key={s.placeId}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2"
                    onClick={() => {
                      setWarehouseAddress(s.description)
                      setWarehouseQuery('')
                      setWarehouseSuggestions([])
                    }}
                  >
                    {s.description}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => appSettingsMutation.mutate({ warehouseAddress })}
              disabled={appSettingsMutation.isPending}
              className="px-3 py-2 text-sm border border-border rounded hover:bg-surface disabled:opacity-50"
            >
              {appSettingsMutation.isPending ? 'Zapisywanie…' : 'Zapisz siedzibę magazynu'}
            </button>
            {appSettingsQuery.isLoading ? <span className="text-xs text-muted-foreground">Ładowanie…</span> : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            To ustawienie jest używane do obliczania km (Google Distance Matrix) dla transportu w zleceniach.
          </p>
        </div>
        <div className="mb-4 border border-border rounded p-3 bg-surface-2/20 space-y-2">
          <div className="text-xs font-semibold">Opiekunowie projektu (PDF)</div>
          <p className="text-[11px] text-muted-foreground">
            Dane widoczne w stopce PDF jako „Opiekun projektu”. Możesz dodać kilku opiekunów i wybrać domyślnego dla tej firmy.
          </p>
          <div className="space-y-2">
            {projectContacts.map((c, idx) => (
              <div key={c.id} className="grid md:grid-cols-[24px_1fr_1fr_1fr_80px] gap-2 items-start">
                <div className="pt-2 flex justify-center">
                  <input
                    type="radio"
                    name="default-project-contact"
                    checked={defaultProjectContactId === c.id}
                    onChange={() => setDefaultProjectContactId(c.id)}
                  />
                </div>
                <input
                  value={c.name}
                  onChange={(e) =>
                    setProjectContacts((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row))
                    )
                  }
                  className="bg-surface border border-border rounded px-3 py-2 text-sm"
                  placeholder="Imię i nazwisko"
                />
                <input
                  value={c.phone ?? ''}
                  onChange={(e) =>
                    setProjectContacts((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, phone: e.target.value || null } : row))
                    )
                  }
                  className="bg-surface border border-border rounded px-3 py-2 text-sm"
                  placeholder="Telefon (opcjonalnie)"
                />
                <input
                  value={c.email ?? ''}
                  onChange={(e) =>
                    setProjectContacts((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, email: e.target.value || null } : row))
                    )
                  }
                  className="bg-surface border border-border rounded px-3 py-2 text-sm"
                  placeholder="E-mail (opcjonalnie)"
                />
                <button
                  type="button"
                  className="px-3 py-2 text-xs border border-border rounded hover:bg-surface"
                  onClick={() => {
                    setProjectContacts((prev) => prev.filter((_, i) => i !== idx))
                    if (defaultProjectContactId === c.id) setDefaultProjectContactId('')
                  }}
                >
                  Usuń
                </button>
              </div>
            ))}
            <button
              type="button"
              className="px-3 py-2 text-xs border border-dashed border-border rounded hover:bg-surface w-fit"
              onClick={() => {
                const id = `C${Date.now()}`
                setProjectContacts((prev) => [...prev, { id, name: '', phone: null, email: null }])
                if (!defaultProjectContactId) setDefaultProjectContactId(id)
              }}
            >
              + Dodaj opiekuna
            </button>
          </div>
          {projectContactsError ? <div className="text-xs text-destructive">{projectContactsError}</div> : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setProjectContactsError(null)
                const cleaned = projectContacts
                  .map((c) => ({
                    id: String(c.id || '').trim(),
                    name: String(c.name || '').trim(),
                    phone: c.phone ? String(c.phone).trim() : null,
                    email: c.email ? String(c.email).trim() : null,
                  }))
                  .filter((c) => c.id && c.name)
                if (cleaned.length === 0) {
                  appSettingsMutation.mutate({ projectContacts: [], defaultProjectContactId: null })
                  return
                }
                const defaultId = (defaultProjectContactId || cleaned[0]!.id).trim()
                if (!cleaned.some((c) => c.id === defaultId)) {
                  setProjectContactsError('Domyślny opiekun musi być wybrany z listy.')
                  return
                }
                appSettingsMutation.mutate({ projectContacts: cleaned, defaultProjectContactId: defaultId })
              }}
              disabled={appSettingsMutation.isPending}
              className="px-3 py-2 text-sm border border-border rounded hover:bg-surface disabled:opacity-50"
            >
              {appSettingsMutation.isPending ? 'Zapisywanie…' : 'Zapisz opiekunów'}
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[11px] text-muted-foreground">
            <div>Od km</div>
            <div>Do km</div>
            <div>Stawka (PLN)</div>
            <div />
          </div>
          {transportDraft.ranges.map((row, idx) => (
            <div key={`${idx}-${row.fromKm}-${row.toKm}`} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <input
                type="number"
                min={0}
                step={1}
                value={row.fromKm}
                onChange={(e) =>
                  setTransportDraft((prev) => {
                    const ranges = [...prev.ranges]
                    const current = ranges[idx] ?? { fromKm: 0, toKm: 0, flatNet: 0 }
                    ranges[idx] = { ...current, fromKm: Number(e.target.value) || 0 }
                    return { ...prev, ranges }
                  })
                }
                className="bg-surface border border-border rounded px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                step={1}
                value={row.toKm}
                onChange={(e) =>
                  setTransportDraft((prev) => {
                    const ranges = [...prev.ranges]
                    const current = ranges[idx] ?? { fromKm: 0, toKm: 0, flatNet: 0 }
                    ranges[idx] = { ...current, toKm: Number(e.target.value) || 0 }
                    return { ...prev, ranges }
                  })
                }
                className="bg-surface border border-border rounded px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={row.flatNet}
                onChange={(e) =>
                  setTransportDraft((prev) => {
                    const ranges = [...prev.ranges]
                    const current = ranges[idx] ?? { fromKm: 0, toKm: 0, flatNet: 0 }
                    ranges[idx] = { ...current, flatNet: Number(e.target.value) || 0 }
                    return { ...prev, ranges }
                  })
                }
                className="bg-surface border border-border rounded px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={transportDraft.ranges.length <= 1}
                onClick={() =>
                  setTransportDraft((prev) => ({
                    ...prev,
                    ranges: prev.ranges.filter((_, i) => i !== idx),
                  }))
                }
                className="px-3 py-2 text-xs border border-border rounded hover:bg-surface disabled:opacity-50"
              >
                Usuń
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setTransportDraft((prev) => {
                const sorted = normalizeRanges(prev.ranges)
                const lastToKm = sorted[sorted.length - 1]?.toKm ?? 0
                return {
                  ...prev,
                  ranges: [...sorted, { fromKm: lastToKm, toKm: lastToKm + 50, flatNet: 0 }],
                }
              })
            }
            className="px-3 py-2 text-xs border border-border rounded hover:bg-surface w-fit"
          >
            + Dodaj przedział
          </button>

          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Stawka kilometrówki (PLN/km)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={transportDraft.longDistancePerKm}
              onChange={(e) => setTransportDraft((prev) => ({ ...prev, longDistancePerKm: Number(e.target.value) || 0 }))}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
            />
          </label>
          <div className="text-[11px] text-muted-foreground">
            Kilometrówka jest liczona od końca najwyższego przedziału w górę (km x 2 x stawka).
          </div>
          {transportError && <div className="text-xs text-destructive">{transportError}</div>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const normalized = normalizeRanges(transportDraft.ranges)
              const validationError = validateRanges(normalized)
              if (validationError) {
                setTransportError(validationError)
                return
              }
              setTransportError(null)
              transportSettingsMutation.mutate({
                ranges: normalized,
                longDistancePerKm: transportDraft.longDistancePerKm,
              })
            }}
            className="bg-primary text-black rounded px-3 py-2 text-sm disabled:opacity-50"
            disabled={transportSettingsMutation.isPending}
          >
            {transportSettingsMutation.isPending ? 'Zapisywanie...' : 'Zapisz ustawienia transportu'}
          </button>
          {transportSettingsQuery.isLoading && <span className="text-xs text-muted-foreground">Ładowanie...</span>}
          {transportSettingsQuery.isError && (
            <span className="text-xs text-destructive">Brak dostępu do ustawień transportu.</span>
          )}
        </div>
      </section>
      )}

      {activeTab === 'users' && (
      <section className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Zaproś użytkownika</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Nowe konto pojawi się na liście dopiero po otwarciu linku z maila i ustawieniu hasła.
        </p>
        <form onSubmit={handleInvite} className="grid md:grid-cols-4 gap-2">
          <input
            type="email"
            placeholder="E-mail"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="bg-surface border border-border rounded px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            placeholder="Imię i nazwisko (opcjonalnie)"
            value={inviteFullName}
            onChange={(e) => setInviteFullName(e.target.value)}
            className="bg-surface border border-border rounded px-3 py-2 text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="bg-surface border border-border rounded px-3 py-2 text-sm"
          >
            {roles.map((role) => (
              <option key={role.roleKey} value={role.roleKey}>{role.roleKey}</option>
            ))}
          </select>
          <button className="bg-primary text-black rounded px-3 py-2 text-sm disabled:opacity-50" disabled={!canManageUsers || inviteMutation.isPending}>
            {inviteMutation.isPending ? 'Wysyłanie...' : 'Wyślij zaproszenie'}
          </button>
        </form>
        {inviteMutation.isError && inviteErrorMessage ? (
          <p className="text-xs text-destructive mt-2">{inviteErrorMessage}</p>
        ) : null}
      </section>
      )}

      {activeTab === 'users' && (
      <section className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
        <h2 className="text-sm font-semibold mb-3">Lista użytkowników</h2>
        {usersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Ładowanie...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="py-2">E-mail</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Nazwa i rola</th>
                <th className="py-2 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="py-2">
                    <div className="text-muted-foreground">{u.email}</div>
                    {u.username ? <div className="text-xs text-muted-foreground/80">{u.username}</div> : null}
                  </td>
                  <td className="py-2">{u.isActive ? 'Aktywne' : 'Nieaktywne'}</td>
                  <td className="py-2 text-right align-top">
                    <div className="font-medium">{u.fullName || u.username || '—'}</div>
                    <div className="text-xs text-muted-foreground">{formatRoleLabel(u.role)}</div>
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => resetMutation.mutate(u.id)}
                        className="px-2 py-1 text-xs border border-border rounded hover:bg-surface disabled:opacity-50"
                        disabled={!canManageUsers || resetMutation.isPending || !u.isActive}
                      >
                        Reset hasła
                      </button>
                      <select
                        className="px-2 py-1 text-xs border border-border rounded bg-surface"
                        value={u.role}
                        onChange={(e) => assignRoleMutation.mutate({ userId: u.id, role: e.target.value })}
                        disabled={!canManageUsers || assignRoleMutation.isPending}
                      >
                        {roles.map((role) => (
                          <option key={role.roleKey} value={role.roleKey}>{role.roleKey}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setDeactivateTarget(u)}
                        className="px-2 py-1 text-xs border border-destructive/40 text-destructive rounded hover:bg-destructive/10 disabled:opacity-50"
                        disabled={!canManageUsers || deactivateMutation.isPending || !u.isActive}
                      >
                        Usuń
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      )}

      {canReadRoles && activeTab === 'users' && (
      <section className="bg-card border border-border rounded-lg p-4 overflow-x-auto space-y-4">
        <h2 className="text-sm font-semibold">Role i uprawnienia (edytowalne)</h2>
        <div className="grid md:grid-cols-3 gap-2">
          <input
            value={newRoleKey}
            onChange={(e) => setNewRoleKey(e.target.value.toUpperCase())}
            placeholder="ROLE_KEY"
            className="bg-surface border border-border rounded px-3 py-2 text-sm"
          />
          <input
            value={newRoleDisplayName}
            onChange={(e) => setNewRoleDisplayName(e.target.value)}
            placeholder="Nazwa roli"
            className="bg-surface border border-border rounded px-3 py-2 text-sm"
          />
          <input
            value={newRoleDescription}
            onChange={(e) => setNewRoleDescription(e.target.value)}
            placeholder="Opis (opcjonalnie)"
            className="bg-surface border border-border rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          {PERMISSIONS.map((perm) => (
            <label key={perm} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={newRolePermissions.includes(perm)}
                onChange={() => togglePermission(perm, newRolePermissions, setNewRolePermissions)}
              />
              <span>{perm}</span>
            </label>
          ))}
        </div>
        <button
          className="bg-primary text-black rounded px-3 py-2 text-sm disabled:opacity-50"
          onClick={() => createRoleMutation.mutate()}
          disabled={!canManageRoles || createRoleMutation.isPending || !newRoleKey || !newRoleDisplayName || newRolePermissions.length === 0}
        >
          {createRoleMutation.isPending ? 'Tworzenie...' : 'Utwórz rolę'}
        </button>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="py-2">Role key</th>
              <th className="py-2">Nazwa</th>
              <th className="py-2">Uprawnienia</th>
              <th className="py-2 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.roleKey} className="border-b border-border/60 align-top">
                <td className="py-2">{role.roleKey}</td>
                <td className="py-2">
                  <div className="font-medium">{role.displayName}</div>
                  <div className="text-xs text-muted-foreground">{role.description || '-'}</div>
                </td>
                <td className="py-2">
                  {editingRoleKey === role.roleKey ? (
                    <div className="grid md:grid-cols-2 gap-1">
                      {PERMISSIONS.map((perm) => (
                        <label key={perm} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editingPermissions.includes(perm)}
                            onChange={() => togglePermission(perm, editingPermissions, setEditingPermissions)}
                          />
                          <span>{perm}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground break-words">{role.permissions.join(', ')}</div>
                  )}
                </td>
                <td className="py-2">
                  <div className="flex justify-end gap-2">
                    {editingRoleKey === role.roleKey ? (
                      <>
                        <button
                          className="px-2 py-1 text-xs border border-border rounded hover:bg-surface"
                          onClick={() => setEditingRoleKey(null)}
                        >
                          Anuluj
                        </button>
                        <button
                          className="px-2 py-1 text-xs bg-primary text-black rounded disabled:opacity-50"
                          onClick={() => updateRoleMutation.mutate({ roleKey: role.roleKey, permissions: editingPermissions })}
                          disabled={updateRoleMutation.isPending || editingPermissions.length === 0}
                        >
                          Zapisz
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="px-2 py-1 text-xs border border-border rounded hover:bg-surface disabled:opacity-50"
                          onClick={() => {
                            setEditingRoleKey(role.roleKey)
                            setEditingPermissions(role.permissions)
                          }}
                          disabled={!canManageRoles || role.isSystem}
                        >
                          Edytuj
                        </button>
                        <button
                          className="px-2 py-1 text-xs border border-destructive/40 text-destructive rounded hover:bg-destructive/10 disabled:opacity-50"
                          onClick={() => setRoleDeleteTarget(role.roleKey)}
                          disabled={!canManageRoles || role.isSystem}
                        >
                          Usuń
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      )}

      {canReadAudit && activeTab === 'users' && (
      <section className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
        <h2 className="text-sm font-semibold mb-3">Audit logi (akcje Admin)</h2>
        {auditQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Ładowanie logów...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="py-2">Czas</th>
                <th className="py-2">Admin</th>
                <th className="py-2">Akcja</th>
                <th className="py-2">Cel</th>
                <th className="py-2">Wynik</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2 whitespace-nowrap">{new Date(row.createdAt).toLocaleString('pl-PL')}</td>
                  <td className="py-2">{row.actorEmail}</td>
                  <td className="py-2">
                    <div className="font-medium">{row.action}</div>
                    <div className="text-xs text-muted-foreground">{row.module}</div>
                  </td>
                  <td className="py-2 text-xs">
                    <div>{row.targetType || '-'}</div>
                    <div className="text-muted-foreground">{row.targetId || '-'}</div>
                  </td>
                  <td className={`py-2 ${row.result === 'SUCCESS' ? 'text-primary' : 'text-destructive'}`}>{row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      )}

      <ConfirmationModal
        isOpen={!!deactivateTarget}
        title="Dezaktywować użytkownika?"
        message={deactivateTarget ? `Użytkownik ${deactivateTarget.email} straci dostęp do systemu.` : ''}
        confirmLabel="Dezaktywuj"
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => {
          if (deactivateTarget) {
            deactivateMutation.mutate(deactivateTarget.id)
          }
        }}
      />
      <ConfirmationModal
        isOpen={!!roleDeleteTarget}
        title="Usunąć rolę?"
        message={roleDeleteTarget ? `Rola ${roleDeleteTarget} zostanie usunięta.` : ''}
        confirmLabel="Usuń rolę"
        onClose={() => setRoleDeleteTarget(null)}
        onConfirm={() => {
          if (roleDeleteTarget) {
            deleteRoleMutation.mutate(roleDeleteTarget)
          }
        }}
      />
    </div>
  )
}
