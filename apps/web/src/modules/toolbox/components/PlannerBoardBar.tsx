import { FormEvent, useEffect, useState } from 'react'
import { FolderOpen, Plus, Save, Trash2 } from 'lucide-react'
import type { PlannerBoardSession } from '../hooks/usePlannerBoardSession'

export default function PlannerBoardBar({ session }: { session: PlannerBoardSession }) {
  const [nameDraft, setNameDraft] = useState(session.board?.name ?? '')
  const [saveAsName, setSaveAsName] = useState('')

  useEffect(() => {
    setNameDraft(session.board?.name ?? '')
  }, [session.board?.id, session.board?.name])

  useEffect(() => {
    if (session.saveAsOpen) {
      setSaveAsName(session.board ? `${session.board.name} (kopia)` : 'Nowa tablica')
    }
  }, [session.saveAsOpen, session.board])

  const onRenameBlur = () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !session.board || trimmed === session.board.name) return
    void session.renameBoard(trimmed)
  }

  const confirmDelete = (id: string, name: string) => {
    const ok = window.confirm(`Usunąć tablicę „${name}”? Tej operacji nie da się cofnąć.`)
    if (!ok) return
    void session.deleteBoard(id)
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded border border-border bg-background px-2 py-1 text-sm font-medium"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={onRenameBlur}
          aria-label="Nazwa tablicy"
          disabled={!session.board}
        />
        {session.saving ? (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Zapis…</span>
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="Gotowe" />
        )}
        <button
          type="button"
          onClick={() => void session.saveNow()}
          disabled={!session.board || session.saving}
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
            void session.refreshBoards().then(() => session.setPickerOpen(true))
          }}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-primary/40"
        >
          <FolderOpen size={12} /> Otwórz
        </button>
        <button
          type="button"
          onClick={() => void session.createNewBoard()}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-primary/40"
        >
          <Plus size={12} /> Nowa
        </button>
        <button
          type="button"
          disabled={!session.board || session.saving}
          onClick={() => {
            if (!session.board) return
            confirmDelete(session.board.id, session.board.name)
          }}
          className="inline-flex items-center gap-1 rounded border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          <Trash2 size={12} /> Usuń
        </button>
      </div>
      {session.error ? <p className="text-xs text-red-400">{session.error}</p> : null}

      {session.pickerOpen ? (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-border bg-background p-2">
          {session.boards.length === 0 ? (
            <p className="text-xs text-muted-foreground">Brak tablic.</p>
          ) : (
            session.boards.map((b) => (
              <div
                key={b.id}
                className={`flex w-full items-center gap-1 rounded px-1 py-0.5 ${
                  session.board?.id === b.id ? 'bg-primary/10' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => void session.openBoard(b.id)}
                  className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded px-1 py-1 text-left text-xs hover:bg-surface-2 ${
                    session.board?.id === b.id ? 'text-primary' : ''
                  }`}
                >
                  <span className="truncate font-medium">{b.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(b.updatedAt).toLocaleDateString('pl-PL')}
                  </span>
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  title={`Usuń „${b.name}”`}
                  aria-label={`Usuń tablicę ${b.name}`}
                  onClick={() => confirmDelete(b.id, b.name)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
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
