import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { pdfApi, financeApi } from '../api/pdf.api';
import type { ProjectContactKey, Currency } from '@lama-stage/shared-types';

interface OfferPdfModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  offerValidityDays: number;
  projectContactKey: ProjectContactKey | null | undefined;
  currency: Currency;
  exchangeRateEur: number | null | undefined;
  vatRate: 0 | 23;
  onSave: (payload: {
    offerValidityDays: number;
    projectContactKey: ProjectContactKey | null;
    currency: Currency;
    exchangeRateEur: number | null;
    vatRate: 0 | 23;
  }) => Promise<void>;
  lastOfferNumber: string | null | undefined;
  nextOfferNumber: string;
  /** Numer zlecenia w formacie ZL-1/26 (powiązany z numerem oferty) */
  orderNumberDisplay?: string;
}

export default function OfferPdfModal({
  open,
  onClose,
  orderId,
  offerValidityDays,
  projectContactKey,
  currency,
  exchangeRateEur,
  vatRate,
  onSave,
  lastOfferNumber,
  nextOfferNumber,
  orderNumberDisplay,
}: OfferPdfModalProps) {
  const [validityDays, setValidityDays] = useState(offerValidityDays);
  const [contactKey, setContactKey] = useState<ProjectContactKey | ''>(projectContactKey ?? '');
  const [curr, setCurr] = useState<Currency>(currency);
  const [eurRate, setEurRate] = useState<number>(exchangeRateEur ?? 0);
  const [vat, setVat] = useState<0 | 23>(vatRate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValidityDays(offerValidityDays);
    setContactKey(projectContactKey ?? '');
    setCurr(currency);
    setEurRate(exchangeRateEur ?? 0);
    setVat(vatRate);
  }, [open, offerValidityDays, projectContactKey, currency, exchangeRateEur, vatRate]);

  useEffect(() => {
    if (open && curr === 'EUR' && eurRate === 0) {
      financeApi
        .getEurExchangeRate()
        .then((data) => data && setEurRate(data.rate))
        .catch(() => setError('Nie udało się pobrać kursu EUR. Wpisz ręcznie.'));
    }
  }, [open, curr, eurRate]);

  const handlePreview = async () => {
    setError(null);
    setLoading(true);
    try {
      await onSave({
        offerValidityDays: validityDays,
        projectContactKey: contactKey || null,
        currency: curr,
        exchangeRateEur: curr === 'EUR' ? eurRate || null : null,
        vatRate: vat,
      });
      const res = await pdfApi.previewOffer(orderId);
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Błąd podglądu PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    // Ta wersja komponentu nie tworzy już eksportu ani nie pobiera PDF –
    // logika eksportu będzie obsłużona w dedykowanej podstronie dokumentu.
    setError('Generowanie PDF jest dostępne z poziomu podstrony dokumentu.');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h2 className="text-lg font-bold">Generuj ofertę PDF</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-surface-2">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Oferta ważna (dni)</label>
            <input
              type="number"
              min={1}
              max={90}
              value={validityDays}
              onChange={(e) => setValidityDays(Number(e.target.value) || 14)}
              className="w-full px-3 py-2 border border-border rounded bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Opiekun projektu</label>
            <select
              value={contactKey}
              onChange={(e) => setContactKey(e.target.value as ProjectContactKey | '')}
              className="w-full px-3 py-2 border border-border rounded bg-background"
            >
              <option value="">— wybierz —</option>
              <option value="RAFAL">Rafał Szydłowski (504 361 781)</option>
              <option value="MICHAL">Michał Rokicki (793 435 302)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Waluta</label>
            <select value={curr} onChange={(e) => setCurr(e.target.value as Currency)} className="w-full px-3 py-2 border border-border rounded bg-background">
              <option value="PLN">PLN</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          {curr === 'EUR' && (
            <div>
              <label className="block text-sm font-medium mb-1">Kurs EUR</label>
              <input
                type="number"
                step="0.0001"
                min={0}
                value={eurRate || ''}
                onChange={(e) => setEurRate(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-border rounded bg-background"
                placeholder="Pobierz z NBP lub wpisz"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">VAT</label>
            <select value={vat} onChange={(e) => setVat(Number(e.target.value) as 0 | 23)} className="w-full px-3 py-2 border border-border rounded bg-background">
              <option value={23}>23%</option>
              <option value={0}>0%</option>
            </select>
          </div>
          <div className="pt-2 border-t border-border text-sm text-muted-foreground">
            {orderNumberDisplay && (
              <p>Numer zlecenia: <strong className="text-foreground font-mono">{orderNumberDisplay}</strong></p>
            )}
            <p>Ostatni numer oferty: <strong className="text-foreground">{lastOfferNumber ?? '—'}</strong></p>
            <p>Następny numer oferty: <strong className="text-foreground">{nextOfferNumber}</strong> (numer.wersja.rok)</p>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-border">
          <button
            type="button"
            onClick={handlePreview}
            disabled={loading}
            className="flex-1 px-3 py-2 text-sm border border-border rounded hover:bg-surface-2 disabled:opacity-50"
          >
            {loading ? '…' : 'Podgląd PDF'}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="flex-1 px-3 py-2 text-sm border-2 border-primary text-primary rounded font-medium hover:bg-primary/10 disabled:opacity-50"
          >
            {loading ? '…' : 'Generuj PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
