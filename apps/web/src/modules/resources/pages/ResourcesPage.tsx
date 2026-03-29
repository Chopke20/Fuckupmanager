import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { SortableTh } from '../../../shared/components/SortableTh'
import { CategoryDropdownManager } from '../../../shared/components/CategoryDropdownManager'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEquipment, useDeleteEquipment, useResourceSubcategories } from '../../equipment/hooks/useEquipment'
import { equipmentApi } from '../../equipment/api/equipment.api'
import EquipmentFormModal from '../../equipment/components/EquipmentFormModal'
import { Equipment } from '@lama-stage/shared-types'

const RESOURCE_CATEGORY = 'ZASOBY'

export default function ResourcesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all')
  const [customSubcategories, setCustomSubcategories] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<Equipment | null>(null)
  const queryClient = useQueryClient()
  const { data: backendSubcategories = [] } = useResourceSubcategories()

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    equipmentApi.getById(editId).then((data) => {
      if (!cancelled && data) {
        const res = (data as { data?: Equipment }).data ?? data
        setEditingResource(res as Equipment)
        setIsModalOpen(true)
        setSearchParams({}, { replace: true })
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [editId, setSearchParams])

  const { data: paginatedResources, isLoading } = useEquipment({
    category: RESOURCE_CATEGORY,
    search: search || undefined,
    page: 1,
    limit: 500,
  })
  const resourcesRaw = paginatedResources?.data || []
  const deleteMutation = useDeleteEquipment()
  const clearSubcategoryMutation = useMutation({
    mutationFn: (name: string) => equipmentApi.clearResourceSubcategory(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      queryClient.invalidateQueries({ queryKey: ['resourceSubcategories'] })
    },
  })
  const renameSubcategoryMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      equipmentApi.renameResourceSubcategory(oldName, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      queryClient.invalidateQueries({ queryKey: ['resourceSubcategories'] })
    },
  })

  const subcategories = useMemo(() => {
    const fromRecords = resourcesRaw
      .map((resource) => (resource.subcategory || '').trim())
      .filter(Boolean)
    return Array.from(new Set([...backendSubcategories, ...fromRecords, ...customSubcategories])).sort((a, b) => a.localeCompare(b))
  }, [backendSubcategories, resourcesRaw, customSubcategories])

  const [sortBy, setSortBy] = useState<string>('internalCode')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const toggleSort = (key: string) => {
    setSortBy(key)
    setSortDir((d) => (sortBy === key ? (d === 'asc' ? 'desc' : 'asc') : key === 'internalCode' ? 'desc' : 'asc'))
  }

  const getSubcategory = (resource: Equipment): string => (resource.subcategory || '').trim() || '—'
  const isUnlimitedBySubcategory = (subcategory?: string | null): boolean =>
    (subcategory || '').trim().toUpperCase() === 'LUDZIE'

  const resources = useMemo(() => {
    const list = resourcesRaw.filter((resource) =>
      selectedSubcategory === 'all' ? true : (resource.subcategory || '').trim() === selectedSubcategory
    )
    const mult = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortBy === 'internalCode') {
        const ac = (a.internalCode || '').toLowerCase()
        const bc = (b.internalCode || '').toLowerCase()
        return mult * (ac < bc ? -1 : ac > bc ? 1 : 0)
      }
      if (sortBy === 'name') return mult * a.name.localeCompare(b.name)
      if (sortBy === 'category') {
        const ac = getSubcategory(a)
        const bc = getSubcategory(b)
        return mult * ac.localeCompare(bc)
      }
      if (sortBy === 'dailyPrice') return mult * (a.dailyPrice - b.dailyPrice)
      return 0
    })
    return list
  }, [resourcesRaw, sortBy, sortDir, selectedSubcategory])

  const handleEdit = (resource: Equipment) => {
    setEditingResource(resource)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć ten zasób?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleNew = () => {
    setEditingResource(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingResource(null)
  }

  const addSubcategory = () => {
    const raw = prompt('Nazwa nowej kategorii zasobów:')
    const normalized = (raw || '').trim().toUpperCase()
    if (!normalized) return
    if (!customSubcategories.includes(normalized)) {
      setCustomSubcategories((prev) => [...prev, normalized])
    }
    setSelectedSubcategory(normalized)
  }

  const editSubcategory = async (oldName: string) => {
    const raw = prompt('Nowa nazwa kategorii:', oldName)
    const newName = (raw || '').trim().toUpperCase()
    if (!newName || newName === oldName) return
    await renameSubcategoryMutation.mutateAsync({ oldName, newName })
    setCustomSubcategories((prev) =>
      prev.map((category) => (category === oldName ? newName : category))
    )
    if (selectedSubcategory === oldName) setSelectedSubcategory(newName)
  }

  const removeSubcategory = async (name: string) => {
    if (!confirm(`Usunąć kategorię "${name}"? Wszystkie przypisane zasoby stracą kategorię.`)) return
    await clearSubcategoryMutation.mutateAsync(name)
    setCustomSubcategories((prev) => prev.filter((cat) => cat !== name))
    if (selectedSubcategory === name) setSelectedSubcategory('all')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zasoby</h1>
        <button
          onClick={handleNew}
          className="px-3 py-1.5 border-2 border-primary text-primary bg-transparent text-sm rounded hover:bg-primary/10 transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Nowy zasób
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <CategoryDropdownManager
          value={selectedSubcategory}
          categories={subcategories}
          onSelect={setSelectedSubcategory}
          onAdd={addSubcategory}
          onEdit={editSubcategory}
          onDelete={removeSubcategory}
        />
        <input
          type="text"
          placeholder="Szukaj..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-background border border-border rounded px-2.5 py-1.5 text-sm flex-1 max-w-md"
        />
        <button
          onClick={() => {
            setSelectedSubcategory('all')
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
            <div className="p-8 text-center text-muted-foreground">Ładowanie zasobów...</div>
          ) : resources.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Brak zasobów. Kliknij "Nowy zasób", aby dodać.
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
                  {resources.map((resource) => (
                    <tr key={resource.id} className="border-b border-border hover:bg-surface-2/30 transition-colors">
                      <td className="py-2 px-3">
                        <div className="text-sm font-mono text-muted-foreground">{resource.internalCode || '—'}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div>
                          <p className="font-medium">{resource.name}</p>
                          <p className="text-xs text-muted-foreground">{resource.description?.substring(0, 70)}{(resource.description?.length ?? 0) > 70 ? '...' : ''}</p>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-xs px-2 py-1 bg-surface-2 rounded">
                          {getSubcategory(resource)}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {isUnlimitedBySubcategory(resource.subcategory) || resource.stockQuantity === 0 ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${resource.stockQuantity > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="text-sm">{resource.stockQuantity} {resource.unit}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-medium">{resource.dailyPrice.toFixed(2)} PLN</span>
                      </td>
                      <td className="py-2 px-3">
                        <div className={`w-3 h-3 rounded border ${resource.visibleInOffer ? 'border-primary bg-primary/20' : 'border-border'}`} />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEdit(resource)}
                            className="text-primary hover:text-primary-hover p-1"
                            title="Edytuj"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(resource.id)}
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
        equipment={editingResource || undefined}
        defaultCategory={RESOURCE_CATEGORY}
        lockCategory={true}
        titleOverride={editingResource?.id ? 'Edytuj zasób' : 'Nowy zasób'}
        resourceSubcategories={subcategories}
        hideStockWhenUnlimited={true}
      />
    </div>
  )
}
