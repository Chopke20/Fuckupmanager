import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Plus, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOrder } from '../hooks/useOrders';
import { orderApi, OrderDocumentExportMeta } from '../api/order.api';
import { formatOrderNumber } from '../utils/orderNumberFormat';
import { groupOrderEquipmentByCategory } from '../utils/groupOrderEquipmentByCategory';

type WarehouseDraft = {
  title: string;
  notes?: string;
};

export default function OrderWarehousePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, isError } = useOrder(id || '');

  const [draft, setDraft] = useState<WarehouseDraft | null>(null);
  const [exports, setExports] = useState<OrderDocumentExportMeta[]>([]);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [loadingExports, setLoadingExports] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [creatingExport, setCreatingExport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoadingDraft(true);
    orderApi
      .getDocumentDraft<WarehouseDraft>(id, 'WAREHOUSE')
      .then((res) => setDraft(res.payload))
      .catch(() => setError('Nie udało się pobrać draftu magazynu.'))
      .finally(() => setLoadingDraft(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadingExports(true);
    orderApi
      .getDocumentExports(id, 'WAREHOUSE')
      .then(setExports)
      .catch(() => setExports([]))
      .finally(() => setLoadingExports(false));
  }, [id]);

  const saveDraft = async () => {
    if (!id || !draft) return;
    setSavingDraft(true);
    setError(null);
    try {
      const saved = await orderApi.updateDocumentDraft<WarehouseDraft>(id, 'WAREHOUSE', draft);
      setDraft(saved.payload);
    } catch (e: any) {
      const raw = e?.response?.data?.error ?? e?.message;
      setError(typeof raw === 'string' ? raw : 'Nie udało się zapisać draftu magazynu.');
    } finally {
      setSavingDraft(false);
    }
  };

  const createSnapshotExport = async () => {
    if (!id) return;
    if (draft) {
      await saveDraft();
    }
    setCreatingExport(true);
    setError(null);
    try {
      const created = await orderApi.createDocumentExport(id, 'WAREHOUSE');
      setExports((prev) => [created, ...prev]);
    } catch (e: any) {
      const raw = e?.response?.data?.error ?? e?.message;
      setError(typeof raw === 'string' ? raw : 'Nie udało się utworzyć snapshotu magazynu.');
    } finally {
      setCreatingExport(false);
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

  const orderNumberDisplay =
    (order as any)?.orderNumber != null && (order as any)?.orderYear != null
      ? formatOrderNumber((order as any).orderNumber, (order as any).orderYear)
      : '—';

  const equipmentRows = (order.equipmentItems || []).filter((item: any) => item.visibleInOffer !== false);
  const equipmentGrouped = useMemo(
    () => groupOrderEquipmentByCategory(equipmentRows as { category?: string | null }[]),
    [equipmentRows]
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => navigate(`/orders/${id}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={20} />
          Powrót do zlecenia
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveDraft}
            disabled={savingDraft}
            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-2 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save size={16} />
            {savingDraft ? 'Zapisywanie...' : 'Zapisz draft'}
          </button>
          <button
            type="button"
            onClick={createSnapshotExport}
            disabled={creatingExport}
            className="px-3 py-1.5 text-sm border-2 border-primary text-primary rounded font-medium hover:bg-primary/10 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus size={16} />
            {creatingExport ? 'Tworzenie...' : 'Utwórz snapshot (eksport)'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
          {error}
        </div>
      )}

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
            placeholder="Tytuł dokumentu"
          />
          <textarea
            value={draft.notes || ''}
            onChange={(e) => setDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded min-h-[80px]"
            placeholder="Notatki do dokumentu (opcjonalnie)"
          />

          <div className="overflow-x-auto border border-border rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  <th className="text-left py-2 px-3">Nazwa</th>
                  <th className="text-left py-2 px-3">Ilość</th>
                  <th className="text-left py-2 px-3">Jednostka</th>
                </tr>
              </thead>
              <tbody>
                {equipmentRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-2 px-3 text-muted-foreground">
                      Brak pozycji
                    </td>
                  </tr>
                ) : (
                  equipmentGrouped.map(({ category, items }) => (
                    <Fragment key={category}>
                      <tr className="bg-surface-2 border-b border-border">
                        <td colSpan={3} className="py-2 px-3 text-sm font-semibold">
                          {category}
                        </td>
                      </tr>
                      {items.map((item: any) => (
                        <tr key={item.id} className="border-b border-border/60 last:border-0">
                          <td className="py-2 px-3">{item.name}</td>
                          <td className="py-2 px-3">{item.quantity}</td>
                          <td className="py-2 px-3">{item.equipment?.unit || 'szt.'}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto bg-surface rounded-xl border border-border p-4">
        <div className="text-lg font-bold mb-3">Snapshoty magazynu (historia)</div>
        {loadingExports ? (
          <div className="text-sm text-muted-foreground">Ładowanie historii eksportów...</div>
        ) : exports.length === 0 ? (
          <div className="text-sm text-muted-foreground">Brak snapshotów magazynu.</div>
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

