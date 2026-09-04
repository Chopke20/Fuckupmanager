import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { SharedOfferPartnerLine, SharedOfferPublicView } from '@lama-stage/shared-types'
import {
  SharedOfferLockedChangedError,
  sharedOfferPublicApi,
} from '../api/sharedOffer.api'
import '../components/proposalPublic.css'

function money(n: number, currency: string) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: currency || 'PLN',
    maximumFractionDigits: 2,
  }).format(n)
}

function lineNet(line: { kind: string; quantity: number; unitPrice: number; days: number; discount: number }) {
  const base =
    line.kind === 'EQUIPMENT'
      ? line.quantity * line.unitPrice * (line.days || 1)
      : line.quantity * line.unitPrice
  return Math.round(base * (1 - (line.discount || 0) / 100) * 100) / 100
}

function newPartnerLine(sortOrder: number): SharedOfferPartnerLine {
  return {
    id: crypto.randomUUID(),
    kind: 'PRODUCTION',
    name: '',
    description: '',
    category: 'Inne',
    quantity: 1,
    unitPrice: 0,
    days: 1,
    discount: 0,
    offerBlockId: null,
    sortOrder,
  }
}

export default function SharedOfferEditorPage() {
  const { token } = useParams<{ token: string }>()
  const [view, setView] = useState<SharedOfferPublicView | null>(null)
  const [lines, setLines] = useState<SharedOfferPartnerLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inactive, setInactive] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [lockedStale, setLockedStale] = useState(false)
  const [busy, setBusy] = useState<'save' | 'pdf' | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await sharedOfferPublicApi.get(token)
      setView(data)
      setLines(data.partnerLines)
      setDirty(false)
      setLockedStale(false)
      setInactive(false)
    } catch {
      setInactive(true)
      setError('Link nie jest już aktywny albo jest nieprawidłowy.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const applyLockedChanged = (next: SharedOfferPublicView) => {
    setView(next)
    setLines((prev) => prev)
    setLockedStale(true)
    setInfo('Pozycje Lama Stage zmieniły się od otwarcia edytora. Odśwież zablokowaną część przed zapisem lub PDF.')
  }

  const refreshLocked = () => {
    if (!view) return
    setView({ ...view })
    void load()
  }

  const updateLine = (id: string, patch: Partial<SharedOfferPartnerLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    setDirty(true)
  }

  const addLine = () => {
    setLines((prev) => [...prev, newPartnerLine(prev.length)])
    setDirty(true)
  }

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id).map((l, i) => ({ ...l, sortOrder: i })))
    setDirty(true)
  }

  const moveLine = (id: string, dir: -1 | 1) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.id === id)
      if (idx < 0) return prev
      const nextIdx = idx + dir
      if (nextIdx < 0 || nextIdx >= prev.length) return prev
      const copy = [...prev]
      const tmp = copy[idx]!
      copy[idx] = copy[nextIdx]!
      copy[nextIdx] = tmp
      return copy.map((l, i) => ({ ...l, sortOrder: i }))
    })
    setDirty(true)
  }

  const save = async () => {
    if (!token || !view) return
    setBusy('save')
    setError(null)
    setInfo(null)
    try {
      const next = await sharedOfferPublicApi.save(token, lines, view.lockedFingerprint)
      setView(next)
      setLines(next.partnerLines)
      setDirty(false)
      setLockedStale(false)
      setInfo('Zapisano pozycje.')
    } catch (e) {
      if (e instanceof SharedOfferLockedChangedError) {
        applyLockedChanged(e.view)
      } else {
        setError('Nie udało się zapisać pozycji.')
      }
    } finally {
      setBusy(null)
    }
  }

  const generatePdf = async () => {
    if (!token || !view) return
    if (dirty) {
      setError('Najpierw zapisz pozycje, potem wygeneruj PDF.')
      return
    }
    setBusy('pdf')
    setError(null)
    setInfo(null)
    try {
      await sharedOfferPublicApi.generatePdf(token, view.lockedFingerprint)
      setInfo('PDF wygenerowany.')
    } catch (e) {
      if (e instanceof SharedOfferLockedChangedError) {
        applyLockedChanged(e.view)
      } else if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('Nie udało się wygenerować PDF.')
      }
    } finally {
      setBusy(null)
    }
  }

  const liveTotals = useMemo(() => {
    if (!view) return null
    const partnerNet = Math.round(lines.reduce((s, l) => s + lineNet(l), 0) * 100) / 100
    const beforeGlobal = Math.round((view.totals.ownNet + partnerNet) * 100) / 100
    const discountAmount = Math.round(beforeGlobal * (view.totals.discountGlobal / 100) * 100) / 100
    const totalNet = Math.round((beforeGlobal - discountAmount) * 100) / 100
    const vatAmount = Math.round(totalNet * (view.totals.vatRate / 100) * 100) / 100
    return {
      ownNet: view.totals.ownNet,
      partnerNet,
      totalNet,
      vatAmount,
      grossTotal: Math.round((totalNet + vatAmount) * 100) / 100,
      currency: view.totals.currency,
      vatRate: view.totals.vatRate,
    }
  }, [view, lines])

  if (loading) {
    return (
      <div className="proposal-public">
        <div className="proposal-public__shell">
          <p>Ładowanie edytora…</p>
        </div>
      </div>
    )
  }

  if (inactive || !view) {
    return (
      <div className="proposal-public">
        <div className="proposal-public__shell">
          <h1>Link nie jest już aktywny</h1>
          <p>{error ?? 'Oferta współdzielona została unieważniona lub nie istnieje.'}</p>
        </div>
      </div>
    )
  }

  const dateRange = `${new Date(view.startDate).toLocaleDateString('pl-PL')} – ${new Date(view.endDate).toLocaleDateString('pl-PL')}`

  return (
    <div className="proposal-public">
      <div className="proposal-public__shell" style={{ maxWidth: 960 }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
            Oferta współdzielona · Toinen Music
          </div>
          <h1 style={{ margin: '8px 0 4px', fontSize: 28 }}>{view.orderName}</h1>
          <p style={{ margin: 0, opacity: 0.8 }}>
            {[view.clientCompanyName, view.venue, dateRange].filter(Boolean).join(' · ')}
          </p>
        </header>

        {lockedStale ? (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              border: '1px solid #c47b2b',
              borderRadius: 8,
              background: 'rgba(196,123,43,0.08)',
            }}
          >
            <p style={{ margin: '0 0 8px' }}>
              Pozycje Lama Stage zmieniły się od otwarcia edytora. Twoje pozycje zostają — odśwież zablokowaną część.
            </p>
            <button type="button" onClick={refreshLocked}>
              Odśwież pozycje Lama Stage
            </button>
          </div>
        ) : null}

        {error ? <p style={{ color: '#b42318' }}>{error}</p> : null}
        {info ? <p style={{ color: '#027a48' }}>{info}</p> : null}

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18 }}>Pozycje Lama Stage (zablokowane)</h2>
          <p style={{ fontSize: 13, opacity: 0.75, marginTop: 0 }}>Tylko do odczytu — nie możesz ich edytować.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #ddd' }}>Nazwa</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #ddd' }}>Ilość</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #ddd' }}>Cena</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #ddd' }}>Dni</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #ddd' }}>Rabat</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #ddd' }}>Netto</th>
                </tr>
              </thead>
              <tbody>
                {view.lockedLines.map((l, i) => (
                  <tr key={`${l.kind}-${l.name}-${i}`}>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #eee' }}>
                      <div>{l.name}</div>
                      {l.description ? (
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{l.description}</div>
                      ) : null}
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #eee' }}>
                      {l.quantity}
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #eee' }}>
                      {money(l.unitPrice, view.totals.currency)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #eee' }}>
                      {l.days}
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #eee' }}>
                      {l.discount}%
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #eee' }}>
                      {money(lineNet(l), view.totals.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Pozycje Toinen Music</h2>
            <button type="button" onClick={addLine}>
              Dodaj pozycję
            </button>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 6 }}>Typ</th>
                  <th style={{ textAlign: 'left', padding: 6 }}>Nazwa</th>
                  {view.blocks.length > 0 ? (
                    <th style={{ textAlign: 'left', padding: 6 }}>Blok</th>
                  ) : null}
                  <th style={{ textAlign: 'right', padding: 6 }}>Ilość</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>Cena</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>Dni</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>Rabat %</th>
                  <th style={{ textAlign: 'right', padding: 6 }}>Netto</th>
                  <th style={{ padding: 6 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td style={{ padding: 6, verticalAlign: 'top' }}>
                      <select
                        value={l.kind}
                        onChange={(e) =>
                          updateLine(l.id, { kind: e.target.value as 'EQUIPMENT' | 'PRODUCTION' })
                        }
                      >
                        <option value="PRODUCTION">Usługa</option>
                        <option value="EQUIPMENT">Sprzęt</option>
                      </select>
                    </td>
                    <td style={{ padding: 6, verticalAlign: 'top' }}>
                      <input
                        value={l.name}
                        placeholder="Nazwa"
                        onChange={(e) => updateLine(l.id, { name: e.target.value })}
                        style={{ width: '100%', minWidth: 140 }}
                      />
                      <input
                        value={l.description}
                        placeholder="Opis (opcjonalnie)"
                        onChange={(e) => updateLine(l.id, { description: e.target.value })}
                        style={{ width: '100%', marginTop: 4 }}
                      />
                    </td>
                    {view.blocks.length > 0 ? (
                      <td style={{ padding: 6, verticalAlign: 'top' }}>
                        <select
                          value={l.offerBlockId ?? ''}
                          onChange={(e) =>
                            updateLine(l.id, {
                              offerBlockId: e.target.value ? e.target.value : null,
                            })
                          }
                        >
                          <option value="">Bez bloku</option>
                          {view.blocks.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.title}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                    <td style={{ padding: 6, verticalAlign: 'top' }}>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={l.quantity}
                        onChange={(e) => updateLine(l.id, { quantity: Number(e.target.value) || 0 })}
                        style={{ width: 72, textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: 6, verticalAlign: 'top' }}>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={l.unitPrice}
                        onChange={(e) => updateLine(l.id, { unitPrice: Number(e.target.value) || 0 })}
                        style={{ width: 96, textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: 6, verticalAlign: 'top' }}>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={l.days}
                        disabled={l.kind !== 'EQUIPMENT'}
                        onChange={(e) => updateLine(l.id, { days: Math.max(1, Number(e.target.value) || 1) })}
                        style={{ width: 64, textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: 6, verticalAlign: 'top' }}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={l.discount}
                        onChange={(e) => updateLine(l.id, { discount: Number(e.target.value) || 0 })}
                        style={{ width: 64, textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: 6, textAlign: 'right', verticalAlign: 'top' }}>
                      {money(lineNet(l), view.totals.currency)}
                    </td>
                    <td style={{ padding: 6, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      <button type="button" onClick={() => moveLine(l.id, -1)} title="W górę">
                        ↑
                      </button>{' '}
                      <button type="button" onClick={() => moveLine(l.id, 1)} title="W dół">
                        ↓
                      </button>{' '}
                      <button type="button" onClick={() => removeLine(l.id)} title="Usuń">
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lines.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.7 }}>Brak własnych pozycji — dodaj pierwszą.</p>
          ) : null}
        </section>

        {liveTotals ? (
          <section
            style={{
              marginBottom: 24,
              padding: 16,
              borderRadius: 8,
              border: '1px solid #ddd',
              background: 'rgba(129,178,159,0.08)',
            }}
          >
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Podsumowanie</h2>
            <div style={{ display: 'grid', gap: 6, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Lama Stage (netto)</span>
                <strong>{money(liveTotals.ownNet, liveTotals.currency)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Toinen Music (netto)</span>
                <strong>{money(liveTotals.partnerNet, liveTotals.currency)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ccc', paddingTop: 8 }}>
                <span>Razem netto</span>
                <strong>{money(liveTotals.totalNet, liveTotals.currency)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>VAT {liveTotals.vatRate}%</span>
                <span>{money(liveTotals.vatAmount, liveTotals.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Brutto</span>
                <strong>{money(liveTotals.grossTotal, liveTotals.currency)}</strong>
              </div>
            </div>
          </section>
        ) : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void save()} disabled={busy !== null || !dirty}>
            {busy === 'save' ? 'Zapisywanie…' : 'Zapisz'}
          </button>
          <button type="button" onClick={() => void generatePdf()} disabled={busy !== null || lockedStale}>
            {busy === 'pdf' ? 'Generowanie…' : 'Generuj ofertę PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
