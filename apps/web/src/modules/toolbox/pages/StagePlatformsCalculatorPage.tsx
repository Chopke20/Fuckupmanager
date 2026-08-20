import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import StagePlatformVisualizer from '../components/StagePlatformVisualizer'

export default function StagePlatformsCalculatorPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/toolbox"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Toolbox
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Edytor sceny z podestów</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Układasz rzut z blatów 2×1 i 1×1 — prostokątem na start albo dowolnym kształtem,
          przeciągając blaty po siatce lub swobodnie. Z układu wychodzą nogi (zawsze cztery na
          podest), obicie boków w mb i m², podłoga w m², schody i barierki na wybranych
          krawędziach. Ze zlecenia wstawisz te ilości prosto do wykazu sprzętu.
        </p>
      </div>
      <StagePlatformVisualizer />
    </div>
  )
}
