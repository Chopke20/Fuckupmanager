import type { ProposalPublicSnapshot } from '../utils/proposalPublic'
import { formatProposalDateRange, formatProposalMoney } from '../utils/proposalPublic'

type Props = {
  snapshot: ProposalPublicSnapshot
  expired?: boolean
  interestedOptionIds?: string[]
  discussRequested?: boolean
  onToggleOption?: (optionId: string) => void
  onDiscuss?: () => void
  onDownloadPdf?: () => void
  pdfBusy?: boolean
}

export default function ProposalClientView({
  snapshot,
  expired = false,
  interestedOptionIds = [],
  discussRequested = false,
  onToggleOption,
  onDiscuss,
  onDownloadPdf,
  pdfBusy = false,
}: Props) {
  const money = (n: number) => formatProposalMoney(n, snapshot.finance.currency)
  const interactive = !expired && Boolean(onToggleOption || onDiscuss || onDownloadPdf)

  return (
    <div className={`proposal-sheet proposal-skin-${snapshot.skin.toLowerCase()}`}>
      <header className="proposal-hero">
        {snapshot.branding.logoUrl ? (
          <img src={snapshot.branding.logoUrl} alt={snapshot.branding.brandName} className="proposal-logo" />
        ) : (
          <p className="proposal-brand">{snapshot.branding.brandName}</p>
        )}
        <p className="proposal-kicker">{snapshot.event.clientCompanyName}</p>
        <h1>{snapshot.event.name}</h1>
        <p className="proposal-meta">
          {formatProposalDateRange(snapshot.event.dateFrom, snapshot.event.dateTo)}
          {snapshot.event.venue ? ` · ${snapshot.event.venue}` : ''}
        </p>
        <p className="proposal-lead">{snapshot.lead}</p>
        <p className="proposal-validity">
          {expired
            ? 'Ta wersja oferty wygasła. Kwoty nie obowiązują — skontaktuj się, aby dostać aktualizację.'
            : `Ważne do ${new Date(snapshot.expiresAt).toLocaleDateString('pl-PL')} · ${snapshot.documentNumber}`}
        </p>
      </header>

      {!expired && snapshot.whyThisSet ? (
        <section className="proposal-section">
          <h2>Dlaczego taki zestaw</h2>
          <p>{snapshot.whyThisSet}</p>
        </section>
      ) : null}

      {!expired ? (
        <section className="proposal-section">
          <h2>Zakres bazowy</h2>
          <div className="proposal-scope-grid">
            {snapshot.scope.map((group) => (
              <article key={group.id} className="proposal-scope-card">
                <h3>{group.title}</h3>
                <ul>
                  {group.itemNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!expired && snapshot.options.length > 0 ? (
        <section className="proposal-section">
          <h2>Opcje rozbudowy</h2>
          <p className="proposal-hint">To dodatki, nie braki w zakresie bazowym. Możesz zaznaczyć, co Cię interesuje.</p>
          <div className="proposal-option-grid">
            {snapshot.options.map((opt) => {
              const on = interestedOptionIds.includes(opt.id)
              return (
                <article key={opt.id} className={`proposal-option-card${on ? ' is-selected' : ''}`}>
                  <h3>{opt.title}</h3>
                  {opt.rationale ? <p>{opt.rationale}</p> : null}
                  <p className="proposal-option-price">+ {money(opt.netAfterDiscount)} netto</p>
                  {interactive && onToggleOption ? (
                    <button type="button" className="proposal-option-toggle" onClick={() => onToggleOption(opt.id)}>
                      {on ? 'Zaznaczone — zainteresowanie' : 'Zaznacz zainteresowanie'}
                    </button>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {!expired ? (
        <section className="proposal-section proposal-finance">
          <h2>Podsumowanie</h2>
          <dl>
            <div>
              <dt>Sprzęt netto</dt>
              <dd>{money(snapshot.finance.equipmentNet)}</dd>
            </div>
            <div>
              <dt>Obsługa netto</dt>
              <dd>{money(snapshot.finance.productionNet)}</dd>
            </div>
            {snapshot.finance.transportNet > 0 ? (
              <div>
                <dt>Transport netto</dt>
                <dd>{money(snapshot.finance.transportNet)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Netto po rabacie</dt>
              <dd>{money(snapshot.finance.netAfterDiscount)}</dd>
            </div>
            <div>
              <dt>VAT {snapshot.finance.vatRate}%</dt>
              <dd>{money(snapshot.finance.vatAmount)}</dd>
            </div>
            <div className="proposal-finance-total">
              <dt>Brutto zakres bazowy</dt>
              <dd>{money(snapshot.finance.grossTotal)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="proposal-section proposal-cta">
        {!expired && onDownloadPdf ? (
          <button type="button" className="proposal-btn-primary" onClick={onDownloadPdf} disabled={pdfBusy}>
            {pdfBusy ? 'Pobieranie PDF…' : `Pobierz ofertę PDF (${snapshot.offer.documentNumber})`}
          </button>
        ) : null}
        {interactive && onDiscuss ? (
          <button type="button" className="proposal-btn-secondary" onClick={onDiscuss} disabled={discussRequested}>
            {discussRequested ? 'Sygnał zapisany — odezwiemy się' : 'Chcę omówić tę ofertę'}
          </button>
        ) : null}
        <p className="proposal-contact">
          {snapshot.contact.name ? `${snapshot.contact.name} · ` : ''}
          {snapshot.contact.phone || snapshot.issuer.phone || '—'}
          {snapshot.contact.email || snapshot.issuer.email
            ? ` · ${snapshot.contact.email || snapshot.issuer.email}`
            : ''}
        </p>
      </section>
    </div>
  )
}
