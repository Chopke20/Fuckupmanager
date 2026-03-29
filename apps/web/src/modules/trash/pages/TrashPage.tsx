import { useState } from 'react'
import { RotateCcw, Trash2, ClipboardList, Users, Package, Boxes } from 'lucide-react'
import { useOrders, useRestoreOrder, useDeleteOrderPermanent } from '../../orders/hooks/useOrders'
import { useClients, useRestoreClient, useDeleteClientPermanent } from '../../clients/hooks/useClients'
import { useEquipment, useRestoreEquipment, useDeleteEquipmentPermanent } from '../../equipment/hooks/useEquipment'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

const LIMIT = 500

type TrashTab = 'orders' | 'clients' | 'equipment' | 'resources'

const TABS: { id: TrashTab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'orders', label: 'Zlecenia', icon: ClipboardList },
  { id: 'clients', label: 'Klienci', icon: Users },
  { id: 'equipment', label: 'Sprzęt', icon: Package },
  { id: 'resources', label: 'Zasoby', icon: Boxes },
]

export default function TrashPage() {
  const [activeTab, setActiveTab] = useState<TrashTab>('orders')

  const { data: ordersData, isLoading: ordersLoading } = useOrders({
    deletedOnly: true,
    page: 1,
    limit: LIMIT,
  })
  const { data: clientsData, isLoading: clientsLoading } = useClients({
    deletedOnly: true,
    page: 1,
    limit: LIMIT,
  })
  const { data: equipmentData, isLoading: equipmentLoading } = useEquipment({
    deletedOnly: true,
    page: 1,
    limit: LIMIT,
  })

  const restoreOrder = useRestoreOrder()
  const deleteOrderPerm = useDeleteOrderPermanent()
  const restoreClient = useRestoreClient()
  const deleteClientPerm = useDeleteClientPermanent()
  const restoreEquipment = useRestoreEquipment()
  const deleteEquipmentPerm = useDeleteEquipmentPermanent()

  const orders = ordersData?.data ?? []
  const clients = clientsData?.data ?? []
  const allDeletedEquipment = equipmentData?.data ?? []
  const equipment = allDeletedEquipment.filter((e: { category: string }) => e.category !== 'ZASOBY')
  const resources = allDeletedEquipment.filter((e: { category: string }) => e.category === 'ZASOBY')

  const counts = {
    orders: orders.length,
    clients: clients.length,
    equipment: equipment.length,
    resources: resources.length,
  }

  const loading =
    (activeTab === 'orders' && ordersLoading) ||
    (activeTab === 'clients' && clientsLoading) ||
    (activeTab === 'equipment' && equipmentLoading) ||
    (activeTab === 'resources' && equipmentLoading)

  const handleRestoreOrder = (id: string) => {
    if (confirm('Przywrócić zlecenie z kosza?')) restoreOrder.mutate(id)
  }
  const handleDeleteOrderPerm = (id: string) => {
    if (confirm('Usunąć zlecenie na zawsze? Tej operacji nie można cofnąć.')) deleteOrderPerm.mutate(id)
  }
  const handleRestoreClient = (id: string) => {
    if (confirm('Przywrócić klienta z kosza?')) restoreClient.mutate(id)
  }
  const handleDeleteClientPerm = (id: string) => {
    if (confirm('Usunąć klienta na zawsze? Tej operacji nie można cofnąć.')) deleteClientPerm.mutate(id)
  }
  const handleRestoreEquipment = (id: string) => {
    if (confirm('Przywrócić pozycję z kosza?')) restoreEquipment.mutate(id)
  }
  const handleDeleteEquipmentPerm = (id: string) => {
    if (confirm('Usunąć pozycję na zawsze? Tej operacji nie można cofnąć.')) deleteEquipmentPerm.mutate(id)
  }

  const isEmpty =
    (activeTab === 'orders' && orders.length === 0) ||
    (activeTab === 'clients' && clients.length === 0) ||
    (activeTab === 'equipment' && equipment.length === 0) ||
    (activeTab === 'resources' && resources.length === 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kosz</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Elementy usunięte z Zleceń, Klientów, Sprzętu i Zasobów. Możesz je przywrócić lub usunąć na zawsze.
        </p>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-1" aria-label="Zakładki kosza">
          {TABS.map(({ id, label, icon: Icon }) => {
            const count = counts[id]
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Icon size={18} />
                {label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive ? 'bg-primary/20 text-primary' : 'bg-surface text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="text-muted-foreground">Ładowanie…</div>
        </div>
      ) : isEmpty ? (
        <div className="p-8 text-center text-muted-foreground border border-border rounded-lg">
          <p>Brak elementów w tej zakładce.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          {activeTab === 'orders' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left py-2 px-3">Nazwa</th>
                  <th className="text-left py-2 px-3">Klient</th>
                  <th className="text-left py-2 px-3">Usunięto</th>
                  <th className="w-24 py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="py-2 px-3 font-medium">{o.name ?? '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground">{o.client?.companyName ?? '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {o.deletedAt ? format(new Date(o.deletedAt), 'd MMM y, HH:mm', { locale: pl }) : '—'}
                    </td>
                    <td className="py-2 px-3 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleRestoreOrder(o.id)}
                        className="p-1.5 rounded hover:bg-surface-2"
                        title="Przywróć"
                      >
                        <RotateCcw size={16} className="text-primary" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOrderPerm(o.id)}
                        className="p-1.5 rounded hover:bg-red-500/20"
                        title="Usuń na zawsze"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'clients' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left py-2 px-3">Firma</th>
                  <th className="text-left py-2 px-3">Kontakt</th>
                  <th className="text-left py-2 px-3">Usunięto</th>
                  <th className="w-24 py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {clients.map((c: any) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="py-2 px-3 font-medium">{c.companyName ?? '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground">{c.contactName ?? c.email ?? '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {c.deletedAt ? format(new Date(c.deletedAt), 'd MMM y, HH:mm', { locale: pl }) : '—'}
                    </td>
                    <td className="py-2 px-3 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleRestoreClient(c.id)}
                        className="p-1.5 rounded hover:bg-surface-2"
                        title="Przywróć"
                      >
                        <RotateCcw size={16} className="text-primary" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClientPerm(c.id)}
                        className="p-1.5 rounded hover:bg-red-500/20"
                        title="Usuń na zawsze"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'equipment' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left py-2 px-3">Nazwa</th>
                  <th className="text-left py-2 px-3">Kategoria</th>
                  <th className="text-left py-2 px-3">Kod</th>
                  <th className="text-left py-2 px-3">Usunięto</th>
                  <th className="w-24 py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {equipment.map((e: any) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="py-2 px-3 font-medium">{e.name ?? '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground">{e.category ?? '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground">{e.internalCode ?? '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {e.deletedAt ? format(new Date(e.deletedAt), 'd MMM y, HH:mm', { locale: pl }) : '—'}
                    </td>
                    <td className="py-2 px-3 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleRestoreEquipment(e.id)}
                        className="p-1.5 rounded hover:bg-surface-2"
                        title="Przywróć"
                      >
                        <RotateCcw size={16} className="text-primary" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEquipmentPerm(e.id)}
                        className="p-1.5 rounded hover:bg-red-500/20"
                        title="Usuń na zawsze"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'resources' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left py-2 px-3">Nazwa</th>
                  <th className="text-left py-2 px-3">Podkategoria</th>
                  <th className="text-left py-2 px-3">Kod</th>
                  <th className="text-left py-2 px-3">Usunięto</th>
                  <th className="w-24 py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {resources.map((e: any) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="py-2 px-3 font-medium">{e.name ?? '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground">{e.subcategory ?? '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground">{e.internalCode ?? '—'}</td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {e.deletedAt ? format(new Date(e.deletedAt), 'd MMM y, HH:mm', { locale: pl }) : '—'}
                    </td>
                    <td className="py-2 px-3 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleRestoreEquipment(e.id)}
                        className="p-1.5 rounded hover:bg-surface-2"
                        title="Przywróć"
                      >
                        <RotateCcw size={16} className="text-primary" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEquipmentPerm(e.id)}
                        className="p-1.5 rounded hover:bg-red-500/20"
                        title="Usuń na zawsze"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
