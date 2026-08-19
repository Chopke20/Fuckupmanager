import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  calculateTechnicianCashQuote,
  formatPln,
  type TechnicianPayoutKind,
} from '../calculators/technicianCash'

const VAT_PRESETS = [23, 8, 0] as const
const TAX_PRESETS = [
  { value: 9, label: 'CIT 9%' },
  { value: 19, label: 'CIT 19%' },
  { value: 12, label: 'PIT 12%' },
  { value: 0, label: '0%' },
] as const

function parseAmount(raw: string): number {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return 0
  const value = Number(normalized)
  return Number.isFinite(value) ? value : NaN
}

function Row({
  label,
  value,
  emphasize,
  muted,
}: {
  label: string
  value: string
  emphasize?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={muted ? 'text-muted-foreground' : 'text-foreground'}>{label}</span>
      <span className={`tabular-nums ${emphasize ? 'font-semibold text-primary' : 'font-medium'}`}>{value}</span>
    </div>
  )
}

export default function TechnicianCashCalculatorPage() {
  const [cashRaw, setCashRaw] = useState('500')
  const [peopleRaw, setPeopleRaw] = useState('1')
  const [keepRaw, setKeepRaw] = useState('0')
  const [vatPercent, setVatPercent] = useState(23)
  const [incomeTaxPercent, setIncomeTaxPercent] = useState(9)
  const [payoutKind, setPayoutKind] = useState<TechnicianPayoutKind>('cash_not_deductible')
  const [roundClientGrossUp, setRoundClientGrossUp] = useState(true)
  const [copied, setCopied] = useState(false)

  const quote = useMemo(() => {
    const people = Math.max(1, Math.floor(parseAmount(peopleRaw) || 1))
    return calculateTechnicianCashQuote({
      cashToTechnician: parseAmount(cashRaw),
      peopleCount: people,
      keepAfterTax: parseAmount(keepRaw) || 0,
      vatPercent,
      incomeTaxPercent,
      payoutKind,
      roundClientGrossUp,
    })
  }, [cashRaw, peopleRaw, keepRaw, vatPercent, incomeTaxPercent, payoutKind, roundClientGrossUp])

  const onCopyGross = async () => {
    if (!quote.ok) return
    const text = quote.invoiceGross.toFixed(2).replace('.', ',')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const preventSubmit = (e: FormEvent) => {
    e.preventDefault()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            to="/toolbox"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Toolbox
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Technik — gotówka po podatkach</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Podajesz, ile technik ma dostać gotówką. Kalkulator liczy, ile wystawić klientowi, żeby po VAT i
            podatku dochodowym ta kwota została.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <form onSubmit={preventSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-4 xl:col-span-2">
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="cash-to-tech">
              Technik ma dostać gotówką
            </label>
            <div className="flex items-center gap-2">
              <input
                id="cash-to-tech"
                type="text"
                inputMode="decimal"
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={cashRaw}
                onChange={(e) => setCashRaw(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">PLN</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="people-count">
                Liczba techników
              </label>
              <input
                id="people-count"
                type="number"
                min={1}
                step={1}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={peopleRaw}
                onChange={(e) => setPeopleRaw(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="keep-after-tax">
                Zostawić w firmie
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="keep-after-tax"
                  type="text"
                  inputMode="decimal"
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={keepRaw}
                  onChange={(e) => setKeepRaw(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">PLN</span>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium">VAT</div>
            <div className="flex flex-wrap gap-1.5">
              {VAT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setVatPercent(preset)}
                  className={`rounded border px-2 py-1 text-xs ${
                    vatPercent === preset
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {preset}%
                </button>
              ))}
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                aria-label="VAT niestandardowy"
                className="w-20 rounded border border-border bg-background px-2 py-1 text-xs tabular-nums"
                value={vatPercent}
                onChange={(e) => setVatPercent(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium">Podatek dochodowy</div>
            <div className="flex flex-wrap gap-1.5">
              {TAX_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setIncomeTaxPercent(preset.value)}
                  className={`rounded border px-2 py-1 text-xs ${
                    incomeTaxPercent === preset.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <input
                type="number"
                min={0}
                max={99.99}
                step={0.01}
                aria-label="Podatek dochodowy niestandardowy"
                className="w-20 rounded border border-border bg-background px-2 py-1 text-xs tabular-nums"
                value={incomeTaxPercent}
                onChange={(e) => setIncomeTaxPercent(Number(e.target.value))}
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium">Jak traktować wypłatę</legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="payout-kind"
                className="mt-1"
                checked={payoutKind === 'cash_not_deductible'}
                onChange={() => setPayoutKind('cash_not_deductible')}
              />
              <span>
                Gotówka nie jest kosztem
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  VAT + podatek od całego netto. Typowa wycena „na rękę z faktury klienta”.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="payout-kind"
                className="mt-1"
                checked={payoutKind === 'deductible_cost'}
                onChange={() => setPayoutKind('deductible_cost')}
              />
              <span>
                Wypłata jest kosztem firmy
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Faktura / umowa. Podatek dochodowy tylko od kwoty zostawionej w firmie.
                </span>
              </span>
            </label>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={roundClientGrossUp}
              onChange={(e) => setRoundClientGrossUp(e.target.checked)}
            />
            Zaokrąglij brutto w górę do pełnych złotych
          </label>
        </form>

        <div className="space-y-3 rounded-lg border border-border bg-surface p-4 xl:col-span-3">
          {!quote.ok ? (
            <p className="text-sm text-red-400">{quote.error}</p>
          ) : (
            <>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Policz klientowi</div>
                <div className="mt-1 text-3xl font-bold tabular-nums text-primary">
                  {formatPln(quote.invoiceGross)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  brutto · mnożnik {quote.multiplierGrossPerCash.toLocaleString('pl-PL')} × gotówka
                </div>
                <button
                  type="button"
                  onClick={onCopyGross}
                  className="mt-3 rounded border border-border px-2.5 py-1 text-xs hover:bg-surface-2"
                >
                  {copied ? 'Skopiowano brutto' : 'Kopiuj brutto'}
                </button>
              </div>

              <div className="space-y-1.5 border-t border-border pt-3">
                <Row label="Netto na fakturze" value={formatPln(quote.invoiceNet)} />
                <Row label={`VAT (${vatPercent}%)`} value={formatPln(quote.vatAmount)} muted />
                <Row label={`Podatek dochodowy (${incomeTaxPercent}%)`} value={formatPln(quote.incomeTaxAmount)} muted />
                <Row label="Razem do urzędu" value={formatPln(quote.totalToTaxOffice)} />
                <Row
                  label={
                    quote.peopleCount > 1
                      ? `Gotówka dla techników (${quote.peopleCount} × ${formatPln(quote.cashPerPerson)})`
                      : 'Gotówka dla technika'
                  }
                  value={formatPln(quote.cashToTechnician)}
                  emphasize
                />
                <Row label="Zostaje w firmie" value={formatPln(quote.companyKeep)} />
              </div>

              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                Uproszczenie do wyceny, nie porada podatkowa. Nie obejmuje ZUS, składki zdrowotnej ani estońskiego
                CIT. Kwoty na fakturze zaokrąglane są do grosza (VAT od brutto).
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
