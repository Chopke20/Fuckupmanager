import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import { useOrder } from '../hooks/useOrders'
import { useClients } from '../../clients/hooks/useClients'
import { orderApi } from '../api/order.api'
import { CreateOrderDto, UpdateOrderDto, CreateOrderEquipmentItemDto, CreateOrderProductionItemDto, CreateOrderStageDto, OrderStatus, Order, OrderEquipmentItem, OrderProductionItem } from '@lama-stage/shared-types'

type OrderFormData = Omit<CreateOrderDto, 'startDate' | 'endDate' | 'equipmentItems' | 'productionItems' | 'stages'> & {
  startDate: string;
  endDate: string;
};

type EquipmentRow = Partial<CreateOrderEquipmentItemDto> & {
  id?: string;
  netValue?: number;
  isRental?: boolean;
};

type ProductionRow = Partial<CreateOrderProductionItemDto> & {
  id?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  isRental?: boolean;
  netValue?: number;
};

export default function OrderFormV4() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditing = !!id
  const { data: order, isLoading } = useOrder(id || '')
  const { data: paginatedClients } = useClients()
  const clients = paginatedClients?.data || []
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null) // Stan na błędy
  const [formData, setFormData] = useState<OrderFormData>({
    name: '',
    clientId: '',
    startDate: new Date().toISOString().split('T')[0] || '',
    endDate: new Date().toISOString().split('T')[0] || '',
    status: 'DRAFT',
    venue: '',
    description: '',
    discountGlobal: 0,
    vatRate: 23,
    isRecurring: false,
  })

  const [equipmentRows, setEquipmentRows] = useState<EquipmentRow[]>([
    { id: '1', name: '', quantity: 1, unitPrice: 0, isRental: false, netValue: 0, category: 'Inne', days: 1, discount: 0, visibleInOffer: true, sortOrder: 0 },
  ])
  const [productionRows, setProductionRows] = useState<ProductionRow[]>([
    { id: '1', name: '', quantity: 1, unitPrice: 0, isRental: false, netValue: 0, rateType: 'FLAT', discount: 0, isSubcontractor: false, visibleInOffer: true, sortOrder: 0 },
  ])

  const equipmentTableRef = useRef<HTMLTableElement>(null)
  const productionTableRef = useRef<HTMLTableElement>(null)

  // Załaduj dane zlecenia jeśli edytujemy
  useEffect(() => {
    if (order) {
      setFormData({
        name: order.name ?? '',
        clientId: order.clientId ?? '',
        startDate: (order.startDate ? new Date(order.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]) || '',
        endDate: (order.endDate ? new Date(order.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]) || '',
        status: order.status ?? 'DRAFT',
        venue: order.venue ?? '',
        description: order.description ?? '',
        discountGlobal: order.discountGlobal ?? 0,
        vatRate: order.vatRate ?? 23,
        isRecurring: order.isRecurring ?? false,
        recurringConfig: order.recurringConfig ?? undefined,
        parentOrderId: order.parentOrderId ?? undefined,
      })
      setEquipmentRows(order.equipmentItems?.map((item: OrderEquipmentItem) => ({
        ...item,
        isRental: false, // Assuming default or derive from pricingRule
        netValue: (item.quantity || 0) * (item.unitPrice || 0),
      })) || [])
      setProductionRows(order.productionItems?.map((item: OrderProductionItem) => ({
        ...item,
        quantity: item.units,
        unitPrice: item.rateValue,
        isRental: false, // Assuming default
        netValue: (item.units || 0) * (item.rateValue || 0),
      })) || [])
    }
  }, [order])

  // Oblicz wartości netto
  useEffect(() => {
    const updatedEquipment = equipmentRows.map(row => ({
      ...row,
      netValue: (row.quantity || 0) * (row.unitPrice || 0),
    }))
    setEquipmentRows(updatedEquipment)

    const updatedProduction = productionRows.map(row => ({
      ...row,
      netValue: (row.quantity || 0) * (row.unitPrice || 0),
    }))
    setProductionRows(updatedProduction)
  }, [equipmentRows.map(r => r.quantity), equipmentRows.map(r => r.unitPrice), productionRows.map(r => r.quantity), productionRows.map(r => r.unitPrice)])

  const handleFormChange = (field: keyof OrderFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleEquipmentChange = (index: number, field: keyof EquipmentRow, value: any) => {
    const updated = [...equipmentRows]
    updated[index] = { ...updated[index], [field]: value }
    setEquipmentRows(updated)
  }

  const handleProductionChange = (index: number, field: keyof ProductionRow, value: any) => {
    const updated = [...productionRows]
    updated[index] = { ...updated[index], [field]: value }
    setProductionRows(updated)
  }

  const addEquipmentRow = () => {
    const newId = (equipmentRows.length + 1).toString()
    setEquipmentRows([
      ...equipmentRows,
      { id: newId, name: '', quantity: 1, unitPrice: 0, isRental: false, netValue: 0 },
    ])
  }

  const addProductionRow = () => {
    const newId = (productionRows.length + 1).toString()
    setProductionRows([
      ...productionRows,
      { id: newId, name: '', quantity: 1, unitPrice: 0, isRental: false, netValue: 0 },
    ])
  }

  const removeEquipmentRow = (index: number) => {
    if (equipmentRows.length > 1) {
      const updated = equipmentRows.filter((_, i) => i !== index)
      setEquipmentRows(updated)
    }
  }

  const removeProductionRow = (index: number) => {
    if (productionRows.length > 1) {
      const updated = productionRows.filter((_, i) => i !== index)
      setProductionRows(updated)
    }
  }

  const handleAddNewClient = () => {
    if (!newClientName.trim()) return
    // TODO: Wywołanie API do dodania klienta
    console.log('Dodaj nowego klienta:', newClientName)
    // Po dodaniu, zamknij modal i wybierz nowego klienta
    setShowNewClient(false)
    setNewClientName('')
    // W rzeczywistości tutaj byłby fetch i dodanie do listy clients
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null) // Wyczyść poprzednie błędy

    const payloadEquipmentItems: CreateOrderEquipmentItemDto[] = equipmentRows.map(row => ({
      name: row.name || '',
      quantity: row.quantity || 0,
      unitPrice: row.unitPrice || 0,
      equipmentId: row.equipmentId,
      description: row.description,
      category: row.category || 'Inne',
      days: row.days || 1,
      discount: row.discount || 0,
      pricingRule: row.pricingRule,
      visibleInOffer: row.visibleInOffer || true,
      sortOrder: row.sortOrder || 0,
      isRental: row.isRental ?? false,
    }))

    const payloadProductionItems: CreateOrderProductionItemDto[] = productionRows.map(row => ({
      name: row.name || '',
      rateValue: row.unitPrice || 0, // Mapowanie unitPrice na rateValue
      units: row.quantity || 1, // Mapowanie quantity na units
      description: row.description,
      rateType: row.rateType || 'FLAT',
      discount: row.discount || 0,
      stageIds: row.stageIds,
      isTransport: false,
      isAutoCalculated: false,
      isSubcontractor: row.isSubcontractor || false,
      visibleInOffer: row.visibleInOffer || true,
      sortOrder: row.sortOrder || 0,
    }))

    const orderPayload: CreateOrderDto | UpdateOrderDto = {
      ...formData,
      startDate: new Date(formData.startDate), // Przekazujemy obiekt Date
      endDate: new Date(formData.endDate),     // Przekazujemy obiekt Date
      equipmentItems: payloadEquipmentItems,
      productionItems: payloadProductionItems,
      stages: [], // Jeśli są etapy, dodaj je tutaj
    }

    try {
      if (isEditing && id) {
        await orderApi.update(id, orderPayload as UpdateOrderDto)
      } else {
        await orderApi.create(orderPayload as CreateOrderDto)
      }
      alert('Zlecenie zapisane pomyślnie!')
      navigate('/orders')
    } catch (error: any) {
      console.error('Błąd podczas zapisu zlecenia:', error)
      setErrorMessage(error.response?.data?.message || 'Wystąpił nieznany błąd podczas zapisu zlecenia.')
    }
  }

  // Obliczenia sum
  const equipmentTotal = equipmentRows.reduce((sum, row) => sum + (row.netValue || 0), 0)
  const productionTotal = productionRows.reduce((sum, row) => sum + (row.netValue || 0), 0)
  const rentalTotal = [...equipmentRows, ...productionRows]
    .filter(row => row.isRental)
    .reduce((sum, row) => sum + (row.netValue || 0), 0)
  const netTotal = equipmentTotal + productionTotal
  const vatAmount = netTotal * 0.23
  const grossTotal = netTotal + vatAmount
  const marginNet = netTotal - rentalTotal
  const marginPercent = netTotal > 0 ? (marginNet / netTotal) * 100 : 0

  if (isLoading && isEditing) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Ładowanie zlecenia...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={20} />
          Powrót do listy
        </button>
        <button
          type="submit"
          form="order-form"
          className="px-6 py-2 border-2 border-primary text-primary bg-transparent rounded font-medium hover:bg-primary/10 transition-colors flex items-center gap-2"
        >
          <Save size={18} />
          {isEditing ? 'Zapisz zmiany' : 'Utwórz zlecenie'}
        </button>
      </div>

      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Błąd!</strong>
          <span className="block sm:inline"> {errorMessage}</span>
        </div>
      )}

      <form id="order-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Lewa kolumna - 40% */}
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-border rounded p-6">
              <h2 className="text-xl font-semibold mb-6">Podstawowe informacje</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Nazwa zlecenia</label>
                  <input
                    type="text"
                    className="w-full bg-background border border-border rounded px-3 py-2"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm text-muted-foreground">Klient</label>
                    <button
                      type="button"
                      onClick={() => setShowNewClient(true)}
                      className="text-xs text-primary hover:text-primary-hover"
                    >
                      + Nowy klient
                    </button>
                  </div>
                  <select
                    className="w-full bg-background border border-border rounded px-3 py-2"
                    value={formData.clientId}
                    onChange={(e) => handleFormChange('clientId', e.target.value)}
                  >
                    <option value="">Wybierz klienta...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Data od</label>
                    <input
                      type="date"
                      className="w-full bg-background border border-border rounded px-3 py-2"
                      value={formData.startDate} // Zmieniono z dateFrom
                      onChange={(e) => handleFormChange('startDate', e.target.value)} // Zmieniono z dateFrom
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Data do</label>
                    <input
                      type="date"
                      className="w-full bg-background border border-border rounded px-3 py-2"
                      value={formData.endDate} // Zmieniono z dateTo
                      onChange={(e) => handleFormChange('endDate', e.target.value)} // Zmieniono z dateTo
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Status</label>
                  <select
                    className="w-full bg-background border border-border rounded px-3 py-2"
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                  >
                    <option value="DRAFT">Szkic</option>
                    <option value="CONFIRMED">Potwierdzone</option>
                    <option value="OFFER_SENT">Oferta wysłana</option>
                    <option value="COMPLETED">Zakończone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Miejsce realizacji</label>
                  <input
                    type="text"
                    className="w-full bg-background border border-border rounded px-3 py-2"
                    value={formData.venue}
                    onChange={(e) => handleFormChange('venue', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Opis wewnętrzny (techniczny)</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Dla zespołu — nie trafia do oferty dla klienta; tam ustawiasz osobny tekst (strona Oferta).
                  </p>
                  <textarea
                    className="w-full bg-background border border-border rounded px-3 py-2"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="Brief, logistyka, uwagi wewnętrzne…"
                  />
                </div>
              </div>
            </div>

            {/* Podsumowanie finansowe */}
            <div className="border border-border rounded p-6">
              <h2 className="text-xl font-semibold mb-6">Podsumowanie</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sprzęt netto:</span>
                  <span className="font-medium">{equipmentTotal.toFixed(2)} PLN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produkcja netto:</span>
                  <span className="font-medium">{productionTotal.toFixed(2)} PLN</span>
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <span className="font-medium">Suma netto:</span>
                  <span className="font-bold">{netTotal.toFixed(2)} PLN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT 23%:</span>
                  <span className="font-medium">{vatAmount.toFixed(2)} PLN</span>
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <span className="font-medium">Suma brutto:</span>
                  <span className="font-bold text-lg">{grossTotal.toFixed(2)} PLN</span>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Koszty rental:</span>
                    <span className="font-medium">{rentalTotal.toFixed(2)} PLN</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="font-medium">Marża netto:</span>
                    <span className="font-bold text-green-500">{marginNet.toFixed(2)} PLN</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Marża %:</span>
                    <span className="font-medium">{marginPercent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Prawa kolumna - 60% */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tabela sprzętu */}
            <div className="border border-border rounded overflow-hidden">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Sprzęt</h2>
                <button
                  type="button"
                  onClick={addEquipmentRow}
                  className="px-4 py-2 border-2 border-primary text-primary bg-transparent text-sm rounded hover:bg-primary/10 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} />
                  Dodaj wiersz
                </button>
              </div>
              <div className="overflow-x-auto">
                <table ref={equipmentTableRef} className="w-full">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-8">#</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nazwa</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ilość</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cena jdn.</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rental</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Wartość netto</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentRows.map((row, index) => (
                      <tr key={row.id} className="border-b border-border hover:bg-surface-2/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="text-sm text-muted-foreground">{index + 1}</div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            className="w-full bg-transparent border border-transparent hover:border-border rounded px-2 py-1 focus:border-primary focus:outline-none"
                            value={row.name}
                            onChange={(e) => handleEquipmentChange(index, 'name', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && index === equipmentRows.length - 1) {
                                e.preventDefault()
                                addEquipmentRow()
                              }
                            }}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min="1"
                            className="w-20 bg-transparent border border-transparent hover:border-border rounded px-2 py-1 text-right focus:border-primary focus:outline-none"
                            value={row.quantity}
                            onChange={(e) => handleEquipmentChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 bg-transparent border border-transparent hover:border-border rounded px-2 py-1 text-right focus:border-primary focus:outline-none"
                            value={row.unitPrice}
                            onChange={(e) => handleEquipmentChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={row.isRental}
                            onChange={(e) => handleEquipmentChange(index, 'isRental', e.target.checked)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-right font-medium">
                            {(row.netValue || 0).toFixed(2)} PLN
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => removeEquipmentRow(index)}
                            className="text-red-500 hover:text-red-600 p-1"
                            disabled={equipmentRows.length === 1}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabela produkcji */}
            <div className="border border-border rounded overflow-hidden">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Produkcja i logistyka</h2>
                <button
                  type="button"
                  onClick={addProductionRow}
                  className="px-4 py-2 border-2 border-primary text-primary bg-transparent text-sm rounded hover:bg-primary/10 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} />
                  Dodaj wiersz
                </button>
              </div>
              <div className="overflow-x-auto">
                <table ref={productionTableRef} className="w-full">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-8">#</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nazwa</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ilość</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cena jdn.</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rental</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Wartość netto</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionRows.map((row, index) => (
                      <tr key={row.id} className="border-b border-border hover:bg-surface-2/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="text-sm text-muted-foreground">{index + 1}</div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            className="w-full bg-transparent border border-transparent hover:border-border rounded px-2 py-1 focus:border-primary focus:outline-none"
                            value={row.name}
                            onChange={(e) => handleProductionChange(index, 'name', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && index === productionRows.length - 1) {
                                e.preventDefault()
                                addProductionRow()
                              }
                            }}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min="1"
                            className="w-20 bg-transparent border border-transparent hover:border-border rounded px-2 py-1 text-right focus:border-primary focus:outline-none"
                            value={row.quantity}
                            onChange={(e) => handleProductionChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 bg-transparent border border-transparent hover:border-border rounded px-2 py-1 text-right focus:border-primary focus:outline-none"
                            value={row.unitPrice}
                            onChange={(e) => handleProductionChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={row.isRental}
                            onChange={(e) => handleProductionChange(index, 'isRental', e.target.checked)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-right font-medium">
                            {(row.netValue || 0).toFixed(2)} PLN
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => removeProductionRow(index)}
                            className="text-red-500 hover:text-red-600 p-1"
                            disabled={productionRows.length === 1}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Przyciski akcji */}
            <div className="flex justify-end gap-4 pt-6">
              <button
                type="button"
                onClick={() => navigate('/orders')}
                className="px-6 py-3 border border-border rounded hover:bg-surface-2 transition-colors"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-6 py-3 border-2 border-primary text-primary bg-transparent rounded font-medium hover:bg-primary/10 transition-colors flex items-center gap-2"
              >
                <Save size={18} />
                {isEditing ? 'Zapisz zmiany' : 'Utwórz zlecenie'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Modal dodawania nowego klienta */}
      {showNewClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Dodaj nowego klienta</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Nazwa firmy</label>
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded px-3 py-2"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewClient(false)}
                  className="px-4 py-2 border border-border rounded hover:bg-surface-2 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleAddNewClient}
                  className="px-4 py-2 border-2 border-primary text-primary bg-transparent rounded hover:bg-primary/10 transition-colors"
                >
                  Dodaj klienta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
