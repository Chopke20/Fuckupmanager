export type ToolboxToolStatus = 'ready' | 'soon'

export interface ToolboxTool {
  slug: string
  title: string
  description: string
  status: ToolboxToolStatus
}

export const TOOLBOX_TOOLS: ToolboxTool[] = [
  {
    slug: 'technik-gotowka',
    title: 'Pracownik(złodziej)— gotówka po podatkach',
    description:
      'Ile policzyć klienta, żeby po VAT, podatku (liniowy/skala/CIT/ryczałt) i składce zdrowotnej zostać z gotówką dla technika.',
    status: 'ready',
  },
  {
    slug: 'podesty',
    title: 'Wizualizer podestów',
    description: 'Rzut z góry sceny z podestów 2×1 i 1×1, nogi, klamry i metry obicia.',
    status: 'ready',
  },
  {
    slug: 'transport-km',
    title: 'Transport km',
    description: 'Wycena transportu z przedziałów km i stawki za kilometr.',
    status: 'soon',
  },
  {
    slug: 'rental-dni',
    title: 'Rental wielodniowy',
    description: 'Dzień pierwszy pełna stawka, kolejne dni według reguły cennika.',
    status: 'soon',
  },
  {
    slug: 'moc-prad',
    title: 'Moc / prąd',
    description: 'Suma poboru, zapas i dobór zasilania.',
    status: 'soon',
  },
  {
    slug: 'waga-zaladunek',
    title: 'Waga i załadunek',
    description: 'Suma kilogramów zestawu wobec limitu busy.',
    status: 'soon',
  },
]

export function getToolboxTool(slug: string): ToolboxTool | undefined {
  return TOOLBOX_TOOLS.find((tool) => tool.slug === slug)
}
