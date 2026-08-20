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
        <h1 className="mt-2 text-2xl font-bold">Wizualizer podestów</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Standardowe blaty 2×1 m i uzupełnienia 1×1 m. Podajesz front i głębokość — kalkulator układa rzut z góry,
          dobiera nogi, klamry, obicie, schody i barierki. Z zlecenia możesz wstawić te ilości prosto do wykazu sprzętu.
        </p>
      </div>
      <StagePlatformVisualizer />
    </div>
  )
}
