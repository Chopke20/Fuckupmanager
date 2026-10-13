import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import PlannerBoardBar from '../components/PlannerBoardBar'
import PlannerWorkspace from '../components/PlannerWorkspace'
import { usePlannerBoardSession } from '../hooks/usePlannerBoardSession'

export default function PlannerPage() {
  const session = usePlannerBoardSession()

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/toolbox"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Toolbox
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Planer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Harmonogram wybranych dni + wolne notatki. Nazwane tablice z autosave.
        </p>
      </div>

      <PlannerBoardBar session={session} />

      {session.loading ? (
        <p className="text-sm text-muted-foreground">Ładowanie tablicy…</p>
      ) : (
        <PlannerWorkspace board={session.payload} onChange={session.setPayload} />
      )}
    </div>
  )
}
