import { Copy, LayoutGrid, Monitor, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  parseStagePlanSetJson,
  stagePlanSceneSummary,
  type StagePlanScene,
} from '@lama-stage/shared-types'
import {
  ledScreenEntrySummary,
  parseLedScreenSetJson,
  type LedScreenSetEntry,
} from '../../toolbox/utils/ledScreenPlanSet'

export interface OrderPlanProjectsPanelProps {
  /** stagePlanJson dla bloku / zlecenia */
  stagePlanJson?: string | null
  /** ledScreenJson dla bloku / zlecenia */
  ledScreenJson?: string | null
  offerBlockId: string | null
  blockTitle?: string
  readOnly?: boolean
  compact?: boolean
  onOpenStage?: (offerBlockId: string | null, blockTitle: string | undefined, sceneId: string) => void
  onAddStage?: (offerBlockId: string | null, blockTitle?: string) => void
  onRenameStage?: (offerBlockId: string | null, sceneId: string, name: string) => void
  onDuplicateStage?: (offerBlockId: string | null, sceneId: string) => void
  onRemoveStage?: (offerBlockId: string | null, sceneId: string) => void
  onOpenLed?: (offerBlockId: string | null, blockTitle: string | undefined, entryId: string) => void
  onAddLed?: (offerBlockId: string | null, blockTitle?: string) => void
  onRenameLed?: (offerBlockId: string | null, entryId: string, name: string) => void
  onDuplicateLed?: (offerBlockId: string | null, entryId: string) => void
  onRemoveLed?: (offerBlockId: string | null, entryId: string) => void
}

function promptName(label: string, current: string): string | null {
  const next = window.prompt(label, current)
  if (next == null) return null
  const trimmed = next.trim()
  return trimmed || null
}

function RowActions({
  onOpen,
  onRename,
  onDuplicate,
  onRemove,
  renameTitle,
  removeTitle,
}: {
  onOpen: () => void
  onRename?: () => void
  onDuplicate?: () => void
  onRemove?: () => void
  renameTitle: string
  removeTitle: string
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {onRename ? (
        <button
          type="button"
          title={renameTitle}
          className="rounded p-1 text-muted-foreground hover:bg-surface"
          onClick={onRename}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {onDuplicate ? (
        <button
          type="button"
          title="Duplikuj"
          className="rounded p-1 text-muted-foreground hover:bg-surface"
          onClick={onDuplicate}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          title={removeTitle}
          className="rounded p-1 text-red-500 hover:bg-red-500/10"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        title="Otwórz"
        className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-surface"
        onClick={onOpen}
      >
        Edytuj
      </button>
    </span>
  )
}

function SceneRow({
  scene,
  offerBlockId,
  blockTitle,
  readOnly,
  onOpenStage,
  onRenameStage,
  onDuplicateStage,
  onRemoveStage,
}: {
  scene: StagePlanScene
  offerBlockId: string | null
  blockTitle?: string
  readOnly?: boolean
  onOpenStage?: OrderPlanProjectsPanelProps['onOpenStage']
  onRenameStage?: OrderPlanProjectsPanelProps['onRenameStage']
  onDuplicateStage?: OrderPlanProjectsPanelProps['onDuplicateStage']
  onRemoveStage?: OrderPlanProjectsPanelProps['onRemoveStage']
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded border border-border bg-background/60 px-2 py-1.5 text-xs">
      <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
        onClick={() => onOpenStage?.(offerBlockId, blockTitle, scene.id)}
        title="Otwórz edytor sceny"
      >
        {stagePlanSceneSummary(scene)}
      </button>
      {!readOnly ? (
        <RowActions
          renameTitle="Zmień nazwę sceny"
          removeTitle="Usuń scenę"
          onOpen={() => onOpenStage?.(offerBlockId, blockTitle, scene.id)}
          onRename={
            onRenameStage
              ? () => {
                  const next = promptName('Nazwa sceny', scene.name)
                  if (next) onRenameStage(offerBlockId, scene.id, next)
                }
              : undefined
          }
          onDuplicate={
            onDuplicateStage ? () => onDuplicateStage(offerBlockId, scene.id) : undefined
          }
          onRemove={onRemoveStage ? () => onRemoveStage(offerBlockId, scene.id) : undefined}
        />
      ) : null}
    </li>
  )
}

function LedRow({
  entry,
  offerBlockId,
  blockTitle,
  readOnly,
  onOpenLed,
  onRenameLed,
  onDuplicateLed,
  onRemoveLed,
}: {
  entry: LedScreenSetEntry
  offerBlockId: string | null
  blockTitle?: string
  readOnly?: boolean
  onOpenLed?: OrderPlanProjectsPanelProps['onOpenLed']
  onRenameLed?: OrderPlanProjectsPanelProps['onRenameLed']
  onDuplicateLed?: OrderPlanProjectsPanelProps['onDuplicateLed']
  onRemoveLed?: OrderPlanProjectsPanelProps['onRemoveLed']
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded border border-border bg-background/60 px-2 py-1.5 text-xs">
      <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
        onClick={() => onOpenLed?.(offerBlockId, blockTitle, entry.id)}
        title="Otwórz edytor LED"
      >
        {ledScreenEntrySummary(entry)}
      </button>
      {!readOnly ? (
        <RowActions
          renameTitle="Zmień nazwę ekranu"
          removeTitle="Usuń ekran"
          onOpen={() => onOpenLed?.(offerBlockId, blockTitle, entry.id)}
          onRename={
            onRenameLed
              ? () => {
                  const next = promptName('Nazwa projektu LED', entry.name)
                  if (next) onRenameLed(offerBlockId, entry.id, next)
                }
              : undefined
          }
          onDuplicate={
            onDuplicateLed ? () => onDuplicateLed(offerBlockId, entry.id) : undefined
          }
          onRemove={onRemoveLed ? () => onRemoveLed(offerBlockId, entry.id) : undefined}
        />
      ) : null}
    </li>
  )
}

export default function OrderPlanProjectsPanel({
  stagePlanJson,
  ledScreenJson,
  offerBlockId,
  blockTitle,
  readOnly,
  compact,
  onOpenStage,
  onAddStage,
  onRenameStage,
  onDuplicateStage,
  onRemoveStage,
  onOpenLed,
  onAddLed,
  onRenameLed,
  onDuplicateLed,
  onRemoveLed,
}: OrderPlanProjectsPanelProps) {
  const stageSet = parseStagePlanSetJson(stagePlanJson ?? null)
  const ledSet = parseLedScreenSetJson(ledScreenJson ?? null)
  const titleClass = compact
    ? 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'
    : 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface/40 p-3">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className={titleClass}>Sceny z podestów</h4>
          {!readOnly && onAddStage ? (
            <button
              type="button"
              onClick={() => onAddStage(offerBlockId, blockTitle)}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-surface"
            >
              <Plus className="h-3.5 w-3.5" />
              Nowa scena
            </button>
          ) : null}
        </div>
        {stageSet.scenes.length > 0 ? (
          <ul className="space-y-1">
            {stageSet.scenes.map((scene) => (
              <SceneRow
                key={scene.id}
                scene={scene}
                offerBlockId={offerBlockId}
                blockTitle={blockTitle}
                readOnly={readOnly}
                onOpenStage={onOpenStage}
                onRenameStage={onRenameStage}
                onDuplicateStage={onDuplicateStage}
                onRemoveStage={onRemoveStage}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Brak scen — dodaj układ podestów, żeby wpaść do wykazu.
          </p>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className={titleClass}>Ekrany LED</h4>
          {!readOnly && onAddLed ? (
            <button
              type="button"
              onClick={() => onAddLed(offerBlockId, blockTitle)}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-surface"
            >
              <Plus className="h-3.5 w-3.5" />
              Nowy ekran
            </button>
          ) : null}
        </div>
        {ledSet.entries.length > 0 ? (
          <ul className="space-y-1">
            {ledSet.entries.map((entry) => (
              <LedRow
                key={entry.id}
                entry={entry}
                offerBlockId={offerBlockId}
                blockTitle={blockTitle}
                readOnly={readOnly}
                onOpenLed={onOpenLed}
                onRenameLed={onRenameLed}
                onDuplicateLed={onDuplicateLed}
                onRemoveLed={onRemoveLed}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Brak projektów LED — dodaj ekran i zapisz do wykazu (zębatka mapowań jak przy podestach).
          </p>
        )}
      </div>
    </div>
  )
}
