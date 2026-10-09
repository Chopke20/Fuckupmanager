import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import LedScreensWorkspace from '../components/LedScreensWorkspace'
import LedScreenProjectBar from '../components/LedScreenProjectBar'
import { useLedScreenProjectSession } from '../hooks/useLedScreenProjectSession'
import { useAuth } from '../../auth/AuthProvider'

export default function LedScreenCalculatorPage({ publicMode = false }: { publicMode?: boolean }) {
  const { user } = useAuth()
  const session = useLedScreenProjectSession({ localOnly: publicMode })

  return (
    <div className="space-y-4">
      <div>
        {publicMode ? (
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Lama Stage · narzędzie</p>
        ) : (
          <Link
            to="/toolbox"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Toolbox
          </Link>
        )}
        <h1 className="mt-2 text-2xl font-bold">Kalkulator ekranu LED</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Kabinety, pitch, wiele ekranów w projekcie, podgląd CSS i export pixel mapy PNG 1:1. Wynik zawsze na
          całych szafach.
        </p>
      </div>

      {!publicMode ? <LedScreenProjectBar session={session} /> : null}

      {session.loading ? (
        <p className="text-sm text-muted-foreground">Ładowanie projektu…</p>
      ) : (
        <LedScreensWorkspace
          project={session.payload}
          onChange={session.setPayload}
          projectName={session.project?.name ?? (publicMode ? 'Demo' : undefined)}
          logoUrl={user?.logoDarkBgUrl ?? user?.logoLightBgUrl ?? null}
        />
      )}
    </div>
  )
}
