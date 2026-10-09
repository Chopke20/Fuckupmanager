import { FormEvent, useEffect, useState } from 'react'
import { FolderOpen, Plus, Save } from 'lucide-react'
import { orderLedProjectLabel } from '../api/ledScreenProjects.api'
import type { LedScreenProjectSession } from '../hooks/useLedScreenProjectSession'

export default function LedScreenProjectBar({ session }: { session: LedScreenProjectSession }) {
  const [nameDraft, setNameDraft] = useState(session.project?.name ?? '')
  const [saveAsName, setSaveAsName] = useState('')

  useEffect(() => {
    setNameDraft(session.project?.name ?? '')
  }, [session.project?.id, session.project?.name])

  useEffect(() => {
    if (session.saveAsOpen) {
      setSaveAsName(session.project ? `${session.project.name} (kopia)` : 'Nowy projekt LED')
    }
  }, [session.saveAsOpen, session.project])

  const onRenameBlur = () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !session.project || trimmed === session.project.name) return
    void session.renameProject(trimmed)
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded border border-border bg-background px-2 py-1 text-sm font-medium"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={onRenameBlur}
          aria-label="Nazwa projektu LED"
          disabled={!session.project}
        />
        {session.saving ? (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Zapis…</span>
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="Gotowe" />
        )}
        <button
          type="button"
          onClick={() => void session.saveNow()}
          disabled={!session.project || session.saving}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-primary/40 disabled:opacity-50"
        >
          <Save size={12} /> Zapisz
        </button>
        <button
          type="button"
          onClick={() => session.setSaveAsOpen(true)}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-primary/40"
        >
          Zapisz jako
        </button>
        <button
          type="button"
          onClick={() => {
            void session.refreshProjects().then(() => session.setPickerOpen(true))
          }}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-primary/40"
        >
          <FolderOpen size={12} /> Otwórz
        </button>
        <button
          type="button"
          onClick={() => void session.createNewProject()}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-primary/40"
        >
          <Plus size={12} /> Nowy
        </button>
      </div>
      {session.project?.order ? (
        <p className="text-[11px] text-muted-foreground">
          Zlecenie: {orderLedProjectLabel(session.project)}
        </p>
      ) : null}
      {session.error ? <p className="text-xs text-red-400">{session.error}</p> : null}

      {session.pickerOpen ? (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-border bg-background p-2">
          {session.projects.length === 0 ? (
            <p className="text-xs text-muted-foreground">Brak projektów.</p>
          ) : (
            session.projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void session.openProject(p.id)}
                className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-surface-2 ${
                  session.project?.id === p.id ? 'bg-primary/10 text-primary' : ''
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">
                  {orderLedProjectLabel(p) ?? new Date(p.updatedAt).toLocaleDateString('pl-PL')}
                </span>
              </button>
            ))
          )}
          <button
            type="button"
            className="mt-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => session.setPickerOpen(false)}
          >
            Zamknij listę
          </button>
        </div>
      ) : null}

      {session.saveAsOpen ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            void session.saveAs(saveAsName)
          }}
        >
          <input
            className="min-w-[12rem] flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
            value={saveAsName}
            onChange={(e) => setSaveAsName(e.target.value)}
            placeholder="Nazwa kopii"
          />
          <button type="submit" className="rounded border border-primary px-2 py-1 text-xs text-primary">
            Zapisz kopię
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground"
            onClick={() => session.setSaveAsOpen(false)}
          >
            Anuluj
          </button>
        </form>
      ) : null}
    </div>
  )
}
