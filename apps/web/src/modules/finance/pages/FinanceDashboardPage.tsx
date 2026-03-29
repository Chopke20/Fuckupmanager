import React from 'react';

export default function FinanceDashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Panel Finansowy</h1>
      <p className="text-muted-foreground mb-6">
        Tutaj znajdą się zaawansowane analizy i wykresy finansowe. Strona w budowie.
      </p>

      <div className="bg-surface rounded-lg border border-border p-6 shadow-sm">
        {/* Placeholder dla wykresu */}
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
          <h2 className="text-xl font-semibold text-muted-foreground">Wykresy Finansowe</h2>
          <p className="text-muted-foreground">Wkrótce dostępne. Dziękujemy za cierpliwość!</p>
        </div>
      </div>
    </div>
  );
}
