import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../shared/api/client';

type TrendPoint = {
  month: string;
  revenueNet: number;
  incomeNet: number;
  ordersCount: number;
};

type TrendResponse = {
  data: {
    from: string;
    to: string;
    includeOfferSent: boolean;
    points: TrendPoint[];
    totals: {
      revenueNet: number;
      incomeNet: number;
      ordersCount: number;
    };
  };
};

function formatPln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} PLN`;
}

function buildPolyline(points: TrendPoint[], width: number, height: number, key: 'revenueNet' | 'incomeNet'): string {
  if (points.length === 0) return '';
  const values = points.map((p) => p[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return points
    .map((p, idx) => {
      const x = (idx / Math.max(1, points.length - 1)) * width;
      const y = height - ((p[key] - min) / span) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export default function FinanceDashboardPage() {
  const [searchParams] = useSearchParams();
  const metric = searchParams.get('metric') === 'income' ? 'income' : 'revenue';

  const trendQuery = useQuery({
    queryKey: ['finance', 'trend', 12],
    queryFn: async () => {
      const body = await api.get<TrendResponse>('/finance/trend', { months: 12 });
      return body.data;
    },
  });

  const chartData = trendQuery.data?.points ?? [];
  const totals = trendQuery.data?.totals;

  const polylines = useMemo(() => {
    const width = 1000;
    const height = 280;
    return {
      width,
      height,
      revenue: buildPolyline(chartData, width, height, 'revenueNet'),
      income: buildPolyline(chartData, width, height, 'incomeNet'),
    };
  }, [chartData]);

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Panel finansowy</h1>
        <p className="text-sm text-muted-foreground">
          Trend miesięczny przychodu i dochodu netto. Kliknięcia z overview ustawiają domyślnie aktywną metrykę.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div
          className={`rounded-lg border p-4 ${metric === 'revenue' ? 'border-primary/50 bg-primary/10' : 'border-border bg-surface'}`}
        >
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Przychód netto (12 mies.)</div>
          <div className="mt-2 text-xl font-semibold">
            {trendQuery.isPending ? 'Ładowanie...' : formatPln(totals?.revenueNet ?? 0)}
          </div>
        </div>
        <div
          className={`rounded-lg border p-4 ${metric === 'income' ? 'border-primary/50 bg-primary/10' : 'border-border bg-surface'}`}
        >
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Dochód netto (12 mies.)</div>
          <div className="mt-2 text-xl font-semibold">
            {trendQuery.isPending ? 'Ładowanie...' : formatPln(totals?.incomeNet ?? 0)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Liczba zleceń</div>
          <div className="mt-2 text-xl font-semibold">{trendQuery.isPending ? 'Ładowanie...' : totals?.ordersCount ?? 0}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Przychód vs Dochód</h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
              Przychód
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Dochód
            </span>
          </div>
        </div>

        {trendQuery.isPending ? (
          <div className="h-[320px] rounded-md border border-border bg-surface-2/40 flex items-center justify-center text-muted-foreground">
            Ładowanie trendu finansowego...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[320px] rounded-md border border-border bg-surface-2/40 flex items-center justify-center text-muted-foreground">
            Brak danych do wykresu.
          </div>
        ) : (
          <div className="space-y-2">
            <svg viewBox={`0 0 ${polylines.width} ${polylines.height}`} className="h-[320px] w-full rounded-md bg-background/60">
              <polyline fill="none" stroke="rgb(34 211 238)" strokeWidth="3" points={polylines.revenue} />
              <polyline fill="none" stroke="rgb(52 211 153)" strokeWidth="3" points={polylines.income} />
            </svg>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground md:grid-cols-6">
              {chartData.map((point) => (
                <div key={point.month} className="rounded border border-border px-2 py-1">
                  <div className="font-medium text-foreground">{point.month}</div>
                  <div>P: {Math.round(point.revenueNet).toLocaleString('pl-PL')}</div>
                  <div>D: {Math.round(point.incomeNet).toLocaleString('pl-PL')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
