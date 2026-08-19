import { Link } from 'react-router-dom'
import { TOOLBOX_TOOLS } from '../data/tools'

export default function ToolboxPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Toolbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kalkulatory i skróty do wyceny — niezależnie od otwartego zlecenia.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TOOLBOX_TOOLS.map((tool) => {
          const inner = (
            <div
              className={`h-full rounded-lg border p-4 transition-colors ${
                tool.status === 'ready'
                  ? 'border-border bg-surface hover:border-primary/40'
                  : 'border-border bg-surface/60 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold">{tool.title}</h2>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                    tool.status === 'ready'
                      ? 'border border-primary/40 text-primary'
                      : 'border border-border text-muted-foreground'
                  }`}
                >
                  {tool.status === 'ready' ? 'Gotowe' : 'Wkrótce'}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{tool.description}</p>
            </div>
          )

          if (tool.status !== 'ready') {
            return (
              <div key={tool.slug} aria-disabled="true">
                {inner}
              </div>
            )
          }

          return (
            <Link key={tool.slug} to={`/toolbox/${tool.slug}`} className="block">
              {inner}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
