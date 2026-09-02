import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { StagePlan } from '@lama-stage/shared-types'
import StagePlatformVisualizer from '../components/StagePlatformVisualizer'
import StagePlanProjectBar from '../components/StagePlanProjectBar'
import { useStagePlanProjectSession } from '../hooks/useStagePlanProjectSession'

export default function StagePlatformsCalculatorPage() {
  const session = useStagePlanProjectSession()
  const [currentPlan, setCurrentPlan] = useState<StagePlan | null>(null)

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
          Układasz rzut z blatów 2×1 i 1×1 — projekty zapisują się automatycznie. Przy wejściu z
          Toolbox otwiera się ostatni projekt. Ze zlecenia edytujesz plan przypisany do tego
          zlecenia.
        </p>
      </div>

      {session.loading ? (
        <p className="text-sm text-muted-foreground">Wczytywanie projektu…</p>
      ) : (
        <>
          <StagePlanProjectBar session={session} currentPlan={currentPlan} />
          <StagePlatformVisualizer
            key={session.project?.id ?? 'loading'}
            initialPlan={session.initialPlan}
            onPlanChange={(plan) => {
              setCurrentPlan(plan)
              session.handlePlanChange(plan)
            }}
          />
        </>
      )}
    </div>
  )
}
