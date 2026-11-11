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
  stagePlanJson?: string | null
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

function IconBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded p-0.5 ${
        danger
          ? 'text-red-500 hover:bg-red-500/10'
          : 'text-muted-foreground hover:bg-background hover:text-foreground'
      }`}
    >
      {children}
    </button>
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
    <li className="flex items-center gap-1.5 rounded border border-border/70 bg-background/50 px-1.5 py-0.5 text-[11px]">
      <LayoutGrid className="h-3 w-3 shrink-0 text-muted-foreground" />
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
        onClick={() => onOpenStage?.(offerBlockId, blockTitle, scene.id)}
        title="Otwórz edytor sceny"
      >
        {stagePlanSceneSummary(scene)}
      </button>
      {!readOnly ? (
        <span className="flex shrink-0 items-center">
          {onRenameStage ? (
            <IconBtn
              title="Zmień nazwę"
              onClick={() => {
                const next = promptName('Nazwa sceny', scene.name)
                if (next) onRenameStage(offerBlockId, scene.id, next)
              }}
            >
              <Pencil className="h-3 w-3" />
            </IconBtn>
          ) : null}
          {onDuplicateStage ? (
            <IconBtn title="Duplikuj" onClick={() => onDuplicateStage(offerBlockId, scene.id)}>
              <Copy className="h-3 w-3" />
            </IconBtn>
          ) : null}
          {onRemoveStage ? (
            <IconBtn
              title="Usuń scenę"
              danger
              onClick={() => onRemoveStage(offerBlockId, scene.id)}
            >
              <Trash2 className="h-3 w-3" />
            </IconBtn>
          ) : null}
        </span>
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
    <li className="flex items-center gap-1.5 rounded border border-border/70 bg-background/50 px-1.5 py-0.5 text-[11px]">
      <Monitor className="h-3 w-3 shrink-0 text-muted-foreground" />
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
        onClick={() => onOpenLed?.(offerBlockId, blockTitle, entry.id)}
        title="Otwórz edytor LED"
      >
        {ledScreenEntrySummary(entry)}
      </button>
      {!readOnly ? (
        <span className="flex shrink-0 items-center">
          {onRenameLed ? (
            <IconBtn
              title="Zmień nazwę"
              onClick={() => {
                const next = promptName('Nazwa projektu LED', entry.name)
                if (next) onRenameLed(offerBlockId, entry.id, next)
              }}
            >
              <Pencil className="h-3 w-3" />
            </IconBtn>
          ) : null}
          {onDuplicateLed ? (
            <IconBtn title="Duplikuj" onClick={() => onDuplicateLed(offerBlockId, entry.id)}>
              <Copy className="h-3 w-3" />
            </IconBtn>
          ) : null}
          {onRemoveLed ? (
            <IconBtn
              title="Usuń ekran"
              danger
              onClick={() => onRemoveLed(offerBlockId, entry.id)}
            >
              <Trash2 className="h-3 w-3" />
            </IconBtn>
          ) : null}
        </span>
      ) : null}
    </li>
  )
}

function SectionHeader({
  label,
  addLabel,
  onAdd,
  readOnly,
}: {
  label: string
  addLabel: string
  onAdd?: () => void
  readOnly?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h4>
      {!readOnly && onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          {addLabel}
        </button>
      ) : null}
    </div>
  )
}

export default function OrderPlanProjectsPanel({
  stagePlanJson,
  ledScreenJson,
  offerBlockId,
  blockTitle,
  readOnly,
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
  const hasStages = stageSet.scenes.length > 0
  const hasLed = ledSet.entries.length > 0

  return (
    <div className="rounded border border-border/80 bg-surface/30 px-2 py-1.5">
      <div className="grid gap-1.5 md:grid-cols-2 md:gap-3">
        <div className="min-w-0 space-y-1">
          <SectionHeader
            label="Sceny"
            addLabel="Nowa"
            readOnly={readOnly}
            onAdd={onAddStage ? () => onAddStage(offerBlockId, blockTitle) : undefined}
          />
          {hasStages ? (
            <ul className="space-y-0.5">
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
          ) : null}
        </div>

        <div className="min-w-0 space-y-1">
          <SectionHeader
            label="Ekrany LED"
            addLabel="Nowy"
            readOnly={readOnly}
            onAdd={onAddLed ? () => onAddLed(offerBlockId, blockTitle) : undefined}
          />
          {hasLed ? (
            <ul className="space-y-0.5">
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
          ) : null}
        </div>
      </div>
    </div>
  )
}
