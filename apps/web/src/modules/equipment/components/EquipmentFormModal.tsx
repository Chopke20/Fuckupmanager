import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useCreateEquipment, useEquipmentCategories, useUpdateEquipment } from '../hooks/useEquipment'
import { equipmentApi } from '../api/equipment.api'
import { CreateEquipmentDto, UpdateEquipmentDto, EQUIPMENT_CATEGORIES } from '@lama-stage/shared-types'

interface EquipmentFormModalProps {
  isOpen: boolean
  onClose: () => void
  equipment?: CreateEquipmentDto & { id?: string }
  defaultCategory?: CreateEquipmentDto['category']
  lockCategory?: boolean
  titleOverride?: string
  resourceSubcategories?: string[]
  /** Gdy true, dla podkategorii "LUDZIE" ukrywa stan/jednostkę (zasób nielimitowany) */
  hideStockWhenUnlimited?: boolean
}

export default function EquipmentFormModal({
  isOpen,
  onClose,
  equipment,
  defaultCategory = 'Multimedia',
  lockCategory = false,
  titleOverride,
  resourceSubcategories = [],
  hideStockWhenUnlimited = false,
}: EquipmentFormModalProps) {
  const { data: equipmentCategories = [] } = useEquipmentCategories()
  const normalizeCategoryName = (value: string): string => {
    const normalized = value.trim()
    const upper = normalized.toUpperCase()
    const map: Record<string, string> = {
      AUDIO: 'Audio',
      MULTIMEDIA: 'Multimedia',
      SCENA: 'Scena',
      STREAM: 'Multimedia',
      TRANSPORT: 'Transport',
      'ŚWIATŁO': 'Oświetlenie',
      OŚWIETLENIE: 'Oświetlenie',
      INNE: 'Inne',
    }
    return map[upper] || normalized
  }
  const [formData, setFormData] = useState<CreateEquipmentDto>({
    name: '',
    description: '',
    category: defaultCategory,
    subcategory: '',
    dailyPrice: 0,
    stockQuantity: 1,
    unit: 'szt.',
    internalCode: '',
    technicalNotes: '',
    imageUrl: '',
    visibleInOffer: true,
    pricingRule: { day1: 1.0, nextDays: 0.5 },
  })

  const createMutation = useCreateEquipment()
  const updateMutation = useUpdateEquipment()
  const [codeError, setCodeError] = useState<string | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)

  useEffect(() => {
    setCodeError(null)
    setDescriptionError(null)
    if (equipment) {
      setFormData({
        name: equipment.name,
        description: equipment.description || '',
        category: equipment.category,
        subcategory: equipment.subcategory || '',
        dailyPrice: equipment.dailyPrice,
        stockQuantity: equipment.stockQuantity,
        unit: equipment.unit,
        internalCode: equipment.internalCode || '',
        technicalNotes: equipment.technicalNotes || '',
        imageUrl: equipment.imageUrl || '',
        visibleInOffer: equipment.visibleInOffer,
        pricingRule: equipment.pricingRule || { day1: 1.0, nextDays: 0.5 },
      })
    } else {
      setFormData({
        name: '',
        description: '',
        category: defaultCategory,
        subcategory: '',
        dailyPrice: 0,
        stockQuantity: 1,
        unit: 'szt.',
        internalCode: '',
        technicalNotes: '',
        imageUrl: '',
        visibleInOffer: true,
        pricingRule: { day1: 1.0, nextDays: 0.5 },
      })
    }
  }, [equipment, defaultCategory])

  // Propozycja kolejnego kodu przy dodawaniu nowej pozycji
  useEffect(() => {
    if (!isOpen || equipment?.id) return
    let cancelled = false
    const category = defaultCategory || 'AUDIO'
    equipmentApi.getNextCode(category).then(({ proposedCode }) => {
      if (!cancelled) setFormData((prev) => ({ ...prev, internalCode: proposedCode }))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [isOpen, equipment?.id, defaultCategory])

  const isResource = lockCategory || formData.category === 'ZASOBY'
  const mergedEquipmentCategories = Array.from(
    new Set(
      [...EQUIPMENT_CATEGORIES, ...equipmentCategories]
        .filter((cat) => cat && cat !== 'ZASOBY')
        .map((cat) => normalizeCategoryName(cat))
    )
  )
  const mergedResourceSubcategories = Array.from(
    new Set(resourceSubcategories.map((cat) => cat.trim()).filter(Boolean))
  )
  const isUnlimited =
    hideStockWhenUnlimited &&
    (formData.subcategory || '').trim().toUpperCase() === 'LUDZIE'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeError(null)
    setDescriptionError(null)
    const normalizedSubcategory = (formData.subcategory || '').trim()
    const preparedData: CreateEquipmentDto = {
      ...formData,
      category: isResource ? 'ZASOBY' : normalizeCategoryName(formData.category),
      subcategory: isResource ? (normalizedSubcategory || undefined) : undefined,
      pricingRule: isResource
        ? { day1: 1.0, nextDays: 1.0 }
        : { day1: 1.0, nextDays: formData.pricingRule?.nextDays ?? 0.5 },
    }
    const dataToSend = isUnlimited
      ? { ...preparedData, stockQuantity: 0, unit: 'szt.' }
      : preparedData
    try {
      if (equipment?.id) {
        await updateMutation.mutateAsync({ id: equipment.id, data: dataToSend as UpdateEquipmentDto })
      } else {
        await createMutation.mutateAsync(dataToSend)
      }
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message
      if (err?.response?.status === 409 && (msg?.includes('Kod') || err?.response?.data?.error?.field === 'internalCode')) {
        setCodeError('Ten kod wewnętrzny jest już używany. Wybierz inny.')
      } else {
        setCodeError(msg || 'Wystąpił błąd zapisu.')
      }
    }
  }

  const generateDescription = async (retry = false) => {
    const name = formData.name.trim()
    if (!name) {
      setDescriptionError('Najpierw wpisz nazwę, aby wygenerować opis.')
      return
    }
    setDescriptionError(null)
    setIsGeneratingDescription(true)
    try {
      const response = await equipmentApi.generateDescription({
        name,
        category: isResource ? undefined : normalizeCategoryName(formData.category),
        subcategory: isResource ? (formData.subcategory || '').trim() : undefined,
        currentDescription: formData.description || '',
        retry,
      })
      setFormData((prev) => ({ ...prev, description: response.description }))
    } catch {
      setDescriptionError('Nie udało się wygenerować opisu AI.')
    } finally {
      setIsGeneratingDescription(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2.5">
      <div className="bg-surface rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-3 border-b border-border">
          <h2 className="text-lg font-bold">
            {titleOverride || (equipment?.id ? 'Edytuj sprzęt' : 'Nowy sprzęt')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nazwa *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-surface-2"
                placeholder="Np. Projektor laserowy 10k"
              />
            </div>

            {!isResource && (
            <div>
              <label className="block text-sm font-medium mb-1">Kategoria *</label>
              <select
                disabled={lockCategory}
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: normalizeCategoryName(e.target.value) as any })}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-surface-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {mergedEquipmentCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            )}

            {isResource && (
              <div>
                <label className="block text-sm font-medium mb-1">Kategoria zasobu</label>
                <input
                  list="resource-subcategories"
                  value={formData.subcategory || ''}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-surface-2"
                  placeholder="Np. TRANSPORT, LUDZIE"
                />
                <datalist id="resource-subcategories">
                  {mergedResourceSubcategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Cena dzienna (PLN) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.dailyPrice}
                onChange={(e) => setFormData({ ...formData, dailyPrice: parseFloat(e.target.value) })}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-surface-2"
              />
            </div>

            {!isUnlimited && (
              <div>
                <label className="block text-sm font-medium mb-1">Stan magazynowy *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-surface-2"
                />
              </div>
            )}

            {isUnlimited && (
              <div className="md:col-span-2 flex items-center text-sm text-muted-foreground">
                Stan: —
              </div>
            )}

            {!isUnlimited && (
              <div>
                <label className="block text-sm font-medium mb-1">Jednostka</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-surface-2"
                  placeholder="szt., m, kg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Kod wewnętrzny</label>
              <input
                type="text"
                value={formData.internalCode}
                onChange={(e) => {
                  setFormData({ ...formData, internalCode: e.target.value })
                  setCodeError(null)
                }}
                className={`w-full px-2.5 py-1.5 text-sm border rounded bg-surface-2 ${codeError ? 'border-red-500' : 'border-border'}`}
                placeholder={defaultCategory === 'ZASOBY' ? 'RES-00001' : 'EQP-00001'}
              />
              {codeError && <p className="text-xs text-red-500 mt-1">{codeError}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Opis</label>
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => generateDescription(false)}
                disabled={isGeneratingDescription || !formData.name.trim()}
                className="px-2.5 py-1 text-xs border border-border rounded hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                {isGeneratingDescription ? 'Generowanie...' : 'Generuj AI'}
              </button>
              <button
                type="button"
                onClick={() => generateDescription(true)}
                disabled={isGeneratingDescription || !formData.name.trim()}
                className="px-2.5 py-1 text-xs border border-border rounded hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                Odśwież
              </button>
            </div>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-surface-2"
              placeholder="Szczegóły techniczne, specyfikacja..."
            />
            {descriptionError && <p className="text-xs text-red-500 mt-1">{descriptionError}</p>}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, description: '' })}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Wyczyść opis
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notatki techniczne</label>
            <textarea
              value={formData.technicalNotes}
              onChange={(e) => setFormData({ ...formData, technicalNotes: e.target.value })}
              rows={2}
              className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-surface-2"
              placeholder="Wymagania zasilania, konfiguracja..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">URL zdjęcia</label>
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-surface-2"
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="visibleInOffer"
                  checked={formData.visibleInOffer}
                  onChange={(e) => setFormData({ ...formData, visibleInOffer: e.target.checked })}
                  className="w-5 h-5"
                />
                <label htmlFor="visibleInOffer" className="text-sm">
                  Widoczny w ofercie dla klienta
                </label>
              </div>

              {!isResource && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Zasada wyceny wielodniowej</label>
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Dzień 1</label>
                      <div className="w-20 p-2 border border-border rounded bg-surface-2 text-sm text-center">
                        1.0
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Kolejne dni</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.pricingRule?.nextDays ?? 0.5}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricingRule: { day1: 1.0, nextDays: parseFloat(e.target.value) },
                          })
                        }
                        className="w-20 p-2 border border-border rounded bg-surface-2"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-2 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-3 py-1.5 text-sm border-2 border-primary text-primary bg-transparent rounded font-medium hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Zapisywanie...'
                : equipment?.id
                ? 'Zapisz zmiany'
                : isResource
                ? 'Dodaj zasób'
                : 'Dodaj sprzęt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}