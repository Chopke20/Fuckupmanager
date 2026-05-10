import { useCallback, useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'lama-stage-overview-acknowledgements-v1';

export type OverviewAcknowledgementState = {
  conflictIds: string[];
  subcontractorRentalIds: string[];
};

const empty: OverviewAcknowledgementState = {
  conflictIds: [],
  subcontractorRentalIds: [],
};

function parse(raw: string | null): OverviewAcknowledgementState {
  if (!raw) return empty;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== 'object') return empty;
    const c = (j as { conflictIds?: unknown }).conflictIds;
    const s = (j as { subcontractorRentalIds?: unknown }).subcontractorRentalIds;
    return {
      conflictIds: Array.isArray(c) ? c.filter((x): x is string => typeof x === 'string') : [],
      subcontractorRentalIds: Array.isArray(s) ? s.filter((x): x is string => typeof x === 'string') : [],
    };
  } catch {
    return empty;
  }
}

function read(): OverviewAcknowledgementState {
  if (typeof window === 'undefined') return empty;
  return parse(localStorage.getItem(STORAGE_KEY));
}

function write(state: OverviewAcknowledgementState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let store = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setStore(next: OverviewAcknowledgementState) {
  store = next;
  write(next);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return store;
}

function getServerSnapshot() {
  return empty;
}

export function acknowledgeOverviewConflict(id: string) {
  if (store.conflictIds.includes(id)) return;
  setStore({ ...store, conflictIds: [...store.conflictIds, id] });
}

export function acknowledgeOverviewSubcontractorRental(id: string) {
  if (store.subcontractorRentalIds.includes(id)) return;
  setStore({ ...store, subcontractorRentalIds: [...store.subcontractorRentalIds, id] });
}

/** Akceptacje na overview (świadomość konfliktu / pozycji) — później można podmienić na API. */
export function useOverviewAcknowledgements() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const acknowledgeConflict = useCallback((id: string) => {
    acknowledgeOverviewConflict(id);
  }, []);

  const acknowledgeSubcontractorRental = useCallback((id: string) => {
    acknowledgeOverviewSubcontractorRental(id);
  }, []);

  const isConflictAcknowledged = useCallback((id: string) => state.conflictIds.includes(id), [state.conflictIds]);

  const isSubcontractorRentalAcknowledged = useCallback(
    (id: string) => state.subcontractorRentalIds.includes(id),
    [state.subcontractorRentalIds]
  );

  return useMemo(
    () => ({
      state,
      acknowledgeConflict,
      acknowledgeSubcontractorRental,
      isConflictAcknowledged,
      isSubcontractorRentalAcknowledged,
    }),
    [state, acknowledgeConflict, acknowledgeSubcontractorRental, isConflictAcknowledged, isSubcontractorRentalAcknowledged]
  );
}
