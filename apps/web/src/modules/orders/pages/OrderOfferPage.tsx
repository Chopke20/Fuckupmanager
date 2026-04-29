import { useEffect, useMemo, useState, useCallback, Fragment } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Eye, Download, Shield, Trash2 } from 'lucide-react';
import type { IssuerProfilePublic } from '@lama-stage/shared-types';
import { useOrder, orderKeys } from '../hooks/useOrders';
import { orderApi, OrderDocumentExportMeta } from '../api/order.api';
import { pdfApi, financeApi } from '../api/pdf.api';
import { formatOrderNumber } from '../utils/orderNumberFormat';
import { groupOrderEquipmentByCategory } from '../utils/groupOrderEquipmentByCategory';
import { apiListIssuerProfiles } from '../../admin/api/issuer-profiles.api';
import { useAuth } from '../../auth/AuthProvider';
import { apiGetAppSettings } from '../../auth/auth.api';

function parseFilenameFromContentDisposition(header: string | undefined, fallback: string) {
  if (!header) return fallback;
  const m = /filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i.exec(header);
  return m?.[1]?.trim() || fallback;
}

type OfferDraft = {
  offerValidityDays: number;
  toinenMusicMode?: boolean;
  /** Preferowane: nowy wybór z listy opiekunów w Admin. */
  projectContactId?: string | null;
  /** Legacy (stare dane) — trzymane dla kompatybilności. */
  projectContactKey?: 'RAFAL' | 'MICHAL' | null;
  currency: 'PLN' | 'EUR';
  exchangeRateEur: number | null;
  vatRate: 0 | 23;
  issuedAt?: string;
  /** Tekst w PDF dla klienta; brak klucza = dotychczasowy fallback na opis ze zlecenia. */
  clientOfferDescription?: string;
  issuer: {
    profileKey: string;
    companyName: string;
    address: string;
    nip: string;
    email: string;
    phone?: string;
  };
};

function issuerPublicToDraftIssuer(p: IssuerProfilePublic): OfferDraft['issuer'] {
  return {
    profileKey: p.profileKey,
    companyName: p.companyName,
    address: p.address,
    nip: p.nip,
    email: p.email,
    phone: p.phone,
  };
}

function parseStageId(stageIds?: string | null): string | null {
  if (!stageIds) return null;
  try {
    const parsed = JSON.parse(stageIds) as string[];
    return parsed[0] ?? null;
  } catch {
    return null;
  }
}

/** Etykiety etapów harmonogramu w podglądzie oferty (spójne z PDF / formularzem zlecenia). */
function stageTypeLabelPl(type?: string | null): string {
  if (!type) return '—';
  const map: Record<string, string> = {
    MONTAZ: 'Montaż',
    EVENT: 'Wydarzenie',
    DEMONTAZ: 'Demontaż',
    CUSTOM: 'Inny',
  };
  return map[type] ?? type;
}

export default function OrderOfferPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManageIssuerProfiles = hasPermission('admin.users.write');
  const { data: order, isLoading, isError } = useOrder(id || '');

  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const [exports, setExports] = useState<OrderDocumentExportMeta[]>([]);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [loadingExports, setLoadingExports] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [exportBusyId, setExportBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  /** Średni kurs NBP (tabela A) — data publikacji tabeli */
  const [eurNbpInfo, setEurNbpInfo] = useState<{ date: string; source: string } | null>(null);
  const [eurLoading, setEurLoading] = useState(false);
  const [clientOfferAiLoading, setClientOfferAiLoading] = useState(false);
  const [clientOfferAiError, setClientOfferAiError] = useState<string | null>(null);
  const issuerProfilesQuery = useQuery({
    queryKey: ['issuer-profiles'],
    queryFn: () => apiListIssuerProfiles(1, 200),
  });
  const issuerRows = issuerProfilesQuery.data?.data ?? [];

  const appSettingsQuery = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => apiGetAppSettings(),
  });

  const projectContacts = useMemo(() => {
    const raw = (appSettingsQuery.data as any)?.projectContacts as any[] | null | undefined;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((c) => ({
        id: typeof c?.id === 'string' ? c.id : '',
        name: typeof c?.name === 'string' ? c.name : '',
        phone: typeof c?.phone === 'string' ? c.phone : '',
        email: typeof c?.email === 'string' ? c.email : '',
      }))
      .filter((c) => c.id && c.name);
  }, [appSettingsQuery.data]);

  const enableToinenMusicMode = useMemo(() => {
    const raw = (appSettingsQuery.data as any)?.enableToinenMusicMode;
    return raw === true;
  }, [appSettingsQuery.data]);

  useEffect(() => {
    if (!id) return;
    setLoadingDraft(true);
    orderApi
      .getDocumentDraft<OfferDraft>(id, 'OFFER')
      .then((res) => setDraft(res.payload))
      .catch(() => setError('Nie udało się pobrać draftu oferty.'))
      .finally(() => setLoadingDraft(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadingExports(true);
    orderApi
      .getDocumentExports(id, 'OFFER')
      .then(setExports)
      .catch(() => setExports([]))
      .finally(() => setLoadingExports(false));
  }, [id]);

  /** Profil z draftu API, którego nie ma w liście z serwera — dołącz do wyboru (snapshot / stary klucz). */
  const issuerProfilesForSelect = useMemo(() => {
    const fromApi = issuerRows.map(issuerPublicToDraftIssuer);
    if (draft && !fromApi.some((p) => p.profileKey === draft.issuer.profileKey)) {
      return [draft.issuer, ...fromApi];
    }
    return fromApi;
  }, [issuerRows, draft?.issuer]);

  const reloadExports = useCallback(async () => {
    if (!id) return;
    const list = await orderApi.getDocumentExports(id, 'OFFER').catch(() => [] as OrderDocumentExportMeta[]);
    setExports(list);
  }, [id]);

  const deleteExport = useCallback(
    async (exportId: string, documentNumber: string) => {
      if (!id) return;
      const ok = window.confirm(
        `Usunąć snapshot oferty ${documentNumber}?\n\nNumer wersji zlecenia (offerVersion / kolejny PDF) zostanie przeliczony z pozostałych snapshotów. Tej operacji nie cofniesz.`
      );
      if (!ok) return;
      setExportBusyId(exportId);
      setError(null);
      try {
        await orderApi.deleteDocumentExport(id, exportId);
        await reloadExports();
        await queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
        setInfo('Usunięto snapshot oferty; numer wersji zaktualizowano.');
      } catch {
        setError('Nie udało się usunąć snapshotu.');
      } finally {
        setExportBusyId(null);
      }
    },
    [id, queryClient, reloadExports]
  );

  const refreshEurFromNbp = useCallback(async () => {
    setEurLoading(true);
    setError(null);
    try {
      const d = await financeApi.getEurExchangeRate();
      if (d && typeof d.rate === 'number' && d.rate > 0) {
        setDraft((prev) => (prev ? { ...prev, exchangeRateEur: d.rate } : prev));
        setEurNbpInfo({ date: d.date, source: d.source ?? 'NBP' });
      }
    } catch {
      setError('Nie udało się pobrać średniego kursu EUR z NBP (tabela A). Możesz wpisać kurs ręcznie.');
    } finally {
      setEurLoading(false);
    }
  }, []);

  /** Automatycznie: średni kurs NBP (tabela A), gdy waluta EUR i brak poprawnego kursu */
  useEffect(() => {
    if (!draft || draft.currency !== 'EUR') {
      return;
    }
    if (draft.exchangeRateEur != null && draft.exchangeRateEur > 0) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setEurLoading(true);
        const d = await financeApi.getEurExchangeRate();
        if (cancelled || !d?.rate || d.rate <= 0) return;
        setDraft((prev) => (prev && prev.currency === 'EUR' ? { ...prev, exchangeRateEur: d.rate } : prev));
        setEurNbpInfo({ date: d.date, source: d.source ?? 'NBP' });
      } catch {
        if (!cancelled) {
          setError('Nie udało się pobrać średniego kursu EUR z NBP. Wpisz kurs ręcznie.');
        }
      } finally {
        if (!cancelled) setEurLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft?.currency, draft?.exchangeRateEur]);

  const equipmentRows = useMemo(() => {
    if (!order) return [];
    return (order.equipmentItems || []).filter((item: any) => item.visibleInOffer !== false);
  }, [order]);

  const equipmentGrouped = useMemo(
    () => groupOrderEquipmentByCategory(equipmentRows as { category?: string | null }[]),
    [equipmentRows]
  );

  const productionRows = useMemo(() => {
    if (!order) return [];
    return (order.productionItems || []).filter((item: any) => item.visibleInOffer !== false && !item.isTransport);
  }, [order]);

  const transportRows = useMemo(() => {
    if (!order) return [];
    return (order.productionItems || []).filter((item: any) => item.visibleInOffer !== false && item.isTransport);
  }, [order]);

  const stagesSummaryForAi = useMemo(() => {
    const stages = (order?.stages || []) as any[];
    if (!stages.length) return '';
    return stages
      .map((s) => {
        const d = new Date(s.date).toLocaleDateString('pl-PL');
        return `${s.type ?? '—'}: ${d}${s.timeStart || s.timeEnd ? ` (${s.timeStart ?? '—'}–${s.timeEnd ?? '—'})` : ''}`;
      })
      .join('\n');
  }, [order]);

  const equipmentSummaryForAi = useMemo(() => {
    if (!equipmentRows.length) return '';
    return equipmentRows.map((item: any) => `${item.name} ×${item.quantity ?? 1}`).join(', ');
  }, [equipmentRows]);

  const canGenerateClientOfferText = useMemo(() => {
    const internal = String((order as any)?.description ?? '').trim();
    return (
      internal.length > 0 ||
      stagesSummaryForAi.trim().length > 0 ||
      equipmentSummaryForAi.trim().length > 0 ||
      String(draft?.clientOfferDescription ?? '').trim().length > 0
    );
  }, [order, stagesSummaryForAi, equipmentSummaryForAi, draft?.clientOfferDescription]);

  const generateClientOfferDescription = useCallback(
    async (retry: boolean) => {
      if (!id || !order || !draft) return;
      setClientOfferAiLoading(true);
      setClientOfferAiError(null);
      try {
        const { description } = await orderApi.generateOfferClientDescription(id, {
          orderName: (order as any).name,
          venue: (order as any).venue ?? undefined,
          clientCompanyName: (order as any)?.client?.companyName ?? undefined,
          startDate: (order as any).startDate
            ? new Date((order as any).startDate).toLocaleDateString('pl-PL')
            : undefined,
          endDate: (order as any).endDate
            ? new Date((order as any).endDate).toLocaleDateString('pl-PL')
            : undefined,
          internalDescription: String((order as any).description ?? '').trim() || undefined,
          stagesSummary: stagesSummaryForAi.trim() || undefined,
          equipmentSummary: equipmentSummaryForAi.trim() || undefined,
          currentClientDescription: draft.clientOfferDescription?.trim() || undefined,
          retry,
        });
        setDraft((prev) => (prev ? { ...prev, clientOfferDescription: description } : prev));
      } catch (e: any) {
        const raw = e?.response?.data?.error;
        const msg =
          typeof raw === 'string'
            ? raw
            : raw && typeof raw.message === 'string'
              ? raw.message
              : typeof e?.message === 'string'
                ? e.message
                : 'Nie udało się wygenerować opisu.';
        setClientOfferAiError(msg);
      } finally {
        setClientOfferAiLoading(false);
      }
    },
    [id, order, draft, stagesSummaryForAi, equipmentSummaryForAi]
  );

  const stageById = useMemo(() => {
    const map = new Map<string, any>();
    (order?.stages || []).forEach((stage: any) => map.set(stage.id, stage));
    return map;
  }, [order]);

  const productionByStage = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const row of productionRows) {
      const stageId = parseStageId(row.stageIds);
      const stage = stageId ? stageById.get(stageId) : null;
      const key = stage?.id || 'NO_STAGE';
      groups[key] = groups[key] || [];
      groups[key].push(row);
    }
    return groups;
  }, [productionRows, stageById]);

  const totals = useMemo(() => {
    const equipmentNet = equipmentRows.reduce((sum: number, item: any) => {
      const base = (item.unitPrice || 0) * (item.quantity || 1);
      const multiDay = (item.days || 1) > 1 ? base + ((item.days || 1) - 1) * base * 0.5 : base;
      return sum + multiDay * (1 - (item.discount || 0) / 100);
    }, 0);
    const productionNet = productionRows.reduce(
      (sum: number, item: any) => sum + (item.rateValue || 0) * (item.units || 1) * (1 - (item.discount || 0) / 100),
      0
    );
    const transportNet = transportRows.reduce(
      (sum: number, item: any) => sum + (item.rateValue || 0) * (item.units || 1) * (1 - (item.discount || 0) / 100),
      0
    );
    const revenueNet = equipmentNet + productionNet + transportNet;
    const discountGlobal = (order as any)?.discountGlobal || 0;
    const discountAmount = revenueNet * discountGlobal / 100;
    const netAfterDiscount = revenueNet - discountAmount;
    const vatRate = draft?.vatRate ?? ((order as any)?.vatRate === 0 ? 0 : 23);
    const vatAmount = netAfterDiscount * vatRate / 100;
    const grossTotal = netAfterDiscount + vatAmount;

    let repetitions = 1;
    try {
      const cfg = JSON.parse((order as any)?.recurringConfig || '{}') as { repetitions?: number };
      repetitions = Math.max(1, cfg.repetitions ?? 1);
    } catch {
      repetitions = 1;
    }

    return {
      equipmentNet,
      productionNet,
      transportNet,
      revenueNet,
      discountAmount,
      netAfterDiscount,
      vatRate,
      vatAmount,
      grossTotal,
      repetitions,
    };
  }, [order, draft, equipmentRows, productionRows, transportRows]);

  const orderNumberDisplay =
    (order as any)?.orderNumber != null && (order as any)?.orderYear != null
      ? formatOrderNumber((order as any).orderNumber, (order as any).orderYear)
      : '—';

  const issuedAtDisplay = draft?.issuedAt ? new Date(draft.issuedAt).toLocaleDateString('pl-PL') : new Date().toLocaleDateString('pl-PL');

  const previewOfferPdf = async () => {
    if (!id || !draft) return;
    if (draft.currency === 'EUR' && (draft.exchangeRateEur == null || draft.exchangeRateEur <= 0)) {
      setError('Dla waluty EUR podaj dodatni kurs EUR przed otwarciem PDF.');
      return;
    }
    setLoadingPreview(true);
    setError(null);
    setInfo(null);
    try {
      const saved = await orderApi.updateDocumentDraft<OfferDraft>(id, 'OFFER', draft);
      setDraft(saved.payload);
      const res = await pdfApi.previewOffer(id);
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) {
      let msg = 'Nie udało się otworzyć oferty PDF.';
      const data = e?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const j = JSON.parse(text) as { error?: string };
          if (typeof j?.error === 'string') msg = j.error;
        } catch {
          /* ignore */
        }
      } else if (data && typeof data === 'object') {
        const err = (data as { error?: string | { message?: string } }).error;
        if (typeof err === 'string') msg = err;
        else if (err && typeof err.message === 'string') msg = err.message;
      } else if (typeof e?.message === 'string' && e.message !== 'Request failed with status code 500') {
        msg = e.message;
      }
      setError(msg);
    } finally {
      setLoadingPreview(false);
    }
  };

  const generateOfferPdf = async () => {
    if (!id || !draft) return;
    if (draft.currency === 'EUR' && (draft.exchangeRateEur == null || draft.exchangeRateEur <= 0)) {
      setError('Dla waluty EUR podaj dodatni kurs EUR przed generowaniem PDF.');
      return;
    }
    setLoadingGenerate(true);
    setError(null);
    setInfo(null);
    try {
      const saved = await orderApi.updateDocumentDraft<OfferDraft>(id, 'OFFER', draft);
      setDraft(saved.payload);
      const res = await pdfApi.generateOffer(id);
      const reused = res.headers['x-offer-number-reused'] === '1';
      if (reused) {
        setInfo(
          'Treść oferty bez zmian względem ostatniego eksportu — ten sam numer oferty (OFR-YY-NNNN-v#). Data w nagłówku PDF jest aktualna; lista snapshotów bez nowego wiersza.'
        );
      } else {
        setInfo('Zapisano nowy snapshot oferty i nadano kolejny numer wersji.');
      }
      const blob = res.data;
      const name = parseFilenameFromContentDisposition(
        res.headers['content-disposition'],
        'Oferta.pdf'
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
      await reloadExports();
    } catch (e: any) {
      let msg = 'Nie udało się wygenerować oferty PDF.';
      const data = e?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const j = JSON.parse(text) as { error?: string };
          if (typeof j?.error === 'string') msg = j.error;
        } catch {
          /* ignore */
        }
      } else if (data && typeof data === 'object') {
        const err = (data as { error?: string | { message?: string } }).error;
        if (typeof err === 'string') msg = err;
        else if (err && typeof err.message === 'string') msg = err.message;
      } else if (typeof e?.message === 'string' && e.message !== 'Request failed with status code 500') {
        msg = e.message;
      }
      setError(msg);
    } finally {
      setLoadingGenerate(false);
    }
  };

  const openExportPreview = async (exportId: string) => {
    setExportBusyId(exportId);
    setError(null);
    try {
      const res = await pdfApi.offerPdfFromExport(exportId, { inline: true });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    } catch (e: any) {
      let msg = 'Nie udało się otworzyć podglądu.';
      const data = e?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const j = JSON.parse(text) as { error?: string };
          if (typeof j?.error === 'string') msg = j.error;
        } catch {
          /* ignore */
        }
      } else if (data && typeof data === 'object') {
        const err = (data as { error?: string | { message?: string } }).error;
        if (typeof err === 'string') msg = err;
        else if (err && typeof err.message === 'string') msg = err.message;
      }
      setError(msg);
    } finally {
      setExportBusyId(null);
    }
  };

  const downloadExportPdf = async (exportId: string) => {
    setExportBusyId(exportId);
    setError(null);
    try {
      const res = await pdfApi.offerPdfFromExport(exportId);
      const name = parseFilenameFromContentDisposition(
        res.headers['content-disposition'],
        'Oferta.pdf'
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      let msg = 'Nie udało się pobrać PDF.';
      const data = e?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const j = JSON.parse(text) as { error?: string };
          if (typeof j?.error === 'string') msg = j.error;
        } catch {
          /* ignore */
        }
      } else if (data && typeof data === 'object') {
        const err = (data as { error?: string | { message?: string } }).error;
        if (typeof err === 'string') msg = err;
        else if (err && typeof err.message === 'string') msg = err.message;
      }
      setError(msg);
    } finally {
      setExportBusyId(null);
    }
  };

  if (!id) return null;

  if (isLoading || loadingDraft) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Ładowanie dokumentu oferty...</div>
      </div>
    );
  }

  if (isError || !order || !draft) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-muted-foreground">Nie udało się otworzyć dokumentu oferty.</p>
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

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(`/orders/${id}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={20} />
          Powrót do zlecenia
        </button>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={previewOfferPdf}
            disabled={loadingPreview || loadingGenerate}
            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-2 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Eye size={16} />
            {loadingPreview ? '…' : 'Podgląd PDF'}
          </button>
          <button
            type="button"
            onClick={generateOfferPdf}
            disabled={loadingPreview || loadingGenerate}
            className="px-3 py-1.5 text-sm border-2 border-primary text-primary rounded font-medium hover:bg-primary/10 flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileText size={16} />
            {loadingGenerate ? 'Generowanie…' : 'Generuj PDF (numer)'}
          </button>
        </div>
      </div>

      {info && (
        <div className="px-3 py-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-sm max-w-3xl">
          {info}
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="max-w-6xl mx-auto bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2 bg-surface-2 border-b border-border flex justify-between text-sm">
          <span>
            Zlecenie: <strong className="font-mono">{orderNumberDisplay}</strong>
          </span>
          <span>Data dokumentu: {issuedAtDisplay}</span>
        </div>

        <div className="p-4 space-y-6">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="border border-border rounded p-3 space-y-2">
              <div className="text-sm font-semibold">Dane firmy składającej ofertę</div>
              <div className="flex gap-2">
                <select
                  value={draft.issuer.profileKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    const preset = issuerProfilesForSelect.find((x) => x.profileKey === key);
                    if (preset) setDraft((prev) => (prev ? { ...prev, issuer: { ...preset } } : prev));
                  }}
                  disabled={issuerProfilesQuery.isLoading}
                  className="flex-1 min-w-0 px-3 py-2 text-sm bg-background border border-border rounded"
                >
                  {issuerProfilesForSelect.map((p) => (
                    <option key={p.profileKey} value={p.profileKey}>
                      {p.companyName}
                    </option>
                  ))}
                </select>
                {canManageIssuerProfiles && (
                  <Link
                    to="/admin"
                    className="shrink-0 px-2.5 py-2 text-sm border border-border rounded hover:bg-surface-2 flex items-center gap-1.5"
                    title="Zarządzaj profilami firmy i domyślnym profilem"
                  >
                    <Shield size={16} />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Profile firmy są w bazie (wspólne dla całej aplikacji). Domyślny profil ustawiasz w Admin → Profile firmy.
                {issuerProfilesQuery.isError && ' Nie udało się załadować listy profili — odśwież stronę.'}
              </p>
              <input
                value={draft.issuer.companyName}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, issuer: { ...prev.issuer, companyName: e.target.value } } : prev))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded"
                placeholder="Nazwa firmy"
              />
              <input
                value={draft.issuer.address}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, issuer: { ...prev.issuer, address: e.target.value } } : prev))}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded"
                placeholder="Adres"
              />
              <div className="grid md:grid-cols-2 gap-2">
                <input
                  value={draft.issuer.nip}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, issuer: { ...prev.issuer, nip: e.target.value } } : prev))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded"
                  placeholder="NIP"
                />
                <input
                  value={draft.issuer.email}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, issuer: { ...prev.issuer, email: e.target.value } } : prev))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded"
                  placeholder="E-mail"
                />
              </div>
              <input
                value={draft.issuer.phone ?? ''}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev ? { ...prev, issuer: { ...prev.issuer, phone: e.target.value || undefined } } : prev
                  )
                }
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded"
                placeholder="Telefon (opcjonalnie)"
              />
            </div>

            <div className="border border-border rounded p-3 space-y-2">
              <div className="text-sm font-semibold">Dane klienta (ze zlecenia)</div>
              <div className="text-sm font-medium">{(order as any)?.client?.companyName || '—'}</div>
              {(order as any)?.client?.address && <div className="text-sm text-muted-foreground">{(order as any).client.address}</div>}
              {(order as any)?.client?.nip && <div className="text-sm text-muted-foreground">NIP: {(order as any).client.nip}</div>}
              {(order as any)?.client?.email && <div className="text-sm text-muted-foreground">{(order as any).client.email}</div>}
            </div>
          </div>

          <div>
            <div className="font-semibold mb-1">Opis w ofercie (dla klienta, PDF)</div>
            <p className="text-xs text-muted-foreground mb-2">
              Tekst widoczny w dokumencie oferty. Wygeneruj z AI na podstawie danych zlecenia (w tym opisu wewnętrznego
              z formularza zlecenia — nie jest tu wyświetlany), harmonogramu i sprzętu, potem popraw ręcznie. Zapis
              draftu: „Podgląd PDF” lub „Generuj PDF”.
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => generateClientOfferDescription(false)}
                disabled={clientOfferAiLoading || !canGenerateClientOfferText}
                className="px-2.5 py-1 text-xs border border-border rounded hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                {clientOfferAiLoading ? 'Generowanie…' : 'Generuj z AI'}
              </button>
              <button
                type="button"
                onClick={() => generateClientOfferDescription(true)}
                disabled={clientOfferAiLoading || !canGenerateClientOfferText}
                className="px-2.5 py-1 text-xs border border-border rounded hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                Generuj ponownie
              </button>
            </div>
            {clientOfferAiError && <p className="text-xs text-red-500 mb-2">{clientOfferAiError}</p>}
            <textarea
              className="w-full min-h-[140px] px-3 py-2 text-sm bg-background border border-border rounded whitespace-pre-wrap"
              value={draft.clientOfferDescription ?? ''}
              onChange={(e) =>
                setDraft((prev) =>
                  prev ? { ...prev, clientOfferDescription: e.target.value } : prev
                )
              }
              placeholder="Wygeneruj lub wpisz tekst dla klienta…"
            />
          </div>

          <div>
            <div className="font-semibold mb-1">Harmonogram</div>
            <div className="overflow-x-auto border border-border rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 border-b border-border">
                    <th className="text-left py-2 px-3">Etap</th>
                    <th className="text-left py-2 px-3">Data</th>
                    <th className="text-left py-2 px-3">Godziny</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.stages || []).map((stage: any) => (
                    <tr key={stage.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 px-3">{stageTypeLabelPl(stage.type)}</td>
                      <td className="py-2 px-3">{new Date(stage.date).toLocaleDateString('pl-PL')}</td>
                      <td className="py-2 px-3">{stage.timeStart || '—'} - {stage.timeEnd || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="font-semibold mb-1">Wykaz sprzętu</div>
            <div className="overflow-x-auto border border-border rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 border-b border-border">
                    <th className="text-left py-2 px-3">Nazwa</th>
                    <th className="text-left py-2 px-3">Ilość</th>
                    <th className="text-left py-2 px-3">Stawka</th>
                    <th className="text-left py-2 px-3">Wartość netto</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-2 px-3 text-muted-foreground">
                        Brak pozycji
                      </td>
                    </tr>
                  ) : (
                    equipmentGrouped.map(({ category, items }) => (
                      <Fragment key={category}>
                        <tr className="bg-surface-2 border-b border-border">
                          <td colSpan={4} className="py-2 px-3 text-sm font-semibold">
                            {category}
                          </td>
                        </tr>
                        {items.map((item: any) => {
                          const base = (item.unitPrice || 0) * (item.quantity || 1);
                          const multiDay =
                            (item.days || 1) > 1 ? base + ((item.days || 1) - 1) * base * 0.5 : base;
                          const rowNet = multiDay * (1 - (item.discount || 0) / 100);
                          return (
                            <tr key={item.id} className="border-b border-border/60 last:border-0">
                              <td className="py-2 px-3">{item.name}</td>
                              <td className="py-2 px-3">{item.quantity}</td>
                              <td className="py-2 px-3">
                                {(item.unitPrice || 0).toFixed(2)} {draft.currency}
                              </td>
                              <td className="py-2 px-3">{rowNet.toFixed(2)} {draft.currency}</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="font-semibold mb-1">Produkcja i logistyka (wg etapów)</div>
            <div className="space-y-3">
              {Object.keys(productionByStage).map((stageKey) => {
                const rows = productionByStage[stageKey] || [];
                const stage = stageById.get(stageKey);
                const stageLabel = stage
                  ? `${stageTypeLabelPl(stage.type)} (${new Date(stage.date).toLocaleDateString('pl-PL')})`
                  : 'Bez etapu';
                return (
                  <div key={stageKey} className="border border-border rounded overflow-hidden">
                    <div className="px-3 py-2 bg-surface-2 border-b border-border text-sm font-medium">{stageLabel}</div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3">Nazwa</th>
                          <th className="text-left py-2 px-3">Ilość</th>
                          <th className="text-left py-2 px-3">Stawka</th>
                          <th className="text-left py-2 px-3">Netto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((item: any) => (
                          <tr key={item.id} className="border-b border-border/60 last:border-0">
                            <td className="py-2 px-3">{item.name}</td>
                            <td className="py-2 px-3">{item.units}</td>
                            <td className="py-2 px-3">{(item.rateValue || 0).toFixed(2)} {draft.currency}</td>
                            <td className="py-2 px-3">
                              {((item.rateValue || 0) * (item.units || 1) * (1 - (item.discount || 0) / 100)).toFixed(2)} {draft.currency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="font-semibold mb-1">Transport</div>
            <div className="overflow-x-auto border border-border rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 border-b border-border">
                    <th className="text-left py-2 px-3">Nazwa</th>
                    <th className="text-left py-2 px-3">Etap</th>
                    <th className="text-left py-2 px-3">Kwota netto</th>
                  </tr>
                </thead>
                <tbody>
                  {transportRows.map((item: any) => {
                    const stage = stageById.get(parseStageId(item.stageIds) || '');
                    const stageLabel = stage
                      ? `${stageTypeLabelPl(stage.type)} (${new Date(stage.date).toLocaleDateString('pl-PL')})`
                      : 'Bez etapu';
                    const rowNet = (item.rateValue || 0) * (item.units || 1) * (1 - (item.discount || 0) / 100);
                    return (
                      <tr key={item.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 px-3">{item.name}</td>
                        <td className="py-2 px-3">{stageLabel}</td>
                        <td className="py-2 px-3">{rowNet.toFixed(2)} {draft.currency}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {(order as any)?.isRecurring ? (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="border border-border rounded p-3 space-y-1">
                <div className="font-semibold">Dla jednego wydarzenia</div>
                <div className="text-sm">Rabat: {totals.discountAmount.toFixed(2)} {draft.currency}</div>
                <div className="text-sm">Suma netto: {totals.netAfterDiscount.toFixed(2)} {draft.currency}</div>
                <div className="text-sm">VAT ({totals.vatRate}%): {totals.vatAmount.toFixed(2)} {draft.currency}</div>
                <div className="font-semibold">Suma brutto: {totals.grossTotal.toFixed(2)} {draft.currency}</div>
              </div>
              <div className="border border-border rounded p-3 space-y-1">
                <div className="font-semibold">Dla cyklu ({totals.repetitions} wydarzeń)</div>
                <div className="text-sm">Rabat: {(totals.discountAmount * totals.repetitions).toFixed(2)} {draft.currency}</div>
                <div className="text-sm">Suma netto: {(totals.netAfterDiscount * totals.repetitions).toFixed(2)} {draft.currency}</div>
                <div className="text-sm">VAT ({totals.vatRate}%): {(totals.vatAmount * totals.repetitions).toFixed(2)} {draft.currency}</div>
                <div className="font-semibold">Suma brutto: {(totals.grossTotal * totals.repetitions).toFixed(2)} {draft.currency}</div>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded p-3 space-y-1">
              <div className="text-sm">Rabat: {totals.discountAmount.toFixed(2)} {draft.currency}</div>
              <div className="text-sm">Suma netto: {totals.netAfterDiscount.toFixed(2)} {draft.currency}</div>
              <div className="text-sm">VAT ({totals.vatRate}%): {totals.vatAmount.toFixed(2)} {draft.currency}</div>
              <div className="font-semibold">Suma brutto: {totals.grossTotal.toFixed(2)} {draft.currency}</div>
            </div>
          )}

          <div className="border border-border rounded p-3 grid md:grid-cols-5 gap-2">
            <label className="text-sm">
              Termin ważności (dni)
              <input
                type="number"
                min={1}
                max={180}
                value={draft.offerValidityDays}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, offerValidityDays: Number(e.target.value) || 14 } : prev))}
                className="mt-1 w-full px-2 py-1 text-sm bg-background border border-border rounded"
              />
            </label>
            <div className="text-sm">
              <div className="mb-1">Opiekun projektu</div>
              {projectContacts.length > 0 ? (
                <select
                  value={draft.projectContactId ?? ''}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, projectContactId: e.target.value || null } : prev
                    )
                  }
                  className="mt-1 w-full px-2 py-1 text-sm bg-background border border-border rounded"
                  title="Wybór opiekuna projektu dla tego dokumentu"
                >
                  <option value="">Domyślny (z Admina)</option>
                  {projectContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` • ${c.phone}` : ''}
                      {c.email ? ` • ${c.email}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1 w-full px-2 py-1 text-sm bg-surface border border-border rounded text-muted-foreground">
                  Brak opiekunów projektu w Admin → Dokumenty i komunikacja.
                </div>
              )}
            </div>
            <label className="text-sm">
              Waluta
              <select
                value={draft.currency}
                onChange={(e) => {
                  const c = e.target.value as 'PLN' | 'EUR';
                  setDraft((prev) => {
                    if (!prev) return prev;
                    if (c === 'PLN') return { ...prev, currency: c, exchangeRateEur: null };
                    return { ...prev, currency: c };
                  });
                  if (e.target.value === 'PLN') setEurNbpInfo(null);
                }}
                className="mt-1 w-full px-2 py-1 text-sm bg-background border border-border rounded"
              >
                <option value="PLN">PLN</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label className="text-sm">
              VAT
              <select
                value={draft.vatRate}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, vatRate: Number(e.target.value) as 0 | 23 } : prev))}
                className="mt-1 w-full px-2 py-1 text-sm bg-background border border-border rounded"
              >
                <option value={23}>23%</option>
                <option value={0}>0%</option>
              </select>
            </label>
            {draft.currency === 'EUR' && (
              <div className="md:col-span-5 space-y-1 pt-1 border-t border-border/60 mt-1">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm flex-1 min-w-[200px]">
                    Kurs EUR (PLN za 1 EUR — średni NBP, tabela A)
                    <input
                      type="number"
                      min={0}
                      step={0.0001}
                      value={draft.exchangeRateEur ?? ''}
                      placeholder={eurLoading ? '…' : 'np. 4,25'}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                exchangeRateEur: v === '' ? null : Number(v) || null,
                              }
                            : prev
                        );
                      }}
                      className="mt-1 w-full px-2 py-1 text-sm bg-background border border-border rounded"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => refreshEurFromNbp()}
                    disabled={eurLoading}
                    className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-2 disabled:opacity-50 shrink-0 mb-0.5"
                  >
                    {eurLoading ? 'Pobieranie…' : 'Odśwież z NBP'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {eurLoading
                    ? 'Łączenie z API NBP (średni kurs z ostatniej opublikowanej tabeli typu A)…'
                    : eurNbpInfo
                      ? `Ustawiono ze średniego kursu NBP — tabela z dnia ${eurNbpInfo.date} (${eurNbpInfo.source}). Możesz poprawić ręcznie.`
                      : 'Przy pierwszym wyborze EUR kurs ustawia się automatycznie. Możesz go zmienić lub odświeżyć z NBP.'}
                </p>
              </div>
            )}
            {enableToinenMusicMode ? (
              <label className="text-sm md:col-span-5 flex items-center gap-2 pt-2 border-t border-border/60 mt-1">
                <input
                  type="checkbox"
                  checked={Boolean(draft.toinenMusicMode)}
                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, toinenMusicMode: e.target.checked } : prev))}
                />
                <span>Toinen Music mode (PDF)</span>
              </label>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto bg-surface rounded-xl border border-border p-4">
        <div className="text-lg font-bold mb-1 flex items-center gap-2">
          <FileText size={20} />
          Snapshoty oferty (historia)
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Numer oferty: <span className="font-mono">OFR-YY-NNNN-v#</span> — nadawany przy pierwszym eksporcie z nową treścią. Usunięcie snapshotu przelicza{' '}
          <span className="font-mono">wersję</span> z pozostałych zapisów (lub reset, gdy nie ma żadnego).
        </p>
        {loadingExports ? (
          <div className="text-sm text-muted-foreground">Ładowanie historii eksportów...</div>
        ) : exports.length === 0 ? (
          <div className="text-sm text-muted-foreground">Brak zapisanych snapshotów — użyj „Generuj PDF (numer)”.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3">Numer oferty</th>
                  <th className="text-left py-2 pr-3">Data eksportu</th>
                  <th className="text-right py-2 pl-3">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((exp) => (
                  <tr key={exp.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-mono">{exp.documentNumber}</td>
                    <td className="py-2 pr-3">{new Date(exp.exportedAt).toLocaleString('pl-PL')}</td>
                    <td className="py-2 pl-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openExportPreview(exp.id)}
                        disabled={exportBusyId !== null}
                        className="inline-flex items-center gap-1 px-2 py-1 mr-1 rounded border border-border hover:bg-surface-2 text-xs disabled:opacity-50"
                      >
                        <Eye size={14} />
                        Podgląd
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadExportPdf(exp.id)}
                        disabled={exportBusyId !== null}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-surface-2 text-xs disabled:opacity-50"
                      >
                        <Download size={14} />
                        Pobierz
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteExport(exp.id, exp.documentNumber)}
                        disabled={exportBusyId !== null}
                        title="Usuń snapshot"
                        className="inline-flex items-center gap-1 px-2 py-1 ml-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 text-xs disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        Usuń
                      </button>
                    </td>
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

