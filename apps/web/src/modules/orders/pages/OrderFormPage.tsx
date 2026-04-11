import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams, useBlocker } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save, FileText, Calendar, DollarSign, Repeat, X, AlertCircle } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import { useOrder, useCreateOrder, useUpdateOrder } from '../hooks/useOrders';
import { api } from '../../../shared/api/client';
import { useOrderFormDraft, clearOrderDraft } from '../hooks/useOrderFormDraft';
import { useClients } from '../../clients/hooks/useClients';
import { calculateOrderFinancialSummary } from '../utils/orderFinancialSummary';
import { formatOrderNumber } from '../utils/orderNumberFormat';
import { daysBetween, isEndDateBeforeStartDate } from '../../../shared/utils/dateHelpers';
import { Order, OrderStage, OrderEquipmentItem, OrderProductionItem, CreateOrderDto, UpdateOrderDto } from '@lama-stage/shared-types';
import OrderHeaderSection from '../components/OrderHeaderSection';
import OrderScheduleSection from '../components/OrderScheduleSection';
import OrderEquipmentSection from '../components/OrderEquipmentSection';
import OrderProductionSection from '../components/OrderProductionSection';
import OrderTransportSection from '../components/OrderTransportSection';
import OrderFinancialSection from '../components/OrderFinancialSection';
import OrderRecurringSection from '../components/OrderRecurringSection';

const UNSAVED_LEAVE_MSG =
  'Masz niezapisane zmiany w zleceniu. Opuścić stronę bez zapisywania?';

/** Przejście z formularza zlecenia na podstronę dokumentów tego samego zlecenia — bez pytania (zapis jest po stronie przycisku). */
function isOrderEditToSameOrderDocumentRoute(fromPath: string, toPath: string): boolean {
  const m = fromPath.match(/^\/orders\/([^/]+)$/);
  if (!m) return false;
  const orderId = m[1];
  if (orderId === 'new') return false;
  return toPath.startsWith(`/orders/${orderId}/`);
}

function mapApiOrderToFormValues(o: any): Partial<Order> {
  const dateStr = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : '');
  const toNum = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || fallback;
  return {
    name: o.name ?? '',
    description: o.description ?? '',
    notes: o.notes ?? '',
    status: o.status ?? 'DRAFT',
    venue: o.venue ?? '',
    venuePlaceId: o.venuePlaceId ?? undefined,
    dateFrom: dateStr(o.dateFrom) || new Date().toISOString(),
    dateTo: dateStr(o.dateTo) || new Date().toISOString(),
    clientId: o.clientId ?? o.client?.id ?? '',
    discountGlobal: o.discountGlobal ?? 0,
    vatRate: o.vatRate ?? 23,
    offerValidityDays: o.offerValidityDays ?? 14,
    projectContactKey: o.projectContactKey ?? undefined,
    currency: o.currency ?? 'PLN',
    exchangeRateEur: o.exchangeRateEur ?? undefined,
    orderYear: o.orderYear,
    orderNumber: o.orderNumber,
    offerVersion: o.offerVersion ?? 0,
    offerNumber: o.offerNumber,
    isRecurring: o.isRecurring ?? false,
    recurringConfig: o.recurringConfig,
    parentOrderId: o.parentOrderId,
    stages: Array.isArray(o.stages)
      ? o.stages.map((s: any) => ({
          id: s?.id,
          type: s?.type ?? 'CUSTOM',
          label: s?.label,
          date: dateStr(s?.date) || new Date().toISOString(),
          timeStart: s?.timeStart,
          timeEnd: s?.timeEnd,
          notes: s?.notes,
          sortOrder: toNum(s?.sortOrder, 0),
        }))
      : [],
    equipmentItems: Array.isArray(o.equipmentItems) ? o.equipmentItems : [],
    productionItems: Array.isArray(o.productionItems)
      ? o.productionItems.map((p: any) => {
          const rateVal = p?.rateValue ?? p?.rate_value;
          const unitsVal = p?.units;
          const numRate = typeof rateVal === 'number' && Number.isFinite(rateVal) ? rateVal : Number(rateVal) || 0;
          const numUnits = typeof unitsVal === 'number' && Number.isFinite(unitsVal) ? unitsVal : Number(unitsVal) || 1;
          return {
            id: p?.id,
            name: p?.name ?? '',
            description: p?.description,
            rateType: p?.rateType ?? 'FLAT',
            rateValue: numRate,
            units: numUnits,
            discount: toNum(p?.discount, 0),
            stageIds: p?.stageIds != null && p?.stageIds !== '' ? String(p.stageIds) : undefined,
            isTransport: !!p?.isTransport,
            isAutoCalculated: p?.isAutoCalculated !== false,
            isSubcontractor: !!p?.isSubcontractor,
            visibleInOffer: p?.visibleInOffer !== false,
            sortOrder: toNum(p?.sortOrder, 0),
          };
        })
      : [],
  };
}

function validateOrderPayload(
  payload: {
    name?: string;
    clientId?: string;
    startDate?: Date;
    endDate?: Date;
  },
  isEditing: boolean,
  formEquipmentItems?: Partial<OrderEquipmentItem>[]
): string | null {
  if (!payload.name?.trim()) return 'Nazwa zlecenia jest wymagana.';
  if (!payload.clientId) return 'Wybierz klienta.';
  const startDate = payload.startDate ?? new Date();
  const endDate = payload.endDate ?? payload.startDate ?? new Date();
  if (isEndDateBeforeStartDate(startDate, endDate)) {
    return 'Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.';
  }
  if (!isEditing) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const start = new Date(startDate).getTime();
    if (start < todayStart.getTime()) return 'Data rozpoczęcia nie może być w przeszłości.';
  }
  const rawEq = formEquipmentItems ?? [];
  for (const item of rawEq) {
    const n = typeof item?.name === 'string' ? item.name.trim() : '';
    if (n.length > 0) continue;
    const hasEquipment = Boolean(item?.equipmentId);
    const price = typeof item?.unitPrice === 'number' ? item.unitPrice : Number(item?.unitPrice);
    const hasPrice = Number.isFinite(price) && price > 0;
    if (hasEquipment || hasPrice) {
      return 'Każda pozycja sprzętu z uzupełnionymi danymi musi mieć nazwę.';
    }
  }
  return null;
}

export default function OrderFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [query] = useSearchParams();
  const isEditing = !!id;
  const { data: order, isLoading, isError } = useOrder(id || '');
  const { data: paginatedClients } = useClients({ limit: 500 });
  const clients = paginatedClients?.data ?? [];
  const createOrderMutation = useCreateOrder();
  const updateOrderMutation = useUpdateOrder();
  const [activeSection, setActiveSection] = useState('header');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dismissedHints, setDismissedHints] = useState<Set<string>>(new Set());

  const methods = useForm<Partial<Order>>({
    defaultValues: {
      name: '',
      description: '',
      notes: '',
      status: 'DRAFT',
      venue: '',
      venuePlaceId: undefined,
      dateFrom: new Date().toISOString(),
      dateTo: new Date().toISOString(),
      clientId: '',
      discountGlobal: 0,
      vatRate: 23,
      offerValidityDays: 14,
      projectContactKey: undefined,
      currency: 'PLN',
      exchangeRateEur: undefined,
      isRecurring: false,
      recurringConfig: undefined,
      parentOrderId: undefined,
      stages: [],
      equipmentItems: [],
      productionItems: [],
    },
  });

  const { watch, setValue, handleSubmit, formState, getValues, reset } = methods;

  useOrderFormDraft(id, methods, isEditing, { skipDateRestore: !!query.get('date') });

  // Ostrzeżenie przy zamykaniu karty / odświeżeniu z niezapisanymi zmianami
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (formState.isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [formState.isDirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => {
      if (!formState.isDirty) return false;
      if (currentLocation.pathname === nextLocation.pathname) return false;
      if (isOrderEditToSameOrderDocumentRoute(currentLocation.pathname, nextLocation.pathname)) {
        return false;
      }
      return true;
    }
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const ok = window.confirm(UNSAVED_LEAVE_MSG);
    if (ok) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  // Ładowanie zlecenia z API — nie nadpisuj, gdy użytkownik ma niezapisane zmiany
  useEffect(() => {
    if (!isEditing || !order || !id) return;
    const o = order as any;
    if (o.id !== id) return;
    if (formState.isDirty) return;
    reset(mapApiOrderToFormValues(o));
  }, [isEditing, id, order, formState.isDirty, reset]);

  const tryNavigateAway = useCallback(
    (to: string) => {
      if (formState.isDirty && !window.confirm(UNSAVED_LEAVE_MSG)) return;
      navigate(to);
    },
    [formState.isDirty, navigate]
  );

  // Przewijanie dokładnie na samą górę przy wejściu na stronę (po "Nowe zlecenie" z kalendarza itd.).
  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    scrollToTop();
    const t1 = setTimeout(scrollToTop, 0);
    const t2 = setTimeout(scrollToTop, 100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [id]);

  // Obsługa wejścia bezpośrednio do sekcji harmonogramu i prefill daty dla nowego zlecenia.
  useEffect(() => {
    if (!isEditing) {
      const date = query.get('date')
      if (date) {
        const isoStart = new Date(`${date}T00:00:00`).toISOString()
        const isoEnd = new Date(`${date}T23:59:59`).toISOString()
        setValue('dateFrom', isoStart as any)
        setValue('dateTo', isoEnd as any)
      }
    }
    if (location.hash === '#schedule') {
      setTimeout(() => {
        scrollToSection('schedule')
      }, 50)
    }
  }, [isEditing, location.hash, query, setValue]);

  const handleOrderChange = useCallback((updates: Partial<Order>) => {
    Object.keys(updates).forEach((key) => {
      setValue(key as any, (updates as any)[key], { shouldDirty: true, shouldTouch: true });
    });
  }, [setValue]);

  const handleStagesChange = useCallback((stages: OrderStage[]) => {
    setValue('stages', stages, { shouldDirty: true, shouldTouch: true });

    const stageDates = (stages || [])
      .map((stage) => (stage?.date ? new Date(stage.date as any) : null))
      .filter((d): d is Date => Boolean(d && !Number.isNaN(d.getTime())));

    if (stageDates.length === 0) return;

    const minDate = new Date(Math.min(...stageDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...stageDates.map((d) => d.getTime())));

    const startIso = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0, 0).toISOString();
    const endIso = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59, 0).toISOString();

    setValue('dateFrom', startIso, { shouldDirty: true, shouldTouch: true });
    setValue('dateTo', endIso, { shouldDirty: true, shouldTouch: true });
  }, [setValue]);

  const handleEquipmentChange = useCallback((items: Partial<OrderEquipmentItem>[]) => {
    setValue('equipmentItems', items, { shouldDirty: true });
  }, [setValue]);

  const handleProductionChange = useCallback((items: Partial<OrderProductionItem>[]) => {
    const existingTransport = ((watch('productionItems') || []) as Partial<OrderProductionItem>[]).filter((item) => item.isTransport);
    setValue('productionItems', [...items, ...existingTransport], { shouldDirty: true });
  }, [setValue, watch]);

  const handleTransportChange = useCallback((items: Partial<OrderProductionItem>[]) => {
    const existingProduction = ((watch('productionItems') || []) as Partial<OrderProductionItem>[]).filter((item) => !item.isTransport);
    setValue('productionItems', [...existingProduction, ...items], { shouldDirty: true });
  }, [setValue, watch]);

  // Pobierz aktualne dane z formularza
  const formData = watch();
  const stages = watch('stages') || [];
  const equipmentItems = watch('equipmentItems') || [];
  const allProductionItems = watch('productionItems') || [];
  const productionItems = useMemo(
    () => (allProductionItems as Partial<OrderProductionItem>[]).filter((item) => !item.isTransport),
    [allProductionItems]
  );
  const transportItems = useMemo(
    () => (allProductionItems as Partial<OrderProductionItem>[]).filter((item) => item.isTransport),
    [allProductionItems]
  );

  const orderDays = useMemo(() => {
    const from = formData?.dateFrom
    const to = formData?.dateTo
    if (!from || !to) return 1
    return daysBetween(from, to)
  }, [formData?.dateFrom, formData?.dateTo])

  const buildPayload = (data: Partial<Order>): CreateOrderDto | UpdateOrderDto => {
    const toIso = (value: unknown) => {
      if (!value) return undefined
      if (value instanceof Date) return value.toISOString()
      if (typeof value === 'string') {
        const d = new Date(value)
        return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
      }
      return undefined
    }

    const toNumber = (value: unknown, fallback: number) => {
      const n = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(n) ? n : fallback
    }

    const normalizeRecurringConfig = (value: unknown): string | undefined => {
      if (!value) return undefined
      if (typeof value === 'string') return value
      try {
        return JSON.stringify(value)
      } catch {
        return undefined
      }
    }

    const isValidUuid = (s: unknown): s is string =>
      typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

    const normalizeStages = (list: any[] | undefined) =>
      (Array.isArray(list) ? list : []).map((stage, idx) => ({
        ...(stage?.id && isValidUuid(stage.id) ? { id: stage.id } : {}),
        type: stage?.type || 'CUSTOM',
        label: stage?.label || undefined,
        date: toIso(stage?.date) || new Date().toISOString(),
        timeStart: stage?.timeStart || undefined,
        timeEnd: stage?.timeEnd || undefined,
        notes: stage?.notes || undefined,
        sortOrder: toNumber(stage?.sortOrder, idx),
      }))

    const normalizeEquipmentItems = (list: any[] | undefined) =>
      (Array.isArray(list) ? list : [])
        .map((item, idx) => {
          let pricingRule = item?.pricingRule
          if (typeof pricingRule === 'string') {
            try {
              pricingRule = JSON.parse(pricingRule)
            } catch {
              pricingRule = undefined
            }
          }
          const name = typeof item?.name === 'string' ? item.name.trim() : ''
          return {
            equipmentId: item?.equipmentId || undefined,
            name,
            description: item?.description || undefined,
            category: item?.category || 'Inne',
            quantity: Math.max(1, Math.round(toNumber(item?.quantity, 1))),
            unitPrice: Math.max(0, toNumber(item?.unitPrice, 0)),
            days: Math.max(1, Math.round(toNumber(item?.days, 1))),
            discount: Math.min(100, Math.max(0, toNumber(item?.discount, 0))),
            pricingRule: pricingRule || undefined,
            visibleInOffer: item?.visibleInOffer !== false,
            isRental: !!item?.isRental,
            sortOrder: toNumber(item?.sortOrder, idx),
            dateFrom: toIso(item?.dateFrom),
            dateTo: toIso(item?.dateTo),
          }
        })
        .filter((row) => row.name.length > 0)

    const normalizeProductionItems = (list: any[] | undefined) =>
      (Array.isArray(list) ? list : []).map((item, idx) => ({
        ...(item?.id && isValidUuid(item.id) ? { id: item.id } : {}),
        name: item?.name || 'Pozycja produkcji',
        description: item?.description || undefined,
        rateType: item?.rateType || 'FLAT',
        rateValue: Math.max(0, toNumber(item?.rateValue, 0)),
        units: Math.max(0.01, toNumber(item?.units, 1)),
        discount: Math.min(100, Math.max(0, toNumber(item?.discount, 0))),
        stageIds: item?.stageIds != null && item?.stageIds !== '' ? String(item.stageIds) : undefined,
        isTransport: !!item?.isTransport,
        isAutoCalculated: item?.isAutoCalculated !== false,
        isSubcontractor: !!item?.isSubcontractor,
        visibleInOffer: item?.visibleInOffer !== false,
        sortOrder: toNumber(item?.sortOrder, idx),
      }))

    const startDateIso = toIso(data.dateFrom) || new Date().toISOString()
    const endDateIso = toIso(data.dateTo) || startDateIso

    const vat = toNumber(data.vatRate, 23);
    const vatRateOffer = (vat === 0 || vat === 23 ? vat : 23) as 0 | 23;
    return {
      name: data.name || '',
      description: data.description || undefined,
      notes: data.notes || undefined,
      status: data.status || 'DRAFT',
      venue: data.venue || undefined,
      venuePlaceId: data.venuePlaceId || undefined,
      startDate: new Date(startDateIso),
      endDate: new Date(endDateIso),
      clientId: data.clientId || '',
      discountGlobal: Math.min(100, Math.max(0, toNumber(data.discountGlobal, 0))),
      vatRate: vatRateOffer,
      offerValidityDays: Math.min(90, Math.max(1, toNumber(data.offerValidityDays, 14))),
      projectContactKey: data.projectContactKey || undefined,
      currency: (data.currency === 'EUR' ? 'EUR' : 'PLN') as 'PLN' | 'EUR',
      exchangeRateEur: data.currency === 'EUR' && data.exchangeRateEur ? toNumber(data.exchangeRateEur, 0) : undefined,
      isRecurring: !!data.isRecurring,
      recurringConfig: normalizeRecurringConfig(data.recurringConfig),
      parentOrderId: data.parentOrderId || undefined,
      stages: normalizeStages((data?.stages ?? []) as any[]),
      equipmentItems: normalizeEquipmentItems(data.equipmentItems as any[]),
      productionItems: normalizeProductionItems(data.productionItems as any[]),
    } as CreateOrderDto
  };

  const saveAndNavigateToDocument = useCallback(
    async (targetPath: string) => {
      if (!id) return;
      setSubmitError(null);
      if (!formState.isDirty) {
        navigate(targetPath);
        return;
      }
      const payload = buildPayload(getValues() as Partial<Order>);
      const validationError = validateOrderPayload(payload, true, getValues('equipmentItems') as Partial<OrderEquipmentItem>[] | undefined);
      if (validationError) {
        setSubmitError(validationError);
        return;
      }
      try {
        const updated = await updateOrderMutation.mutateAsync({ id, data: payload as UpdateOrderDto });
        reset(mapApiOrderToFormValues(updated));
        navigate(targetPath);
      } catch (err: any) {
        const validationDetails = err?.response?.data?.error?.details;
        if (validationDetails?.fieldErrors) {
          const firstFieldError = Object.values(validationDetails.fieldErrors).flat().find(Boolean);
          if (typeof firstFieldError === 'string') {
            setSubmitError(firstFieldError);
            return;
          }
        }
        const raw =
          err?.response?.data?.message ??
          err?.response?.data?.error?.message ??
          err?.response?.data?.error ??
          err?.message;
        const msg =
          typeof raw === 'string'
            ? raw
            : typeof raw?.message === 'string'
              ? raw.message
              : 'Nie udało się zapisać zlecenia przed otwarciem dokumentu.';
        setSubmitError(msg);
      }
    },
    [id, formState.isDirty, getValues, navigate, reset, updateOrderMutation]
  );

  const onSubmit = async () => {
    setSubmitError(null);
    const data = getValues();
    const payload = buildPayload(data as Partial<Order>);
    const validationError = validateOrderPayload(payload, isEditing, data.equipmentItems as Partial<OrderEquipmentItem>[] | undefined);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    try {
      if (isEditing && id) {
        const updated = await updateOrderMutation.mutateAsync({ id, data: payload as UpdateOrderDto });
        reset(mapApiOrderToFormValues(updated));
      } else {
        const created = await createOrderMutation.mutateAsync(payload as CreateOrderDto);
        clearOrderDraft(undefined);
        if (created?.id) navigate(`/orders/${created.id}`);
        else navigate('/orders');
      }
    } catch (err: any) {
      const validationDetails = err?.response?.data?.error?.details;
      if (validationDetails?.fieldErrors) {
        const firstFieldError = Object.values(validationDetails.fieldErrors).flat().find(Boolean);
        if (typeof firstFieldError === 'string') {
          setSubmitError(firstFieldError);
          return;
        }
      }
      const raw =
        err?.response?.data?.message ??
        err?.response?.data?.error?.message ??
        err?.response?.data?.error ??
        err?.message;

      const msg =
        typeof raw === 'string'
          ? raw
          : typeof raw?.message === 'string'
            ? raw.message
            : 'Nie udało się zapisać zlecenia.';

      setSubmitError(msg);
    }
  };

  const sections = [
    { id: 'header', label: 'Nagłówek', icon: <FileText size={18} /> },
    { id: 'schedule', label: 'Harmonogram', icon: <Calendar size={18} /> },
    { id: 'equipment', label: 'Sprzęt', icon: <FileText size={18} /> },
    { id: 'production', label: 'Produkcja', icon: <FileText size={18} /> },
    { id: 'transport', label: 'Transport', icon: <FileText size={18} /> },
    { id: 'recurring', label: 'Cykliczne', icon: <Repeat size={18} /> },
    { id: 'financial', label: 'Finanse', icon: <DollarSign size={18} /> },
    { id: 'documents', label: 'Dokumenty', icon: <FileText size={18} /> },
  ];

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const financialSummary = useMemo(
    () => calculateOrderFinancialSummary(formData, equipmentItems, allProductionItems),
    [formData.discountGlobal, formData.vatRate, equipmentItems, allProductionItems]
  );
  const venueMapsUrl = formData.venuePlaceId
    ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(formData.venuePlaceId)}`
    : formData.venue
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.venue)}`
      : null

  const venuePlaceId = (formData.venuePlaceId as string) || '';
  const { data: distanceData } = useQuery({
    queryKey: ['places', 'distance', venuePlaceId],
    queryFn: async () => {
      const res = await api.get<{ data: { distanceKm: number | null } }>('/places/distance', { placeId: venuePlaceId });
      return res?.data?.distanceKm ?? null;
    },
    enabled: !!venuePlaceId,
    staleTime: 1000 * 60 * 60,
  });
  const distanceKm = distanceData ?? null;

  // Podpowiedzi (ignorowalne – można zamknąć i pracować dalej)
  const hints = useMemo(() => {
    const list: { id: string; message: string; severity: 'info' | 'warning' }[] = [];
    if (!(formData.name ?? '').trim()) {
      list.push({ id: 'no-name', message: 'Brak nazwy zlecenia.', severity: 'warning' });
    }
    if (!formData.clientId) {
      list.push({ id: 'no-client', message: 'Nie wybrano klienta.', severity: 'warning' });
    }
    if (formData.dateFrom && formData.dateTo && isEndDateBeforeStartDate(formData.dateFrom as string, formData.dateTo as string)) {
      list.push({ id: 'bad-dates', message: 'Data zakończenia jest wcześniejsza niż data rozpoczęcia.', severity: 'warning' });
    }
    if (equipmentItems.length === 0 && productionItems.length === 0) {
      list.push({ id: 'empty-items', message: 'Brak pozycji sprzętu i produkcji – wartość zlecenia będzie 0.', severity: 'info' });
    }
    return list.filter((h) => !dismissedHints.has(h.id));
  }, [formData.name, formData.clientId, formData.dateFrom, formData.dateTo, equipmentItems.length, productionItems.length, dismissedHints]);

  const dismissHint = (hintId: string) => {
    setDismissedHints((prev) => new Set(prev).add(hintId));
  };

  if (isLoading && isEditing) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-muted-foreground">Ładowanie zlecenia...</div>
      </div>
    );
  }

  if (isEditing && !isLoading && (isError || !order)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-muted-foreground">Zlecenie nie zostało znalezione lub wystąpił błąd.</p>
        <button
          type="button"
          onClick={() => tryNavigateAway('/orders')}
          className="px-3 py-1.5 border-2 border-primary text-primary rounded text-sm hover:bg-primary/10"
        >
          Powrót do listy zleceń
        </button>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(() => onSubmit())}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => tryNavigateAway('/orders')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={20} />
              Powrót do listy
            </button>
              <div className="flex gap-2">
              <button
                type="submit"
                className="px-3 py-1.5 text-sm border-2 border-primary text-primary bg-transparent rounded font-medium hover:bg-primary/10 transition-colors flex items-center gap-1.5"
              >
                <Save size={18} />
                {isEditing ? 'Zapisz zlecenie' : 'Utwórz zlecenie'}
              </button>
            </div>
          </div>

          {submitError && (
            <div className="mb-3 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
              {submitError}
            </div>
          )}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="p-3 border-b border-border">
              <h1 className="text-xl font-bold">
                {isEditing ? 'Edytuj zlecenie' : 'Nowe zlecenie'}
                {isEditing && (order as any)?.orderNumber != null && (order as any)?.orderYear != null && (
                  <span className="ml-2 font-mono text-primary">
                    {formatOrderNumber((order as any).orderNumber, (order as any).orderYear)}
                  </span>
                )}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {isEditing
                  ? `Edytujesz zlecenie: ${order?.name || ''}`
                  : 'Wypełnij formularz, aby utworzyć nowe zlecenie'}
              </p>
            </div>

            {/* Sticky: menu sekcji */}
            <div className="sticky top-0 z-10 bg-surface border-b border-border">
              <div className="px-3 py-1.5 flex flex-wrap gap-3">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      activeSection === section.id
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {section.icon}
                    {section.label}
                    {activeSection === section.id && (
                      <div className="w-2 h-2 bg-primary rounded-full ml-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Podpowiedzi (ignorowalne) */}
            {hints.length > 0 && (
              <div className="px-3 py-2 space-y-1.5">
                {hints.map((h) => (
                  <div
                    key={h.id}
                    className={`flex items-center justify-between gap-2 rounded px-3 py-2 text-sm ${
                      h.severity === 'warning'
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200'
                        : 'bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <AlertCircle size={16} />
                      {h.message}
                    </span>
                    <button
                      type="button"
                      onClick={() => dismissHint(h.id)}
                      className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                      title="Ukryj (możesz kontynuować pracę)"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3">
              <div className="max-w-6xl mx-auto">
                {/* Sekcja nagłówka - 2 kolumny */}
                <section id="header" className="scroll-mt-24 mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <FileText size={24} />
                    Nagłówek zlecenia
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="lg:col-span-2" />
                    <div>
                      <OrderHeaderSection
                        isNewOrder={!isEditing}
                        onChange={handleOrderChange}
                      />
                    </div>
                    <div className="bg-surface-2 rounded-xl border border-border p-3">
                      <h3 className="font-semibold mb-4">Podgląd zlecenia</h3>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Nazwa</p>
                          <p className="font-medium">{formData.name || '—'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Klient</p>
                          <p className="font-medium truncate" title={clients.find(c => c.id === formData.clientId)?.companyName ?? ''}>
                            {formData.clientId ? (clients.find(c => c.id === formData.clientId)?.companyName ?? 'Wybrany klient') : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <span className={`px-3 py-1 text-xs rounded-full ${
                            formData.status === 'DRAFT' ? 'bg-gray-500/20 text-gray-500' :
                            formData.status === 'CONFIRMED' ? 'bg-green-500/20 text-green-500' :
                            formData.status === 'OFFER_SENT' ? 'bg-blue-500/20 text-blue-500' :
                            formData.status === 'COMPLETED' ? 'bg-purple-500/20 text-purple-500' :
                            'bg-gray-500/20 text-gray-500'
                          }`}>
                            {formData.status === 'DRAFT' ? 'Szkic' :
                             formData.status === 'CONFIRMED' ? 'Potwierdzone' :
                             formData.status === 'OFFER_SENT' ? 'Oferta wysłana' :
                             formData.status === 'COMPLETED' ? 'Zakończone' : '—'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Miejsce</p>
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate" title={formData.venue || ''}>
                              {formData.venue || '—'}
                            </p>
                            {venueMapsUrl && (
                              <a
                                href={venueMapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary hover:underline shrink-0"
                              >
                                mapa
                              </a>
                            )}
                          </div>
                          {typeof distanceKm === 'number' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Odległość od magazynu: <span className="font-medium text-foreground">{distanceKm} km</span> (w jedną stronę)
                            </p>
                          )}
                        </div>
                        <div className="pt-2 border-t border-border space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Netto</span>
                            <span className="font-medium">{financialSummary.netAfterDiscount.toFixed(2)} PLN</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Brutto</span>
                            <span className="font-medium">{financialSummary.grossTotal.toFixed(2)} PLN</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Rabat</span>
                            <span className="text-red-500 font-medium">-{financialSummary.discountAmount.toFixed(2)} PLN</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Zysk</span>
                            <span className={financialSummary.marginPercent >= 0 ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                              {financialSummary.marginPercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Sekcja harmonogramu */}
                <section id="schedule" className="scroll-mt-24 mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <Calendar size={24} />
                    Harmonogram
                  </h2>
                  <OrderScheduleSection
                    orderDateFrom={typeof formData.dateFrom === 'string' ? formData.dateFrom : undefined}
                    onChange={handleStagesChange}
                  />
                </section>

                {/* Sekcja sprzętu - 2 kolumny */}
                <section id="equipment" className="scroll-mt-24 mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <FileText size={24} />
                    Wykaz sprzętu
                  </h2>
                  <div className="lg:col-span-2">
                    <OrderEquipmentSection
                      items={equipmentItems}
                      onChange={handleEquipmentChange}
                      excludeOrderId={id}
                      orderDateFrom={typeof formData.dateFrom === 'string' ? formData.dateFrom : undefined}
                      orderDateTo={typeof formData.dateTo === 'string' ? formData.dateTo : undefined}
                      orderSpanDays={orderDays}
                    />
                  </div>
                </section>

                {/* Sekcja produkcji i logistyki */}
                <section id="production" className="scroll-mt-24 mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <FileText size={24} />
                    Produkcja i logistyka
                  </h2>
                  <OrderProductionSection
                    items={productionItems}
                    stages={stages}
                    onChange={handleProductionChange}
                  />
                </section>

                {/* Sekcja transportu */}
                <section id="transport" className="scroll-mt-24 mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <FileText size={24} />
                    Transport
                  </h2>
                  <OrderTransportSection
                    key={id || 'new'}
                    items={transportItems}
                    stages={stages}
                    orderDateFrom={typeof formData.dateFrom === 'string' ? formData.dateFrom : undefined}
                    orderDateTo={typeof formData.dateTo === 'string' ? formData.dateTo : undefined}
                    distanceKm={distanceKm}
                    onChange={handleTransportChange}
                  />
                </section>

                {/* Sekcja zleceń cyklicznych */}
                <section id="recurring" className="scroll-mt-24 mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <Repeat size={24} />
                    Zlecenia cykliczne
                  </h2>
                  <OrderRecurringSection
                    valueForOneEvent={financialSummary.grossTotal}
                    marginForOneEvent={financialSummary.ownMarginNet}
                  />
                </section>

                {/* Sekcja finansowa */}
                <section id="financial" className="scroll-mt-24 mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <DollarSign size={24} />
                    Podsumowanie finansowe
                  </h2>
                  <OrderFinancialSection
                    order={formData}
                    equipmentItems={equipmentItems}
                    productionItems={allProductionItems}
                    onChange={handleOrderChange}
                  />
                </section>

                {/* Sekcja Dokumenty */}
                <section id="documents" className="scroll-mt-24 mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <FileText size={24} />
                    Dokumenty
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!isEditing || !id || updateOrderMutation.isPending}
                      onClick={() => id && void saveAndNavigateToDocument(`/orders/${id}/offer`)}
                      className="px-3 py-2 text-sm border-2 border-primary text-primary rounded font-medium hover:bg-primary/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileText size={18} />
                      Oferta
                    </button>
                    <button type="button" disabled className="px-3 py-2 text-sm border border-border rounded opacity-60 cursor-not-allowed flex items-center gap-2" title="W przygotowaniu">
                      <FileText size={18} />
                      Proposal
                      <span className="text-xs text-muted-foreground">(w przygotowaniu)</span>
                    </button>
                    <button
                      type="button"
                      disabled={!isEditing || !id || updateOrderMutation.isPending}
                      onClick={() => id && void saveAndNavigateToDocument(`/orders/${id}/warehouse`)}
                      className="px-3 py-2 text-sm border-2 border-primary text-primary rounded font-medium hover:bg-primary/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileText size={18} />
                      Magazyn załadunek
                    </button>
                    <button type="button" disabled className="px-3 py-2 text-sm border border-border rounded opacity-60 cursor-not-allowed flex items-center gap-2" title="W przygotowaniu">
                      <FileText size={18} />
                      Brief techniczny
                      <span className="text-xs text-muted-foreground">(w przygotowaniu)</span>
                    </button>
                  </div>
                </section>

                {/* Przyciski akcji */}
                <div className="pt-4 border-t border-border flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => tryNavigateAway('/orders')}
                    className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-2 transition-colors"
                  >
                    Anuluj
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-sm border-2 border-primary text-primary bg-transparent rounded font-medium hover:bg-primary/10 transition-colors flex items-center gap-1.5"
                    >
                      <Save size={18} />
                      {isEditing ? 'Zapisz zlecenie' : 'Utwórz zlecenie'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}