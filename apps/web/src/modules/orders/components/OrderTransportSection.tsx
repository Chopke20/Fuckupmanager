import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, Settings } from 'lucide-react';
import { OrderProductionItem, OrderStage } from '@lama-stage/shared-types';
import { financeApi } from '../api/pdf.api';
import { shouldAskForTransportRecalculation } from '../utils/transportPricing';

interface TransportPricingSettings {
  ranges: Array<{
    fromKm: number;
    toKm: number;
    flatNet: number;
  }>;
  longDistancePerKm: number;
  updatedAt?: string;
}

interface TransportQuote {
  distanceKm: number;
  trips: number;
  mode: 'RANGE_FLAT' | 'LONG_KM';
  baseNetPerTrip: number;
  totalNet: number;
  formula: string;
  longDistanceFromKm: number;
  matchedRange: { fromKm: number; toKm: number; flatNet: number } | null;
  settings: TransportPricingSettings;
}

interface OrderTransportSectionProps {
  items: Partial<OrderProductionItem>[];
  stages: Partial<OrderStage>[];
  orderDateFrom?: string | Date;
  orderDateTo?: string | Date;
  distanceKm: number | null;
  onChange: (items: Partial<OrderProductionItem>[]) => void;
}

type TransportTarget = {
  key: string;
  stageId: string;
  label: string;
  assignment: string;
  dateKey?: string;
};

function toDateKey(value?: string | Date) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateKey(dateKey?: string) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-');
  if (!y || !m || !d) return dateKey;
  return `${d}.${m}.${y}`;
}

function stageTypeLabel(type?: string) {
  if (type === 'MONTAZ') return 'Montaż';
  if (type === 'DEMONTAZ') return 'Demontaż';
  if (type === 'EVENT') return 'Wydarzenie';
  if (type === 'PROBA') return 'Próba';
  return 'Etap';
}

function transportNameFromStage(stage?: Partial<OrderStage> | null, fallback = 'Transport') {
  if (!stage) return fallback;
  const customLabel = String(stage.label || '').trim()
  if (customLabel) return `Transport - ${customLabel}`
  return `Transport - ${stageTypeLabel(stage.type)}`;
}

function countOrderDays(from?: string | Date, to?: string | Date) {
  const fromKey = toDateKey(from as any);
  const toKey = toDateKey(to as any);
  if (!fromKey || !toKey) return 1;
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 1;
  const start = new Date(fy, fm - 1, fd).getTime();
  const end = new Date(ty, tm - 1, td).getTime();
  if (end < start) return 1;
  return Math.max(1, Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1);
}

function pickTransportTargets(
  stages: Partial<OrderStage>[],
  orderDateFrom?: string | Date,
  orderDateTo?: string | Date
): TransportTarget[] {
  const orderFromDateKey = toDateKey(orderDateFrom as any);
  const orderToDateKey = toDateKey(orderDateTo as any);
  const orderDays = countOrderDays(orderDateFrom, orderDateTo);
  const hasSecondLine = orderDays > 1;

  const datedStages = stages
    .filter((s): s is Partial<OrderStage> & { id: string; date: string | Date } => Boolean(s?.id && s?.date))
    .map((s) => ({ ...s, dateKey: toDateKey(s.date as any) }))
    .filter((s) => s.dateKey);

  const fromOrderDatesFallback = (): TransportTarget[] => {
    if (hasSecondLine && orderFromDateKey && orderToDateKey) {
      return [
        {
          key: 'ORDER_DAY_1',
          stageId: '',
          label: 'Transport',
          assignment: `Dzień 1 (${formatDateKey(orderFromDateKey)})`,
          dateKey: orderFromDateKey,
        },
        {
          key: 'ORDER_DAY_2',
          stageId: '',
          label: 'Transport - dodatkowy dzień',
          assignment: `Dzień końca (${formatDateKey(orderToDateKey)})`,
          dateKey: orderToDateKey,
        },
      ];
    }
    return [
      {
        key: 'MAIN',
        stageId: '',
        label: 'Transport',
        assignment: orderFromDateKey ? `Całe zlecenie (${formatDateKey(orderFromDateKey)})` : 'Całe zlecenie',
        dateKey: orderFromDateKey || orderToDateKey || undefined,
      },
    ];
  };

  if (datedStages.length === 0) {
    return fromOrderDatesFallback();
  }

  const sortedStages = [...datedStages].sort((a, b) => {
    if (a.dateKey < b.dateKey) return -1;
    if (a.dateKey > b.dateKey) return 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
  const montage = sortedStages.find((s) => s.type === 'MONTAZ');
  const demontaz = sortedStages.find((s) => s.type === 'DEMONTAZ');
  const firstStage = montage ?? sortedStages[0];
  const lastStage = demontaz ?? sortedStages[sortedStages.length - 1];

  const firstTarget: TransportTarget = {
    key: 'MAIN',
    stageId: firstStage?.id || '',
    label: 'Transport',
    assignment: firstStage ? `${firstStage.type || 'ETAP'} (${formatDateKey(firstStage.dateKey)})` : 'Całe zlecenie',
    dateKey: firstStage?.dateKey,
  };

  if (!hasSecondLine) return [firstTarget];

  const secondTarget: TransportTarget = {
    key: 'SECOND',
    stageId: lastStage?.id || '',
    label: 'Transport - dodatkowy dzień',
    assignment: lastStage ? `${lastStage.type || 'ETAP'} (${formatDateKey(lastStage.dateKey)})` : 'Dodatkowy dzień',
    dateKey: lastStage?.dateKey,
  };

  return [firstTarget, secondTarget];
}

function normalizeRanges(
  rows: Array<{ fromKm: number; toKm: number; flatNet: number }>
): Array<{ fromKm: number; toKm: number; flatNet: number }> {
  return [...rows]
    .map((row) => ({
      fromKm: Number(row.fromKm) || 0,
      toKm: Number(row.toKm) || 0,
      flatNet: Number(row.flatNet) || 0,
    }))
    .sort((a, b) => a.fromKm - b.fromKm);
}

function validateRanges(rows: Array<{ fromKm: number; toKm: number; flatNet: number }>): string | null {
  if (rows.length === 0) return 'Dodaj co najmniej jeden przedział.'
  const firstRow = rows[0]
  if (!firstRow || firstRow.fromKm !== 0) return 'Pierwszy przedział musi zaczynać się od 0 km.'

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row) return `Wiersz ${i + 1}: brak danych.`
    if (row.toKm <= row.fromKm) return `Wiersz ${i + 1}: pole "do km" musi być większe od "od km".`
    if (row.flatNet < 0) return `Wiersz ${i + 1}: stawka nie może być ujemna.`
    const next = rows[i + 1]
    if (next && row.toKm !== next.fromKm) {
      return `Wiersz ${i + 2}: "od km" musi być równe "do km" poprzedniego wiersza.`
    }
  }

  return null
}

export default function OrderTransportSection({
  items = [],
  stages = [],
  orderDateFrom,
  orderDateTo,
  distanceKm,
  onChange,
}: OrderTransportSectionProps) {
  const [settings, setSettings] = useState<TransportPricingSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<TransportPricingSettings | null>(null);
  const [quote, setQuote] = useState<TransportQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoRowIndex, setInfoRowIndex] = useState<number | null>(null);

  const lastDistanceRef = useRef<number | null>(null);
  const lastQuoteBaseRef = useRef<number | null>(null);
  const lastTargetsLengthRef = useRef<number>(0);
  /** Po pierwszym przebiegu synchronizacji nie dokładamy wierszy „dodatkowy dzień” tylko dlatego, że zlecenie jest wielodniowe — tylko przy realnej zmianie liczby celów transportu (np. harmonogram). */
  const transportSyncInitializedRef = useRef(false);

  useEffect(() => {
    setLoadingSettings(true);
    financeApi
      .getTransportPricingSettings()
      .then((data) => {
        setSettings(data);
        setSettingsDraft(data);
      })
      .catch(() => setError('Nie udało się pobrać ustawień transportu.'))
      .finally(() => setLoadingSettings(false));
  }, []);

  const targets = useMemo(() => pickTransportTargets(stages, orderDateFrom, orderDateTo), [stages, orderDateFrom, orderDateTo]);
  const explanation = useMemo(() => {
    if (distanceKm == null) {
      return 'Brak odległości z Google Places. Ustaw koszt ręcznie albo wybierz miejsce z placeId.';
    }
    if (loadingQuote) return 'Trwa wyliczanie transportu...';
    if (!quote) return 'Brak breakdownu transportu.';
    return `${quote.formula} => ${quote.baseNetPerTrip.toFixed(2)} PLN netto / przejazd, łącznie ${quote.totalNet.toFixed(2)} PLN netto.`;
  }, [distanceKm, quote, loadingQuote]);

  const hasManualOverride = useMemo(
    () => items.some((item) => item.isAutoCalculated === false),
    [items]
  );

  const stageOptions = useMemo(
    () =>
      [...stages]
        .filter((s): s is Partial<OrderStage> & { id: string } => Boolean(s?.id))
        .sort((a, b) => {
          const ak = toDateKey(a.date as any);
          const bk = toDateKey(b.date as any);
          if (ak < bk) return -1;
          if (ak > bk) return 1;
          return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        })
        .map((s) => ({
          id: s.id,
          label: `${s.type || 'ETAP'}${s.date ? ` (${new Date(s.date as any).toLocaleDateString('pl-PL')})` : ''}`,
        })),
    [stages]
  );

  const buildAutoRows = (sourceItems: Partial<OrderProductionItem>[], activeTargets: TransportTarget[] = targets) => {
    const amount = quote?.baseNetPerTrip ?? 0;

    const baseRows = activeTargets.map((target, idx) => {
      const existing = sourceItems[idx];
      return {
        id: existing?.id || `temp-transport-${target.key}-${Date.now()}-${idx}`,
        orderId: existing?.orderId || '',
        name: existing?.name || target.label,
        description: existing?.description || target.assignment || undefined,
        rateType: 'FLAT' as const,
        rateValue: amount,
        units: 1,
        discount: 0,
        stageIds: target.stageId ? JSON.stringify([target.stageId]) : undefined,
        isTransport: true,
        isAutoCalculated: true,
        isSubcontractor: false,
        visibleInOffer: true,
        sortOrder: idx,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Partial<OrderProductionItem>;
    });

    const extraRows = sourceItems.slice(activeTargets.length).map((row, extraIdx) => ({
      ...row,
      isTransport: true,
      sortOrder: activeTargets.length + extraIdx,
      updatedAt: new Date().toISOString(),
    }));

    return [...baseRows, ...extraRows];
  };

  useEffect(() => {
    if (distanceKm == null) {
      setQuote(null);
      return;
    }
    setLoadingQuote(true);
    financeApi
      .getTransportQuote({ distanceKm, trips: Math.max(1, targets.length) })
      .then((data) => {
        setQuote(data);
        setSettings({
          ranges: data.settings.ranges,
          longDistancePerKm: data.settings.longDistancePerKm,
          updatedAt: data.settings.updatedAt,
        });
      })
      .catch(() => setError('Nie udało się pobrać breakdownu transportu.'))
      .finally(() => setLoadingQuote(false));
  }, [distanceKm, targets.length]);

  // Build/sync transport rows from targets (schedule or order dates). Pierwsze wejście: szanuj zapisane wiersze; drugi wiersz tylko gdy liczba celów transportu rośnie (np. z 1 do 2 po zmianie harmonogramu).
  useEffect(() => {
    if (targets.length === 0) return;
    if (!settings) return;

    if (!transportSyncInitializedRef.current) {
      transportSyncInitializedRef.current = true;
      lastTargetsLengthRef.current = targets.length;
      lastDistanceRef.current = distanceKm;
      lastQuoteBaseRef.current = quote?.baseNetPerTrip ?? null;
      if (items.length === 0) {
        onChange(buildAutoRows([], targets));
      }
      return;
    }

    const prevTargetsLen = lastTargetsLengthRef.current;
    const targetsLengthChanged = prevTargetsLen !== targets.length;
    lastTargetsLengthRef.current = targets.length;

    const distanceChanged = lastDistanceRef.current != null && lastDistanceRef.current !== distanceKm;
    if (distanceKm != null) lastDistanceRef.current = distanceKm;
    const currentQuoteBase = quote?.baseNetPerTrip ?? 0;
    const quoteBaseChanged =
      quote != null &&
      (lastQuoteBaseRef.current == null || Math.abs(lastQuoteBaseRef.current - currentQuoteBase) > 0.0001);
    if (quote != null) lastQuoteBaseRef.current = currentQuoteBase;

    if (items.length === 0) {
      onChange(buildAutoRows([], targets));
      return;
    }

    if (targetsLengthChanged && targets.length > prevTargetsLen && items.length < targets.length) {
      onChange(buildAutoRows(items, targets));
      return;
    }

    if (quoteBaseChanged && !hasManualOverride) {
      onChange(buildAutoRows(items, targets.slice(0, Math.max(1, items.length))));
      return;
    }

    if (distanceKm == null || !quote) return;
    if (!distanceChanged) return;

    if (!hasManualOverride) {
      onChange(buildAutoRows(items, targets.slice(0, Math.max(1, items.length))));
      return;
    }

    const shouldRecalculate = shouldAskForTransportRecalculation({
      distanceChanged,
      hasManualOverride,
    })
      ? window.confirm(
          'Zmieniono lokalizację/odległość. Pozycje transportu zostały wcześniej edytowane ręcznie. Przeliczyć transport ponownie i nadpisać ręczne kwoty?'
        )
      : false;
    if (shouldRecalculate) {
      onChange(buildAutoRows(items, targets.slice(0, Math.max(1, items.length))));
    }
  }, [distanceKm, settings, quote, targets, hasManualOverride, items.length]);

  const totalNet = items.reduce((sum, row) => sum + (row.rateValue ?? 0) * (row.units ?? 1), 0);

  const updateRow = (index: number, updates: Partial<OrderProductionItem>) => {
    const next = [...items];
    const current = next[index] ?? {};
    next[index] = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      isTransport: true,
    };
    onChange(next);
  };

  const addCustomTransportRow = () => {
    const now = new Date().toISOString();
    const next = [
      ...items,
      {
        id: `temp-transport-custom-${Date.now()}`,
        orderId: '',
        name: 'Transport - własny element',
        description: 'Własny element',
        rateType: 'FLAT',
        rateValue: 0,
        units: 1,
        discount: 0,
        stageIds: undefined,
        isTransport: true,
        isAutoCalculated: false,
        isSubcontractor: false,
        visibleInOffer: true,
        sortOrder: items.length,
        createdAt: now,
        updatedAt: now,
      } as Partial<OrderProductionItem>,
    ];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold">Transport</h3>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="px-2 py-1 text-xs border border-border rounded hover:bg-surface-2 inline-flex items-center gap-1.5"
        >
          <Settings size={14} />
          Ustawienia stawek
        </button>
      </div>

      <div className="text-xs rounded border border-border p-2 bg-surface-2">
        <div className="font-medium mb-1">Legenda wyceny (netto, trasa w dwie strony):</div>
        {settings ? (
          <ul className="space-y-0.5 text-muted-foreground">
            {settings.ranges.map((row, idx) => (
              <li key={`${row.fromKm}-${row.toKm}-${idx}`}>{`${row.fromKm} km - ${row.toKm} km: ${row.flatNet.toFixed(2)} PLN`}</li>
            ))}
            <li>{`>= ${settings.ranges[settings.ranges.length - 1]?.toKm ?? 0} km: kilometrówka ${settings.longDistancePerKm.toFixed(
              2
            )} PLN/km x km x 2`}</li>
          </ul>
        ) : (
          <div className="text-muted-foreground">{loadingSettings ? 'Ładowanie...' : 'Brak danych ustawień'}</div>
        )}
      </div>

      <div className="border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground w-8">#</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground min-w-[220px]">Nazwa</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Przypisanie</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Stawka netto</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Ilość</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Wartość netto</th>
                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground w-[90px]">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const target = targets[idx];
                const stageIds = (() => {
                  if (!item.stageIds) return [];
                  try {
                    return JSON.parse(item.stageIds as string) as string[];
                  } catch {
                    return [];
                  }
                })();
                const stageId = stageIds[0] ?? '';
                const valueNet = (item.rateValue ?? 0) * (item.units ?? 1);
                return (
                  <tr key={item.id || idx} className="border-b border-border/50 hover:bg-surface-2/50">
                    <td className="py-1 px-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-1 px-2">
                      <input
                        type="text"
                        className="w-full px-2 py-1 text-xs bg-background border border-border rounded"
                        value={item.name || ''}
                        onChange={(e) =>
                          updateRow(idx, {
                            name: e.target.value,
                            isAutoCalculated: false,
                          })
                        }
                        placeholder={idx === 0 ? 'Transport' : 'Transport - dodatkowy dzień'}
                      />
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <button
                          type="button"
                          className="p-0.5 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground inline-flex"
                          title="Szczegóły wyceny transportu"
                          onClick={() => setInfoRowIndex(idx)}
                        >
                          <Info size={14} />
                        </button>
                        <span>
                          {item.isAutoCalculated === false ? 'Kwota zmieniona ręcznie.' : 'Kwota wyliczona automatycznie.'}
                        </span>
                      </div>
                    </td>
                    <td className="py-1 px-2 text-xs">
                      <select
                        className="w-full min-w-[170px] px-2 py-1 text-xs bg-background border border-border rounded"
                        value={stageId || '__CUSTOM__'}
                        onChange={(e) => {
                          const selectedStageId = e.target.value;
                          if (selectedStageId === '__CUSTOM__') {
                            updateRow(idx, {
                              stageIds: undefined,
                              description: item.description || target?.assignment || 'Własny element',
                              isAutoCalculated: false,
                            });
                            return;
                          }
                          const selectedStage = stages.find((s) => s.id === selectedStageId);
                          updateRow(idx, {
                            stageIds: selectedStageId ? JSON.stringify([selectedStageId]) : undefined,
                            name: selectedStageId
                              ? transportNameFromStage(selectedStage, item.name || 'Transport')
                              : idx === 0
                                ? 'Transport'
                                : 'Transport - dodatkowy dzień',
                            isAutoCalculated: false,
                          });
                        }}
                      >
                        <option value="__CUSTOM__">Własny element</option>
                        {stageOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {!stageId && (
                        <input
                          type="text"
                          className="w-full mt-1 px-2 py-1 text-[11px] bg-background border border-border rounded text-muted-foreground"
                          value={item.description || target?.assignment || ''}
                          onChange={(e) =>
                            updateRow(idx, {
                              description: e.target.value,
                              isAutoCalculated: false,
                            })
                          }
                          placeholder="Wpisz własne przypisanie"
                        />
                      )}
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-24 px-2 py-1 text-xs bg-background border border-border rounded text-right"
                        value={item.rateValue ?? 0}
                        onChange={(e) =>
                          updateRow(idx, {
                            rateValue: Number(e.target.value) || 0,
                            isAutoCalculated: false,
                          })
                        }
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="number"
                        min={1}
                        className="w-16 px-2 py-1 text-xs bg-background border border-border rounded text-right"
                        value={item.units ?? 1}
                        onChange={(e) =>
                          updateRow(idx, {
                            units: Number(e.target.value) || 1,
                            isAutoCalculated: false,
                          })
                        }
                      />
                    </td>
                    <td className="py-1 px-2 font-medium text-right text-xs">{valueNet.toFixed(2)} PLN</td>
                    <td className="py-1 px-2">
                      {idx > 0 && (
                        <button
                          type="button"
                          className="px-2 py-1 text-[11px] border border-border rounded hover:bg-surface-2"
                          onClick={() => {
                            const next = items.filter((_, i) => i !== idx);
                            onChange(next);
                          }}
                        >
                          Usuń
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 border-t border-border">
                <td colSpan={7} className="py-1.5 px-2">
                  <button
                    type="button"
                    onClick={addCustomTransportRow}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    + Dodaj własny transport
                  </button>
                </td>
              </tr>
              <tr className="bg-surface-2 border-t border-border">
                <td colSpan={6} className="py-1.5 px-2 text-right font-medium text-sm">
                  Suma transport netto:
                </td>
                <td className="py-1.5 px-2 font-bold text-right text-sm min-w-[120px] whitespace-nowrap">
                  {totalNet.toFixed(2)} PLN
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {error && <div className="text-xs text-red-500">{error}</div>}

      {infoRowIndex != null && items[infoRowIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setInfoRowIndex(null)}>
          <div className="bg-surface border border-border rounded-lg shadow-xl max-w-lg w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Szczegóły wyceny transportu</h4>
              <button
                type="button"
                onClick={() => setInfoRowIndex(null)}
                className="px-2 py-1 text-xs border border-border rounded hover:bg-surface-2"
              >
                Zamknij
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Pozycja</div>
                <div className="font-medium">{items[infoRowIndex]?.name || `Transport ${infoRowIndex + 1}`}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Dni zlecenia</div>
                <div>
                  {toDateKey(orderDateFrom as any) || '—'} - {toDateKey(orderDateTo as any) || '—'} ({countOrderDays(orderDateFrom, orderDateTo)})
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Przypisanie</div>
                <div>
                  {(() => {
                    const row = items[infoRowIndex];
                    let rowStageId = '';
                    if (row?.stageIds) {
                      try {
                        rowStageId = (JSON.parse(row.stageIds as string) as string[])[0] || '';
                      } catch {
                        rowStageId = '';
                      }
                    }
                    const rowStage = stages.find((s) => s.id === rowStageId);
                    if (rowStage) {
                      return `${rowStage.type || 'ETAP'}${rowStage.date ? ` (${new Date(rowStage.date as any).toLocaleDateString('pl-PL')})` : ''}`;
                    }
                    return row?.description || targets[infoRowIndex]?.assignment || 'Własny element';
                  })()}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Odległość i stawka</div>
                <div>{distanceKm == null ? 'Brak miejsca wydarzenia -> stawka auto 0.00 PLN (możesz wpisać ręcznie).' : explanation}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Wartość tej pozycji</div>
                <div className="font-medium">
                  {(((items[infoRowIndex]?.rateValue ?? 0) * (items[infoRowIndex]?.units ?? 1)) || 0).toFixed(2)} PLN netto
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && settingsDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border border-border rounded-xl shadow-xl max-w-md w-full">
            <div className="p-3 border-b border-border">
              <h4 className="font-semibold">Ustawienia stawek transportu (globalne)</h4>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[11px] text-muted-foreground">
                  <div>Od km</div>
                  <div>Do km</div>
                  <div>Stawka (PLN)</div>
                  <div />
                </div>
                {settingsDraft.ranges.map((row, idx) => (
                  <div key={`${idx}-${row.fromKm}-${row.toKm}`} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="w-full px-2 py-1 text-sm bg-background border border-border rounded"
                      value={row.fromKm}
                      onChange={(e) =>
                        setSettingsDraft((prev) => {
                          if (!prev) return prev;
                          const ranges = [...prev.ranges];
                          const current = ranges[idx] ?? { fromKm: 0, toKm: 0, flatNet: 0 };
                          ranges[idx] = { ...current, fromKm: Number(e.target.value) || 0 };
                          return { ...prev, ranges };
                        })
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="w-full px-2 py-1 text-sm bg-background border border-border rounded"
                      value={row.toKm}
                      onChange={(e) =>
                        setSettingsDraft((prev) => {
                          if (!prev) return prev;
                          const ranges = [...prev.ranges];
                          const current = ranges[idx] ?? { fromKm: 0, toKm: 0, flatNet: 0 };
                          ranges[idx] = { ...current, toKm: Number(e.target.value) || 0 };
                          return { ...prev, ranges };
                        })
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="w-full px-2 py-1 text-sm bg-background border border-border rounded"
                      value={row.flatNet}
                      onChange={(e) =>
                        setSettingsDraft((prev) => {
                          if (!prev) return prev;
                          const ranges = [...prev.ranges];
                          const current = ranges[idx] ?? { fromKm: 0, toKm: 0, flatNet: 0 };
                          ranges[idx] = { ...current, flatNet: Number(e.target.value) || 0 };
                          return { ...prev, ranges };
                        })
                      }
                    />
                    <button
                      type="button"
                      disabled={settingsDraft.ranges.length <= 1}
                      className="px-2 py-1 text-xs border border-border rounded hover:bg-surface-2 disabled:opacity-50"
                      onClick={() =>
                        setSettingsDraft((prev) => {
                          if (!prev) return prev;
                          const ranges = prev.ranges.filter((_, i) => i !== idx);
                          return { ...prev, ranges };
                        })
                      }
                    >
                      Usuń
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="px-2 py-1 text-xs border border-border rounded hover:bg-surface-2"
                  onClick={() =>
                    setSettingsDraft((prev) => {
                      if (!prev) return prev;
                      const sorted = normalizeRanges(prev.ranges);
                      const lastToKm = sorted[sorted.length - 1]?.toKm ?? 0;
                      return {
                        ...prev,
                        ranges: [...sorted, { fromKm: lastToKm, toKm: lastToKm + 50, flatNet: 0 }],
                      };
                    })
                  }
                >
                  + Dodaj przedział
                </button>
              </div>
              <label className="text-xs block">
                Stawka kilometrówki (PLN/km)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="mt-1 w-full px-2 py-1 text-sm bg-background border border-border rounded"
                  value={settingsDraft.longDistancePerKm}
                  onChange={(e) =>
                    setSettingsDraft((prev) => (prev ? { ...prev, longDistancePerKm: Number(e.target.value) || 0 } : prev))
                  }
                />
              </label>
              <div className="text-[11px] text-muted-foreground">
                Kilometrówka nalicza się od końca najwyższego przedziału i wyżej (km x 2 x stawka).
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-2"
                onClick={() => {
                  setSettingsOpen(false);
                  setSettingsDraft(settings);
                }}
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={savingSettings}
                className="px-3 py-1.5 text-sm border-2 border-primary text-primary rounded font-medium hover:bg-primary/10 disabled:opacity-50"
                onClick={async () => {
                  if (!settingsDraft) return;
                  setSavingSettings(true);
                  setError(null);
                  try {
                    const normalizedRanges = normalizeRanges(settingsDraft.ranges);
                    const rangesError = validateRanges(normalizedRanges);
                    if (rangesError) {
                      setError(rangesError);
                      setSavingSettings(false);
                      return;
                    }
                    const updated = await financeApi.updateTransportPricingSettings({
                      ranges: normalizedRanges,
                      longDistancePerKm: settingsDraft.longDistancePerKm,
                    });
                    setSettings(updated);
                    setSettingsDraft(updated);
                    if (distanceKm != null) {
                      const nextQuote = await financeApi.getTransportQuote({
                        distanceKm,
                        trips: Math.max(1, targets.length),
                      });
                      setQuote(nextQuote);
                    }
                    setSettingsOpen(false);
                    onChange(buildAutoRows(items, targets.slice(0, Math.max(1, items.length))));
                  } catch (e: any) {
                    const raw = e?.response?.data?.error ?? e?.message;
                    setError(typeof raw === 'string' ? raw : 'Nie udało się zapisać ustawień transportu.');
                  } finally {
                    setSavingSettings(false);
                  }
                }}
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

