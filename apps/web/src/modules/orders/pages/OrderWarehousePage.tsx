import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Eye, FileText, Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOrder } from '../hooks/useOrders';
import {
  orderApi,
  OrderDocumentExportMeta,
  downloadOrderWarehousePdf,
  getOrderWarehousePdfPreviewUrl,
} from '../api/order.api';
import { formatOrderNumber } from '../utils/orderNumberFormat';

type WarehouseCustomItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  sortOrder: number;
};

type WarehouseDraft = {
  title: string;
  notes?: string;
  skipPack?: Record<string, boolean>;
  rental?: Record<string, boolean>;
  itemNotes?: Record<string, string>;
  customItems?: WarehouseCustomItem[];
};

type WarehouseEquipmentRow = {
  id: string;
  name?: string;
  quantity?: number;
  sortOrder?: number;
  isRental?: boolean;
  equipment?: { unit?: string } | null;
};

function asBoolRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function asCustomItems(value: unknown): WarehouseCustomItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
    .map((row, idx) => {
      const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `custom-${idx}`;
      const name = typeof row.name === 'string' ? row.name : '';
      const qtyRaw = Number(row.quantity);
      const quantity = Number.isFinite(qtyRaw) && qtyRaw >= 1 ? Math.round(qtyRaw) : 1;
      const unit = typeof row.unit === 'string' && row.unit.trim() ? row.unit.trim() : 'szt.';
      const sortRaw = Number(row.sortOrder);
      const sortOrder = Number.isFinite(sortRaw) ? Math.round(sortRaw) : 10_000 + idx;
      return { id, name, quantity, unit, sortOrder };
    });
}

function normalizeWarehouseDraft(
  payload: unknown,
  orderName: string,
  equipment: WarehouseEquipmentRow[],
): WarehouseDraft {
  const p =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  let title = typeof p.title === 'string' ? p.title.trim() : '';
  if (!title) title = `Magazyn / załadunek - ${orderName}`.trim() || 'Magazyn / załadunek';
  const notes = typeof p.notes === 'string' ? p.notes : '';
  const skipPack = asBoolRecord(p.skipPack);
  const rentalFromDraft = asBoolRecord(p.rental);
  const rental: Record<string, boolean> = { ...rentalFromDraft };
  for (const item of equipment) {
    if (!(item.id in rental)) {
      rental[item.id] = !!item.isRental;
    }
  }
  const itemNotes = asStringRecord(p.itemNotes);
  const customItems = asCustomItems(p.customItems);
  return {
    title,
    notes: notes || undefined,
    skipPack,
    rental,
    itemNotes,
    customItems,
  };
}

function newCustomItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `custom-${crypto.randomUUID()}`;
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function OrderWarehousePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, isError } = useOrder(id || '');

  const [draft, setDraft] = useState<WarehouseDraft | null>(null);
  const [exports, setExports] = useState<OrderDocumentExportMeta[]>([]);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [loadingExports, setLoadingExports] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const equipmentSorted = useMemo(() => {
    const items = (order?.equipmentItems ?? []) as WarehouseEquipmentRow[];
    return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [order?.equipmentItems]);

  const customSorted = useMemo(() => {
    const items = draft?.customItems ?? [];
    return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [draft?.customItems]);

  const orderNumberDisplay = useMemo(() => {
    if (!order) return '—';
    const o = order as { orderNumber?: number | null; orderYear?: number | null };
    return o.orderNumber != null && o.orderYear != null ? formatOrderNumber(o.orderNumber, o.orderYear) : '—';
  }, [order]);

  useEffect(() => {
    if (!id || isLoading) return;
    if (isError || !order) {
      setLoadingDraft(false);
      setDraft(null);
      return;
    }
    const orderName = order.name || 'Zlecenie';
    const equipment = (order.equipmentItems ?? []) as WarehouseEquipmentRow[];
    setLoadingDraft(true);
    setError(null);
    orderApi
      .getDocumentDraft<WarehouseDraft>(id, 'WAREHOUSE')
      .then((res) => setDraft(normalizeWarehouseDraft(res.payload, orderName, equipment)))
      .catch(() => {
        setError('Nie udało się pobrać draftu magazynu.');
        setDraft(null);
      })
      .finally(() => setLoadingDraft(false));
    // draft ładujemy przy otwarciu zlecenia — nie resetuj przy każdej zmianie referencji equipmentItems
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isLoading, isError, order?.id, order?.name]);

  useEffect(() => {
    if (!id) return;
    setLoadingExports(true);
    orderApi
      .getDocumentExports(id, 'WAREHOUSE')
      .then(setExports)
      .catch(() => setExports([]))
      .finally(() => setLoadingExports(false));
  }, [id]);

  const updateItemFlag = (itemId: string, field: 'skipPack' | 'rental', value: boolean) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: { ...(prev[field] ?? {}), [itemId]: value },
      };
    });
  };

  const updateItemNote = (itemId: string, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextNotes = { ...(prev.itemNotes ?? {}) };
      const trimmed = value.slice(0, 500);
      if (trimmed.trim()) nextNotes[itemId] = trimmed;
      else delete nextNotes[itemId];
      return { ...prev, itemNotes: nextNotes };
    });
  };

  const addCustomItem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const existing = prev.customItems ?? [];
      const next: WarehouseCustomItem = {
        id: newCustomItemId(),
        name: '',
        quantity: 1,
        unit: 'szt.',
        sortOrder: 10_000 + existing.length,
      };
      return { ...prev, customItems: [...existing, next] };
    });
  };

  const updateCustomItem = (itemId: string, patch: Partial<WarehouseCustomItem>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        customItems: (prev.customItems ?? []).map((row) =>
          row.id === itemId ? { ...row, ...patch } : row,
        ),
      };
    });
  };

  const removeCustomItem = (itemId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const skipPack = { ...(prev.skipPack ?? {}) };
      const rental = { ...(prev.rental ?? {}) };
      const itemNotes = { ...(prev.itemNotes ?? {}) };
      delete skipPack[itemId];
      delete rental[itemId];
      delete itemNotes[itemId];
      return {
        ...prev,
        customItems: (prev.customItems ?? []).filter((row) => row.id !== itemId),
        skipPack,
        rental,
        itemNotes,
      };
    });
  };

  const saveDraft = async () => {
    if (!id || !draft) return;
    setSavingDraft(true);
    setError(null);
    try {
      const customItems = (draft.customItems ?? [])
        .map((row, idx) => ({
          id: row.id,
          name: row.name.trim(),
          quantity: Math.max(1, Math.round(Number(row.quantity) || 1)),
          unit: (row.unit || 'szt.').trim() || 'szt.',
          sortOrder: Number.isFinite(row.sortOrder) ? row.sortOrder : 10_000 + idx,
        }))
        .filter((row) => row.name.length > 0);
      const payload: WarehouseDraft = {
        title: draft.title,
        notes: draft.notes,
        skipPack: draft.skipPack ?? {},
        rental: draft.rental ?? {},
        itemNotes: draft.itemNotes ?? {},
        customItems,
      };
      const saved = await orderApi.updateDocumentDraft<WarehouseDraft>(id, 'WAREHOUSE', payload);
      setDraft(
        normalizeWarehouseDraft(saved.payload, order?.name || 'Zlecenie', equipmentSorted),
      );
    } catch (e: any) {
      const raw = e?.response?.data?.error ?? e?.message;
      setError(typeof raw === 'string' ? raw : 'Nie udało się zapisać draftu magazynu.');
    } finally {
      setSavingDraft(false);
    }
  };

  const reloadExports = async () => {
    if (!id) return;
    const list = await orderApi.getDocumentExports(id, 'WAREHOUSE');
    setExports(list);
  };

  const handleDownloadPdf = async () => {
    if (!id || !draft) return;
    setPdfLoading(true);
    setError(null);
    setInfo(null);
    try {
      await saveDraft();
      const result = await downloadOrderWarehousePdf(id);
      await reloadExports();
      if (result.numberReused) {
        setInfo(
          'Treść bez zmian względem ostatniego eksportu — ten sam numer dokumentu. Data w nagłówku PDF jest aktualna; lista snapshotów bez nowego wiersza.',
        );
      } else if (result.exportCreated) {
        setInfo('Zapisano nowy snapshot magazynu i nadano kolejny numer wersji.');
      }
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (!id) return null;

  if (isLoading || loadingDraft) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Ładowanie dokumentu magazynu...</div>
      </div>
    );
  }

  if (isError || !order || !draft) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-muted-foreground">Nie udało się otworzyć dokumentu magazynu.</p>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="px-3 py-1.5 border-2 border-primary text-primary rounded text-sm hover:bg-primary/10"
        >
          Powrót do listy zleceń
        </button>
      </div>
    );
  }

  const previewUrl = getOrderWarehousePdfPreviewUrl(id);
  const hasAnyRows = equipmentSorted.length > 0 || customSorted.length > 0;
  let rowIndex = 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(`/orders/${id}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft size={20} />
          Powrót do zlecenia
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="px-3 py-1.5 text-sm border-2 border-primary text-primary bg-transparent rounded font-medium hover:bg-primary/10 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={16} />
            {pdfLoading ? 'Generowanie PDF…' : 'Pobierz PDF (wydruk)'}
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-2 inline-flex items-center gap-1.5"
          >
            <Eye size={16} />
            Podgląd PDF
          </a>
          <button
            type="button"
            onClick={saveDraft}
            disabled={savingDraft}
            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-2 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save size={16} />
            {savingDraft ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </div>
      </div>

      {info && (
        <div className="max-w-5xl mx-auto px-3 py-2 rounded bg-primary/10 border border-primary/30 text-sm text-foreground">
          {info}
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="max-w-5xl mx-auto rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-sm text-muted-foreground text-center">
        <p className="font-medium text-foreground mb-1">Do wydruku w magazynie</p>
        <p>
          PDF ma ten sam styl nagłówka co oferta i listę sprzętu z <strong>pustymi kratkami</strong> do odhaczenia
          ołówkiem. Pozycje oznaczone „Nie pakować” nie trafiają na PDF. Rental drukuje się jako „R” obok kratki;
          notatka wiersza — pod nazwą. Możesz też dopisać pozycje z ręki. Zapisz przed pobraniem PDF.
        </p>
      </div>

      <div className="max-w-5xl mx-auto bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2 bg-surface-2 border-b border-border flex justify-between text-sm">
          <span>
            Zlecenie: <strong className="font-mono">{orderNumberDisplay}</strong>
          </span>
          <span>{new Date().toLocaleDateString('pl-PL')}</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText size={20} />
            <h1 className="text-lg font-bold">Magazyn / załadunek</h1>
          </div>
          <input
            value={draft.title}
            onChange={(e) => setDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded"
            placeholder="Tytuł na dokumencie PDF"
          />
          <textarea
            value={draft.notes || ''}
            onChange={(e) => setDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded min-h-[80px]"
            placeholder="Notatki na dokumencie PDF (opcjonalnie)"
          />

          <p className="text-xs text-muted-foreground">
            Pozycje ze zlecenia + dopisane ręcznie. Zaznacz „Nie pakować”, „Rental” lub dopisz notatkę.
          </p>

          <div className="overflow-x-auto border border-border rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  <th className="text-left py-2 px-3 w-10">#</th>
                  <th className="text-left py-2 px-3">Nazwa</th>
                  <th className="text-left py-2 px-3 w-16">Ilość</th>
                  <th className="text-left py-2 px-3 w-16">Jednostka</th>
                  <th className="text-center py-2 px-2 w-24" title="Nie trafia na PDF załadunku">
                    Nie pakować
                  </th>
                  <th className="text-center py-2 px-2 w-16">Rental</th>
                  <th className="text-left py-2 px-3 min-w-[160px]">Notatka</th>
                  <th className="text-center py-2 px-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {!hasAnyRows ? (
                  <tr>
                    <td colSpan={8} className="py-3 px-3 text-muted-foreground">
                      Brak pozycji — dodaj sprzęt w zleceniu albo dopisz pozycję z ręki.
                    </td>
                  </tr>
                ) : (
                  <>
                    {equipmentSorted.map((item) => {
                      rowIndex += 1;
                      const skip = !!draft.skipPack?.[item.id];
                      const rental = !!draft.rental?.[item.id];
                      const note = draft.itemNotes?.[item.id] ?? '';
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-border/60 last:border-0 ${skip ? 'opacity-55' : ''}`}
                        >
                          <td className="py-2 px-3 text-muted-foreground align-top">{rowIndex}</td>
                          <td className={`py-2 px-3 align-top ${skip ? 'line-through text-muted-foreground' : ''}`}>
                            {item.name}
                          </td>
                          <td className="py-2 px-3 align-top">{item.quantity ?? 1}</td>
                          <td className="py-2 px-3 align-top">{item.equipment?.unit || 'szt.'}</td>
                          <td className="py-2 px-2 text-center align-top">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={skip}
                              onChange={(e) => updateItemFlag(item.id, 'skipPack', e.target.checked)}
                              title="Nie pakować — pomiń na PDF"
                              aria-label={`Nie pakować: ${item.name ?? item.id}`}
                            />
                          </td>
                          <td className="py-2 px-2 text-center align-top">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={rental}
                              onChange={(e) => updateItemFlag(item.id, 'rental', e.target.checked)}
                              title="Rental"
                              aria-label={`Rental: ${item.name ?? item.id}`}
                            />
                          </td>
                          <td className="py-2 px-3 align-top">
                            <input
                              type="text"
                              className="w-full min-w-[140px] px-2 py-1 text-xs bg-background border border-border rounded"
                              value={note}
                              maxLength={500}
                              placeholder="np. już na sali"
                              onChange={(e) => updateItemNote(item.id, e.target.value)}
                              aria-label={`Notatka: ${item.name ?? item.id}`}
                            />
                          </td>
                          <td className="py-2 px-2 align-top" />
                        </tr>
                      );
                    })}
                    {customSorted.map((item) => {
                      rowIndex += 1;
                      const skip = !!draft.skipPack?.[item.id];
                      const rental = !!draft.rental?.[item.id];
                      const note = draft.itemNotes?.[item.id] ?? '';
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-border/60 last:border-0 bg-surface-2/30 ${skip ? 'opacity-55' : ''}`}
                        >
                          <td className="py-2 px-3 text-muted-foreground align-top">{rowIndex}</td>
                          <td className="py-2 px-3 align-top">
                            <input
                              type="text"
                              className={`w-full min-w-[160px] px-2 py-1 text-xs bg-background border border-border rounded ${skip ? 'line-through text-muted-foreground' : ''}`}
                              value={item.name}
                              maxLength={200}
                              placeholder="Nazwa pozycji ręcznej"
                              onChange={(e) => updateCustomItem(item.id, { name: e.target.value })}
                              aria-label={`Nazwa pozycji ręcznej ${rowIndex}`}
                            />
                          </td>
                          <td className="py-2 px-3 align-top">
                            <input
                              type="number"
                              min={1}
                              className="w-16 px-2 py-1 text-xs bg-background border border-border rounded text-right"
                              value={item.quantity}
                              onChange={(e) =>
                                updateCustomItem(item.id, {
                                  quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                                })
                              }
                              aria-label={`Ilość pozycji ręcznej ${rowIndex}`}
                            />
                          </td>
                          <td className="py-2 px-3 align-top">
                            <input
                              type="text"
                              className="w-16 px-2 py-1 text-xs bg-background border border-border rounded"
                              value={item.unit}
                              maxLength={40}
                              onChange={(e) => updateCustomItem(item.id, { unit: e.target.value })}
                              aria-label={`Jednostka pozycji ręcznej ${rowIndex}`}
                            />
                          </td>
                          <td className="py-2 px-2 text-center align-top">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={skip}
                              onChange={(e) => updateItemFlag(item.id, 'skipPack', e.target.checked)}
                              title="Nie pakować — pomiń na PDF"
                              aria-label={`Nie pakować: ${item.name || item.id}`}
                            />
                          </td>
                          <td className="py-2 px-2 text-center align-top">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={rental}
                              onChange={(e) => updateItemFlag(item.id, 'rental', e.target.checked)}
                              title="Rental"
                              aria-label={`Rental: ${item.name || item.id}`}
                            />
                          </td>
                          <td className="py-2 px-3 align-top">
                            <input
                              type="text"
                              className="w-full min-w-[140px] px-2 py-1 text-xs bg-background border border-border rounded"
                              value={note}
                              maxLength={500}
                              placeholder="np. już na sali"
                              onChange={(e) => updateItemNote(item.id, e.target.value)}
                              aria-label={`Notatka: ${item.name || item.id}`}
                            />
                          </td>
                          <td className="py-2 px-2 text-center align-top">
                            <button
                              type="button"
                              onClick={() => removeCustomItem(item.id)}
                              className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                              title="Usuń pozycję ręczną"
                              aria-label={`Usuń pozycję ręczną ${rowIndex}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-start">
            <button
              type="button"
              onClick={addCustomItem}
              className="px-2.5 py-1 text-xs border border-border rounded hover:bg-surface-2 inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              Dopisz pozycję
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto bg-surface rounded-xl border border-border p-4">
        <div className="text-lg font-bold mb-3">Snapshoty magazynu (historia w systemie)</div>
        {loadingExports ? (
          <div className="text-sm text-muted-foreground">Ładowanie…</div>
        ) : exports.length === 0 ? (
          <div className="text-sm text-muted-foreground">Brak zapisanych snapshotów — użyj „Pobierz PDF (wydruk)”.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3">Numer dokumentu</th>
                  <th className="text-left py-2 pr-3">Data snapshotu</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((exp) => (
                  <tr key={exp.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-mono">{exp.documentNumber}</td>
                    <td className="py-2 pr-3">{new Date(exp.exportedAt).toLocaleString('pl-PL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
