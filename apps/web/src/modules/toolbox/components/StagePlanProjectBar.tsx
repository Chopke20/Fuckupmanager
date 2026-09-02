import { FormEvent, useEffect, useState } from 'react'
import { Download, FolderOpen, Plus, Save } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { StagePlan } from '@lama-stage/shared-types'
import { orderProjectLabel, downloadStagePlanPreviewPdf } from '../api/stagePlanProjects.api'
import type { StagePlanProjectSession } from '../hooks/useStagePlanProjectSession'

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SaveStatusDot({
  status,
  lastSavedAt,
  error,
}: {
  status: 'ok' | 'error'
  lastSavedAt: number | null
  error: string | null
}) {
  const title =
    status === 'error'
      ? error ?? 'Błąd zapisu'
      : lastSavedAt
        ? `Zapisano ${formatWhen(new Date(lastSavedAt).toISOString())}`
        : 'Zapisano'

  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'
      }`}
      title={title}
      aria-label={title}
    />
  )
}

export default function StagePlanProjectBar({
  session,
  currentPlan,
}: {
  session: StagePlanProjectSession
  currentPlan: StagePlan | null
}) {
  const [nameDraft, setNameDraft] = useState(session.project?.name ?? '')
  const [saveAsName, setSaveAsName] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    setNameDraft(session.project?.name ?? '')
  }, [session.project?.id, session.project?.name])

  useEffect(() => {
    if (session.saveAsOpen) {
      setSaveAsName(session.project ? `${session.project.name} (kopia)` : 'Nowy projekt')
    }
  }, [session.saveAsOpen, session.project])

  const onRenameBlur = () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !session.project || trimmed === session.project.name) return
    void session.renameProject(trimmed)
  }

  const onSave = () => {
    if (!currentPlan) return
    void session.saveNow(currentPlan)
  }

  const onSaveAsSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!currentPlan || !saveAsName.trim()) return
    void session.saveAs(saveAsName.trim(), currentPlan)
  }

  const onDownloadPdf = async () => {
    if (!currentPlan) return
    setPdfLoading(true)
    try {
      await downloadStagePlanPreviewPdf(currentPlan, session.project?.name ?? 'Plan sceny')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Projekt</div>
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={onRenameBlur}
            className="mt-0.5 w-full max-w-md rounded border border-border bg-background px-2 py-1 text-sm font-medium focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Nazwa projektu"
          />
          {session.project?.orderId ? (
            <div className="mt-1 text-xs text-muted-foreground">
              Przypisane do zlecenia:{' '}
              <Link
                to={`/orders/${session.project.orderId}`}
                className="text-primary hover:underline"
              >
                {orderProjectLabel(session.project) ?? session.project.orderId}
              </Link>
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">Bez przypisanego zlecenia</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onSave}
            disabled={session.busy || !currentPlan}
            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
          >
            <Save size={14} />
            Zapisz
          </button>
          <button
            type="button"
            onClick={() => session.setSaveAsOpen(true)}
            disabled={session.busy || !currentPlan}
            className="rounded border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
          >
            Zapisz jako…
          </button>
          <button
            type="button"
            onClick={() => void onDownloadPdf()}
            disabled={!currentPlan || pdfLoading}
            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
          >
            <Download size={14} />
            {pdfLoading ? 'PDF…' : 'Pobierz PDF'}
          </button>
          <button
            type="button"
            onClick={() => {
              void session.refreshProjects()
              session.setPickerOpen(true)
            }}
            disabled={session.busy}
            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
          >
            <FolderOpen size={14} />
            Otwórz
          </button>
          <button
            type="button"
            onClick={() => void session.createNewProject()}
            disabled={session.busy}
            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
          >
            <Plus size={14} />
            Nowy
          </button>
          <SaveStatusDot
            status={session.saveStatus}
            lastSavedAt={session.lastSavedAt}
            error={session.error}
          />
        </div>
      </div>

      {session.pickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) session.setPickerOpen(false)
          }}
        >
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-lg font-bold">Projekty sceny</h2>
              <button
                type="button"
                onClick={() => session.setPickerOpen(false)}
                className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Zamknij
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {session.projects.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">Brak zapisanych projektów.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {session.projects.map((item) => {
                    const orderLabel = orderProjectLabel(item)
                    const active = item.id === session.project?.id
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void session.openProject(item.id)}
                          className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-2 ${
                            active ? 'bg-primary/5' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-medium">{item.name}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {orderLabel ? `Zlecenie: ${orderLabel}` : 'Bez zlecenia'}
                            </div>
                          </div>
                          <div className="shrink-0 text-right text-xs text-muted-foreground">
                            {formatWhen(item.updatedAt)}
                            {active ? <div className="text-primary">Otwarty</div> : null}
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {session.saveAsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) session.setSaveAsOpen(false)
          }}
        >
          <form
            onSubmit={onSaveAsSubmit}
            className="w-full max-w-md rounded-xl border border-border bg-surface p-4"
          >
            <h2 className="text-lg font-bold">Zapisz jako</h2>
            <label className="mt-3 block text-xs font-medium" htmlFor="save-as-name">
              Nazwa projektu
            </label>
            <input
              id="save-as-name"
              type="text"
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => session.setSaveAsOpen(false)}
                className="rounded border border-border px-3 py-1.5 text-xs"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={!saveAsName.trim() || session.busy}
                className="rounded border-2 border-primary px-3 py-1.5 text-xs font-medium text-primary disabled:opacity-50"
              >
                Zapisz
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
