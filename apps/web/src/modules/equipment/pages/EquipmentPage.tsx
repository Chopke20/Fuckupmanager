import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { SortableTh } from '../../../shared/components/SortableTh'
import { useEquipment, useDeleteEquipment, useEquipmentCategories } from '../hooks/useEquipment'
import EquipmentFormModal from '../components/EquipmentFormModal'
import { equipmentApi } from '../api/equipment.api'
import { Equipment } from '@lama-stage/shared-types'

export default function EquipmentPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    equipmentApi.getById(editId).then((data) => {
      if (!cancelled && data) {
        const eq = (data as { data?: Equipment }).data ?? data
        setEditingEquipment(eq as Equipment)
        setIsModalOpen(true)
        setSearchParams({}, { replace: true })
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [editId, setSearchParams])

  // Zakładka Sprzęt – tylko sprzęt, nigdy ZASOBY (LUDZIE/TRANSPORT są w zakładce Zasoby)
  const { data: categoriesRaw = [] } = useEquipmentCategories()
  const categoriesFiltered = (categoriesRaw ?? []).filter((c: string) => c !== 'ZASOBY')
  const categories =
    categoriesFiltered.length > 0 ? categoriesFiltered : ['AUDIO', 'MULTIMEDIA', 'SCENA', 'STREAM', 'ŚWIATŁO']
  const categoryParam = selectedCategory === 'ZASOBY' ? 'all' : selectedCategory
  const { data: paginatedEquipment, isLoading } = useEquipment({ category: categoryParam, search, page: 1, limit: 500 })
  const equipmentRaw = paginatedEquipment?.data || []
  const equipmentFiltered = equipmentRaw.filter((eq) => eq.category !== 'ZASOBY')

  const [sortBy, setSortBy] = useState<string>('internalCode')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const toggleSort = (key: string) => {
    setSortBy(key)
    setSortDir((d) => (sortBy === key ? (d === 'asc' ? 'desc' : 'asc') : key === 'internalCode' ? 'desc' : 'asc'))
  }
  const equipment = useMemo(() => {
    const list = [...equipmentFiltered]
    const mult = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortBy === 'internalCode') {
        const ac = (a.internalCode || '').toLowerCase()
        const bc = (b.internalCode || '').toLowerCase()
        return mult * (ac < bc ? -1 : ac > bc ? 1 : 0)
      }
      if (sortBy === 'name') return mult * (a.name.localeCompare(b.name))
      if (sortBy === 'category') return mult * ((a.category || '').localeCompare(b.category || ''))
      if (sortBy === 'dailyPrice') return mult * (a.dailyPrice - b.dailyPrice)
      return 0
    })
    return list
  }, [equipmentFiltered, sortBy, sortDir])
  const deleteMutation = useDeleteEquipment()

  const handleEdit = (eq: Equipment) => {
    setEditingEquipment(eq)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć ten sprzęt?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleNew = () => {
    setEditingEquipment(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingEquipment(null)
  }

  // Automatyczne kody dla nowego sprzętu
  const getNextCode = (category: string) => {
    const categoryPrefix = category === 'AUDIO' ? 'AUD' : 
                         category === 'LIGHTING' ? 'LGT' : 
                         category === 'VIDEO' ? 'VID' : 
                         category === 'STAGING' ? 'STG' : 'EQP'
    
    const categoryItems = equipmentFiltered.filter(eq => eq.category === category)
    const nextNumber = categoryItems.length + 1
    return `${categoryPrefix}-${nextNumber.toString().padStart(3, '0')}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sprzęt</h1>
        <button
          onClick={handleNew}
          className="px-3 py-1.5 border-2 border-primary text-primary bg-transparent text-sm rounded hover:bg-primary/10 transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Nowy sprzęt
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <select
          id="equipment-category"
          aria-label="Kategoria"
          className="bg-background border border-border rounded px-2.5 py-1.5 text-sm min-w-[170px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Wszystkie kategorie</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        <input
          type="text"
          placeholder="Szukaj..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-background border border-border rounded px-2.5 py-1.5 text-sm flex-1 max-w-md"
        />
        <button
          onClick={() => {
            setSelectedCategory('all')
            setSearch('')
          }}
          className="px-2.5 py-1.5 border border-border rounded text-sm hover:bg-surface-2 transition-colors"
        >
          Wyczyść
        </button>
      </div>

      <div className="border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Ładowanie sprzętu...</div>
          ) : equipment.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Brak sprzętu w bazie. Kliknij "Nowy sprzęt", aby dodać.
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-2 border-b border-border">
                    <SortableTh label="Kod" sortKey="internalCode" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Nazwa" sortKey="name" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Kategoria" sortKey="category" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                    <th className="text-left py-2 px-3 font-medium text-sm">Stan</th>
                    <SortableTh label="Cena dzienna" sortKey="dailyPrice" currentSort={sortBy} currentDir={sortDir} onSort={toggleSort} />
                    <th className="text-left py-2 px-3 font-medium text-sm">Widoczny</th>
                    <th className="text-left py-2 px-3 font-medium text-sm">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((eq) => (
                    <tr key={eq.id} className="border-b border-border hover:bg-surface-2/30 transition-colors">
                      <td className="py-2 px-3">
                        <div className="text-sm font-mono text-muted-foreground">
                          {eq.internalCode || '—'}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div>
                          <p className="font-medium">{eq.name}</p>
                          <p className="text-xs text-muted-foreground">{eq.description?.substring(0, 50)}...</p>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-xs px-2 py-1 bg-surface-2 rounded">
                          {eq.category}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${eq.stockQuantity > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-sm">{eq.stockQuantity} {eq.unit}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-medium">{eq.dailyPrice.toFixed(2)} PLN</span>
                      </td>
                      <td className="py-2 px-3">
                        <div className={`w-3 h-3 rounded border ${eq.visibleInOffer ? 'border-primary bg-primary/20' : 'border-border'}`} />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEdit(eq)}
                            className="text-primary hover:text-primary-hover p-1"
                            title="Edytuj"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(eq.id)}
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
          )}
        </div>
      </div>

      <EquipmentFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        equipment={editingEquipment || undefined}
      />
    </div>
  )
}