import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Copy, LayoutGrid, Monitor, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  formatMeters,
  parseStagePlanSetJson,
  type StagePlanScene,
} from '@lama-stage/shared-types'
import {
  ledScreenCabinetsTotal,
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

function sceneMeta(scene: StagePlanScene): string {
  const { widthM, depthM, legHeightCm, counts } = scene.plan
  return `${formatMeters(widthM)}×${formatMeters(depthM)} m · ${counts.decksTotal} pod. · ${legHeightCm} cm`
}

function ledMeta(entry: LedScreenSetEntry): string {
  const cabinets = ledScreenCabinetsTotal(entry.project)
  const screens = entry.project.screens.length
  return `${screens} ekr. · ${cabinets} szaf.`
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
  children: ReactNode
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

function InlineRenameField({
  value,
  meta,
  onSave,
  onCancel,
}: {
  value: string
  meta: string
  onSave: (next: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipBlurSave = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const commit = () => {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === value) {
      onCancel()
      return
    }
    onSave(trimmed)
  }

  return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            skipBlurSave.current = true
            commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            skipBlurSave.current = true
            onCancel()
          }
        }}
        onBlur={() => {
          if (skipBlurSave.current) {
            skipBlurSave.current = false
            return
          }
          commit()
        }}
        className="min-w-0 flex-1 rounded border border-primary/50 bg-background px-1.5 py-0.5 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-primary/40"
        aria-label="Nazwa"
      />
      <span className="hidden max-w-[40%] truncate text-[10px] text-muted-foreground sm:inline">
        {meta}
      </span>
      <IconBtn
        title="Zapisz"
        onClick={() => {
          skipBlurSave.current = true
          commit()
        }}
      >
        <Check className="h-3 w-3 text-primary" />
      </IconBtn>
      <IconBtn
        title="Anuluj"
        onClick={() => {
          skipBlurSave.current = true
          onCancel()
        }}
      >
        <X className="h-3 w-3" />
      </IconBtn>
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
  const [renaming, setRenaming] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const meta = sceneMeta(scene)

  if (confirmRemove && onRemoveStage) {
    return (
      <li className="flex flex-wrap items-center gap-1.5 rounded border border-red-500/40 bg-red-500/5 px-1.5 py-1 text-[11px]">
        <LayoutGrid className="h-3 w-3 shrink-0 text-red-400" />
        <span className="min-w-0 flex-1 text-muted-foreground">
          Usunąć <span className="font-medium text-foreground">{scene.name}</span>? Zniknie też sprzęt z wykazu.
        </span>
        <button
          type="button"
          className="rounded border border-red-500/50 px-1.5 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/10"
          onClick={() => {
            onRemoveStage(offerBlockId, scene.id)
            setConfirmRemove(false)
          }}
        >
          Usuń
        </button>
        <button
          type="button"
          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => setConfirmRemove(false)}
        >
          Anuluj
        </button>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-1.5 rounded border border-border/70 bg-background/50 px-1.5 py-0.5 text-[11px]">
      <LayoutGrid className="h-3 w-3 shrink-0 text-muted-foreground" />
      {renaming && onRenameStage ? (
        <InlineRenameField
          value={scene.name}
          meta={meta}
          onSave={(next) => {
            onRenameStage(offerBlockId, scene.id, next)
            setRenaming(false)
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left hover:underline"
          onClick={() => onOpenStage?.(offerBlockId, blockTitle, scene.id)}
          title="Otwórz edytor sceny"
        >
          <span className="font-medium">{scene.name}</span>
          <span className="text-muted-foreground"> · {meta}</span>
        </button>
      )}
      {!readOnly && !renaming ? (
        <span className="flex shrink-0 items-center">
          {onRenameStage ? (
            <IconBtn title="Zmień nazwę" onClick={() => setRenaming(true)}>
              <Pencil className="h-3 w-3" />
            </IconBtn>
          ) : null}
          {onDuplicateStage ? (
            <IconBtn title="Duplikuj" onClick={() => onDuplicateStage(offerBlockId, scene.id)}>
              <Copy className="h-3 w-3" />
            </IconBtn>
          ) : null}
          {onRemoveStage ? (
            <IconBtn title="Usuń scenę" danger onClick={() => setConfirmRemove(true)}>
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
  const [renaming, setRenaming] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const meta = ledMeta(entry)

  if (confirmRemove && onRemoveLed) {
    return (
      <li className="flex flex-wrap items-center gap-1.5 rounded border border-red-500/40 bg-red-500/5 px-1.5 py-1 text-[11px]">
        <Monitor className="h-3 w-3 shrink-0 text-red-400" />
        <span className="min-w-0 flex-1 text-muted-foreground">
          Usunąć <span className="font-medium text-foreground">{entry.name}</span>? Zniknie też sprzęt z wykazu.
        </span>
        <button
          type="button"
          className="rounded border border-red-500/50 px-1.5 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/10"
          onClick={() => {
            onRemoveLed(offerBlockId, entry.id)
            setConfirmRemove(false)
          }}
        >
          Usuń
        </button>
        <button
          type="button"
          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => setConfirmRemove(false)}
        >
          Anuluj
        </button>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-1.5 rounded border border-border/70 bg-background/50 px-1.5 py-0.5 text-[11px]">
      <Monitor className="h-3 w-3 shrink-0 text-muted-foreground" />
      {renaming && onRenameLed ? (
        <InlineRenameField
          value={entry.name}
          meta={meta}
          onSave={(next) => {
            onRenameLed(offerBlockId, entry.id, next)
            setRenaming(false)
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left hover:underline"
          onClick={() => onOpenLed?.(offerBlockId, blockTitle, entry.id)}
          title="Otwórz edytor LED"
        >
          <span className="font-medium">{entry.name}</span>
          <span className="text-muted-foreground"> · {meta}</span>
        </button>
      )}
      {!readOnly && !renaming ? (
        <span className="flex shrink-0 items-center">
          {onRenameLed ? (
            <IconBtn title="Zmień nazwę" onClick={() => setRenaming(true)}>
              <Pencil className="h-3 w-3" />
            </IconBtn>
          ) : null}
          {onDuplicateLed ? (
            <IconBtn title="Duplikuj" onClick={() => onDuplicateLed(offerBlockId, entry.id)}>
              <Copy className="h-3 w-3" />
            </IconBtn>
          ) : null}
          {onRemoveLed ? (
            <IconBtn title="Usuń ekran" danger onClick={() => setConfirmRemove(true)}>
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
