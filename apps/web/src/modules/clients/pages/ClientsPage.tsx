import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useClients, useDeleteClient } from '../hooks/useClients'
import ClientFormModal from '../components/ClientFormModal'
import { useState, useEffect, useMemo } from 'react'
import { SortableTh } from '../../../shared/components/SortableTh'
import { clientApi } from '../api/client.api'

export default function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [searchTerm, setSearchTerm] = useState('')
  const { data: paginatedClients, isLoading, error } = useClients({ page: 1, limit: 500, search: searchTerm })
  const deleteMutation = useDeleteClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<any>(null)

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    clientApi.getById(editId).then((client) => {
      if (!cancelled && client) {
        setEditingClient(client)
        setIsModalOpen(true)
        setSearchParams({}, { replace: true })
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [editId, setSearchParams])

  const clientsRaw = paginatedClients?.data ?? []

  const [sortBy, setSortBy] = useState<string>('companyName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const toggleSort = (key: string) => {
    setSortBy(key)
    setSortDir((d) => (sortBy === key ? (d === 'asc' ? 'desc' : 'asc') : 'asc'))
  }
  const clients = useMemo(() => {
    const list = [...clientsRaw]
    const mult = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortBy === 'companyName') return mult * (a.companyName || '').localeCompare(b.companyName || '')
      if (sortBy === 'contactName') return mult * (a.contactName || '').localeCompare(b.contactName || '')
      if (sortBy === 'email') return mult * (a.email || '').localeCompare(b.email || '')
      if (sortBy === 'address') return mult * (a.address || '').localeCompare(b.address || '')
      return 0
    })
    return list
  }, [clientsRaw, sortBy, sortDir])

  const handleEdit = (client: any) => {
    setEditingClient(client)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć tego klienta? Wszystkie powiązane zlecenia zostaną zachowane, ale stracą przypisanie do klienta.')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Ładowanie klientów...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-red-500">Błąd ładowania klientów: {(error as Error).message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Klienci</h1>
        <button
          onClick={() => {
            setEditingClient(null)
            setIsModalOpen(true)
          }}
          className="px-3 py-1.5 border-2 border-primary text-primary bg-transparent text-sm rounded hover:bg-primary/10 transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Nowy klient
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Szukaj po nazwie, NIP, email lub telefonie..."
            className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setSearchTerm('')}
          className="px-2.5 py-1.5 border border-border rounded text-sm hover:bg-surface-2 transition-colors"
        >
          Wyczyść
        </button>
      </div>

      <div className="border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          {clients.length > 0 ? (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-2 border-b border-border">
                    <SortableTh label="Firma" sortKey="companyName" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Kontakt" sortKey="contactName" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Dane kontaktowe" sortKey="email" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Adres" sortKey="address" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                    <th className="text-left py-2 px-3 font-medium text-sm">Zlecenia</th>
                    <th className="text-left py-2 px-3 font-medium text-sm">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b border-border hover:bg-surface-2/30 transition-colors">
                      <td className="py-2 px-3">
                        <div>
                          <p className="font-medium">{client.companyName}</p>
                          {client.nip && (
                            <p className="text-xs text-muted-foreground">NIP: {client.nip}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-sm">{client.contactName || '—'}</span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-sm space-y-0.5">
                          <div>{client.email || '—'}</div>
                          <div className="text-muted-foreground">{client.phone || '—'}</div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-sm truncate max-w-[200px] block">{client.address || '—'}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-sm">0 zleceń</span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEdit(client)}
                            className="text-primary hover:text-primary-hover p-1"
                            title="Edytuj"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="text-red-500 hover:text-red-600 p-1"
                            title="Usuń"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm
                ? 'Brak klientów spełniających kryteria. Zmień wyszukiwanie.'
                : 'Brak klientów. Kliknij "Nowy klient", aby dodać.'}
            </div>
          )}
        </div>
      </div>

      <ClientFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingClient(null)
        }}
        client={editingClient}
      />
    </div>
  )
}