import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Eye, FileText, Plus, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOrder } from '../hooks/useOrders';
import {
  orderApi,
  OrderDocumentExportMeta,
  downloadOrderWarehousePdf,
  getOrderWarehousePdfPreviewUrl,
} from '../api/order.api';
import { formatOrderNumber } from '../utils/orderNumberFormat';

type WarehouseDraft = {
  title: string;
  notes?: string;
};

function normalizeWarehouseDraft(payload: unknown, orderName: string): WarehouseDraft {
  const p =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  let title = typeof p.title === 'string' ? p.title.trim() : '';
  if (!title) title = `Magazyn / załadunek - ${orderName}`.trim() || 'Magazyn / załadunek';
  const notes = typeof p.notes === 'string' ? p.notes : '';
  return { title, notes: notes || undefined };
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
  const [creatingExport, setCreatingExport] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const equipmentSorted = useMemo(() => {
    const items = order?.equipmentItems ?? [];
    return [...items].sort((a: { sortOrder?: number }, b: { sortOrder?: number }) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [order?.equipmentItems]);

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
    setLoadingDraft(true);
    setError(null);
    orderApi
      .getDocumentDraft<WarehouseDraft>(id, 'WAREHOUSE')
      .then((res) => setDraft(normalizeWarehouseDraft(res.payload, orderName)))
      .catch(() => {
        setError('Nie udało się pobrać draftu magazynu.');
        setDraft(null);
      })
      .finally(() => setLoadingDraft(false));
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

  const saveDraft = async () => {
    if (!id || !draft) return;
    setSavingDraft(true);
    setError(null);
    try {
      const saved = await orderApi.updateDocumentDraft<WarehouseDraft>(id, 'WAREHOUSE', draft);
      setDraft(normalizeWarehouseDraft(saved.payload, order?.name || 'Zlecenie'));
    } catch (e: any) {
      const raw = e?.response?.data?.error ?? e?.message;
      setError(typeof raw === 'string' ? raw : 'Nie udało się zapisać draftu magazynu.');
    } finally {
      setSavingDraft(false);
    }
  };

  const createSnapshotExport = async () => {
    if (!id) return;
    if (draft) await saveDraft();
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

  const handleDownloadPdf = async () => {
    if (!id) return;
    setPdfLoading(true);
    setError(null);
    try {
      await downloadOrderWarehousePdf(id);
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
            {savingDraft ? 'Zapisywanie…' : 'Zapisz tytuł i notatki'}
          </button>
          <button
            type="button"
            onClick={createSnapshotExport}
            disabled={creatingExport}
            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-2 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus size={16} />
            {creatingExport ? 'Tworzenie…' : 'Snapshot w systemie'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="max-w-3xl rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Do wydruku w magazynie</p>
        <p>
          PDF ma ten sam styl nagłówka co oferta i listę sprzętu z <strong>pustymi kratkami</strong> do odhaczenia ołówkiem.
          Tytuł i notatki poniżej trafiają na dokument — zapisz je przed generowaniem PDF.
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
            Podgląd pozycji (kolejność jak w zleceniu). Na PDF są puste kwadraty zamiast pól do zaznaczania na ekranie.
          </p>

          <div className="overflow-x-auto border border-border rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  <th className="text-left py-2 px-3">#</th>
                  <th className="text-left py-2 px-3">Nazwa</th>
                  <th className="text-left py-2 px-3">Ilość</th>
                  <th className="text-left py-2 px-3">Jednostka</th>
                </tr>
              </thead>
              <tbody>
                {equipmentSorted.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-2 px-3 text-muted-foreground">
                      Brak pozycji sprzętu w zleceniu
                    </td>
                  </tr>
                ) : (
                  equipmentSorted.map((item: { id: string; name?: string; quantity?: number; equipment?: { unit?: string } | null }, idx: number) => (
                    <tr key={item.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-3">{item.name}</td>
                      <td className="py-2 px-3">{item.quantity ?? 1}</td>
                      <td className="py-2 px-3">{item.equipment?.unit || 'szt.'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto bg-surface rounded-xl border border-border p-4">
        <div className="text-lg font-bold mb-3">Snapshoty magazynu (historia w systemie)</div>
        {loadingExports ? (
          <div className="text-sm text-muted-foreground">Ładowanie…</div>
        ) : exports.length === 0 ? (
          <div className="text-sm text-muted-foreground">Brak zapisanych snapshotów.</div>
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
