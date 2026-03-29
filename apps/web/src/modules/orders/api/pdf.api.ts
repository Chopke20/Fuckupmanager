import axios from 'axios';

const PDF_BASE = '/api/pdf';

export const pdfApi = {
  previewOffer: (orderId: string) =>
    axios.post<Blob>(`${PDF_BASE}/offer/${orderId}/preview`, null, {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
    }),

  /** Zapis snapshotu + nadanie numeru (jeśli treść się zmieniła), pobranie PDF. */
  generateOffer: (orderId: string) =>
    axios.post<Blob>(`${PDF_BASE}/offer/${orderId}/generate`, null, {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
    }),

  /** PDF z zapisanego snapshotu — `inline`: podgląd w przeglądarce zamiast pobrania. */
  offerPdfFromExport: (exportId: string, opts?: { inline?: boolean }) =>
    axios.post<Blob>(`${PDF_BASE}/offer/export/${exportId}`, null, {
      params: opts?.inline ? { inline: '1' } : undefined,
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
    }),
};

export const financeApi = {
  // Shared shape for admin + order transport modal.
  // Each range defines flat price for [fromKm, toKm).
  // Kilometrówka applies from highest toKm and above.
  getEurExchangeRate: () =>
    axios.get<{ data: { rate: number; date: string; source: string } }>('/api/finance/exchange-rate/eur').then((res) => res.data?.data ?? res.data),

  getTransportPricingSettings: () =>
    axios
      .get<{
        data: {
          ranges: Array<{ fromKm: number; toKm: number; flatNet: number }>;
          longDistancePerKm: number;
          updatedAt?: string;
        };
      }>('/api/finance/transport-pricing')
      .then((res) => res.data?.data ?? res.data),

  updateTransportPricingSettings: (payload: {
    ranges: Array<{ fromKm: number; toKm: number; flatNet: number }>;
    longDistancePerKm: number;
  }) =>
    axios
      .put<{
        data: {
          ranges: Array<{ fromKm: number; toKm: number; flatNet: number }>;
          longDistancePerKm: number;
          updatedAt?: string;
        };
      }>('/api/finance/transport-pricing', payload)
      .then((res) => res.data?.data ?? res.data),

  getTransportQuote: (params: { distanceKm: number; trips: number }) =>
    axios
      .get<{
        data: {
          distanceKm: number;
          trips: number;
          mode: 'RANGE_FLAT' | 'LONG_KM';
          baseNetPerTrip: number;
          totalNet: number;
          formula: string;
          longDistanceFromKm: number;
          matchedRange: { fromKm: number; toKm: number; flatNet: number } | null;
          settings: {
            ranges: Array<{ fromKm: number; toKm: number; flatNet: number }>;
            longDistancePerKm: number;
            updatedAt?: string;
          };
        };
      }>('/api/finance/transport-pricing/quote', { params })
      .then((res) => res.data?.data ?? res.data),
};
