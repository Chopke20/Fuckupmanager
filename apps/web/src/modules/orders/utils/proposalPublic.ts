export type ProposalSkin = 'MINIMAL' | 'DYNAMIC'

export type ProposalPublicSnapshot = {
  documentType: 'PROPOSAL'
  documentNumber: string
  generatedAt: string
  expiresAt: string
  validityDays: number
  skin: ProposalSkin
  lead: string
  whyThisSet: string
  event: {
    name: string
    venue: string | null
    dateFrom: string
    dateTo: string
    clientCompanyName: string
  }
  branding: {
    brandName: string
    logoUrl: string | null
    primaryColorHex: string | null
  }
  issuer: {
    companyName: string
    email: string
    phone: string
  }
  contact: {
    name: string | null
    phone: string | null
    email: string | null
  }
  scope: Array<{
    id: string
    title: string
    itemNames: string[]
    equipmentNet: number
    productionNet: number
    transportNet: number
  }>
  options: Array<{
    id: string
    title: string
    rationale: string
    kind: 'BLOCK' | 'EQUIPMENT' | 'PRODUCTION'
    netAfterDiscount: number
    vatAmount: number
    grossTotal: number
  }>
  finance: {
    currency: 'PLN' | 'EUR'
    vatRate: number
    discountGlobal: number
    equipmentNet: number
    productionNet: number
    transportNet: number
    netAfterDiscount: number
    vatAmount: number
    grossTotal: number
  }
  offer: {
    exportId: string
    documentNumber: string
  }
}

export function formatProposalMoney(value: number, currency: 'PLN' | 'EUR'): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(value)
}

export function formatProposalDateRange(from: string, to: string): string {
  const a = new Date(from)
  const b = new Date(to)
  const fmt = (d: Date) =>
    Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fa = fmt(a)
  const fb = fmt(b)
  return fa === fb ? fa : `${fa} – ${fb}`
}
