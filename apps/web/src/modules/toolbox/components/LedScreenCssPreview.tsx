import { useCallback, useMemo, useRef, useState } from 'react'
import {
  calculateScreenFromSpec,
  type LedScreenSpec,
} from '../calculators/ledScreen'

/** Snap pozycji ekranu na scenie (metry). */
export const LED_LAYOUT_SNAP_M = 0.25
/** Co ile rysować cienką linię siatki. */
const GRID_MINOR_M = 0.5
/** Co ile grubą (1 m). */
const GRID_MAJOR_M = 1

function snapM(value: number, step = LED_LAYOUT_SNAP_M): number {
  if (!(step > 0)) return value
  return Math.round(value / step) * step
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function ScreenBox({
  screen,
  selected,
  pxPerM,
  dragging,
  onPointerDown,
}: {
  screen: LedScreenSpec
  selected: boolean
  pxPerM: number
  dragging: boolean
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
}) {
  const calc = calculateScreenFromSpec(screen)
  if (!calc.ok) return null
  const w = calc.screenWidthM * pxPerM
  const h = calc.screenHeightM * pxPerM
  const left = screen.layoutXM * pxPerM
  const top = screen.layoutYM * pxPerM
  const ghostH = (calc.screenWidthM / screen.targetRatio) * pxPerM

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      className={`absolute touch-none select-none overflow-hidden rounded-sm border text-left ${
        selected
          ? 'z-20 border-primary shadow-[0_0_0_2px_rgba(34,197,94,0.35)]'
          : 'z-10 border-white/25 hover:border-primary/60'
      } ${dragging ? 'cursor-grabbing opacity-95' : 'cursor-grab'}`}
      style={{
        left,
        top,
        width: w,
        height: h,
        background:
          'linear-gradient(145deg, rgba(40,40,48,0.95) 0%, rgba(22,22,28,0.98) 100%)',
      }}
      title={`${screen.label} — przeciągnij (snap ${LED_LAYOUT_SNAP_M} m)`}
    >
      <span
        className="pointer-events-none absolute left-0 border border-dashed border-white/25"
        style={{
          width: w,
          height: Math.min(ghostH, h * 1.4),
          top: (h - Math.min(ghostH, h * 1.4)) / 2,
          opacity: 0.5,
        }}
      />
      <span
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: `${w / calc.columns}px ${h / calc.rows}px`,
        }}
      />
      <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {screen.label}
      </span>
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 space-y-0.5 text-[10px] leading-tight text-white/90">
        <span className="block tabular-nums">
          {calc.screenWidthM} × {calc.screenHeightM} m
        </span>
        <span className="block tabular-nums text-white/70">
          {round2(screen.layoutXM)}, {round2(screen.layoutYM)} m
        </span>
      </span>
    </div>
  )
}

export default function LedScreenCssPreview({
  screens,
  activeScreenId,
  onSelectScreen,
  onMoveScreen,
}: {
  screens: LedScreenSpec[]
  activeScreenId: string
  onSelectScreen?: (id: string) => void
  onMoveScreen?: (id: string, layoutXM: number, layoutYM: number) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const dragRef = useRef<{
    id: string
    startClientX: number
    startClientY: number
    originXM: number
    originYM: number
    moved: boolean
  } | null>(null)

  const calcs = useMemo(
    () =>
      screens
        .map((s) => ({ screen: s, calc: calculateScreenFromSpec(s) }))
        .filter(
          (x): x is { screen: LedScreenSpec; calc: Extract<ReturnType<typeof calculateScreenFromSpec>, { ok: true }> } =>
            x.calc.ok
        ),
    [screens]
  )

  const bounds = useMemo(() => {
    if (calcs.length === 0) {
      return { minX: -1, minY: -1, maxX: 11, maxY: 7 }
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const { screen, calc } of calcs) {
      minX = Math.min(minX, screen.layoutXM)
      minY = Math.min(minY, screen.layoutYM)
      maxX = Math.max(maxX, screen.layoutXM + calc.screenWidthM)
      maxY = Math.max(maxY, screen.layoutYM + calc.screenHeightM)
    }
    // Zapas na przeciąganie + minimum sceny
    const pad = 2
    minX = Math.min(minX - pad, -1)
    minY = Math.min(minY - pad, -1)
    maxX = Math.max(maxX + pad, minX + 12)
    maxY = Math.max(maxY + pad, minY + 8)
    return { minX, minY, maxX, maxY }
  }, [calcs])

  const worldW = bounds.maxX - bounds.minX
  const worldH = bounds.maxY - bounds.minY
  const maxCssW = 720
  const maxCssH = 380
  const pxPerM = Math.min(maxCssW / worldW, maxCssH / worldH)
  const stageW = worldW * pxPerM
  const stageH = worldH * pxPerM

  const endDrag = useCallback(() => {
    dragRef.current = null
    setDragId(null)
  }, [])

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || !onMoveScreen) return
      const dxPx = event.clientX - drag.startClientX
      const dyPx = event.clientY - drag.startClientY
      if (!drag.moved && Math.hypot(dxPx, dyPx) < 3) return
      drag.moved = true
      const dxM = dxPx / pxPerM
      const dyM = dyPx / pxPerM
      const nextX = snapM(drag.originXM + dxM)
      const nextY = snapM(drag.originYM + dyM)
      onMoveScreen(drag.id, round2(nextX), round2(nextY))
    },
    [onMoveScreen, pxPerM]
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current
      if (drag && !drag.moved && onSelectScreen) {
        onSelectScreen(drag.id)
      }
      try {
        ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
      } catch {
        //
      }
      endDrag()
    },
    [endDrag, onSelectScreen]
  )

  const startDrag = useCallback(
    (screen: LedScreenSpec, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      onSelectScreen?.(screen.id)
      if (!onMoveScreen) return
      dragRef.current = {
        id: screen.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originXM: screen.layoutXM,
        originYM: screen.layoutYM,
        moved: false,
      }
      setDragId(screen.id)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [onMoveScreen, onSelectScreen]
  )

  if (calcs.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-border bg-background text-sm text-muted-foreground">
        Brak poprawnych ekranów do podglądu.
      </div>
    )
  }

  const minorPx = GRID_MINOR_M * pxPerM
  const majorPx = GRID_MAJOR_M * pxPerM
  // Offset siatki tak, żeby linie 0 m / 1 m wypadały na całkowitych metrach świata
  const offsetXPx = -((bounds.minX % GRID_MAJOR_M) + GRID_MAJOR_M) % GRID_MAJOR_M * pxPerM
  const offsetYPx = -((bounds.minY % GRID_MAJOR_M) + GRID_MAJOR_M) % GRID_MAJOR_M * pxPerM

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Podgląd CSS · przeciągnij ekrany · snap {LED_LAYOUT_SNAP_M} m · siatka {GRID_MINOR_M}/{GRID_MAJOR_M} m
        </span>
        <span className="tabular-nums">
          {worldW.toFixed(1)} × {worldH.toFixed(1)} m · {pxPerM.toFixed(0)} px/m
        </span>
      </div>
      <div
        ref={stageRef}
        className="relative mx-auto overflow-hidden rounded-lg border border-border"
        style={{
          width: stageW,
          maxWidth: '100%',
          height: stageH,
          background: '#0c0c0f',
          touchAction: 'none',
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={endDrag}
      >
        {/* Siatka metrów */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: [
              `linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px)`,
              `linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)`,
              `linear-gradient(to right, rgba(255,255,255,0.14) 1px, transparent 1px)`,
              `linear-gradient(to bottom, rgba(255,255,255,0.14) 1px, transparent 1px)`,
            ].join(', '),
            backgroundSize: `${minorPx}px ${minorPx}px, ${minorPx}px ${minorPx}px, ${majorPx}px ${majorPx}px, ${majorPx}px ${majorPx}px`,
            backgroundPosition: `${offsetXPx}px ${offsetYPx}px`,
          }}
        />
        {/* Oś 0,0 jeśli w widoku */}
        {bounds.minX <= 0 && bounds.maxX >= 0 ? (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-primary/40"
            style={{ left: -bounds.minX * pxPerM }}
          />
        ) : null}
        {bounds.minY <= 0 && bounds.maxY >= 0 ? (
          <div
            className="pointer-events-none absolute left-0 right-0 h-px bg-primary/40"
            style={{ top: -bounds.minY * pxPerM }}
          />
        ) : null}

        {calcs.map(({ screen }) => (
          <ScreenBox
            key={screen.id}
            screen={{
              ...screen,
              layoutXM: screen.layoutXM - bounds.minX,
              layoutYM: screen.layoutYM - bounds.minY,
            }}
            selected={screen.id === activeScreenId}
            pxPerM={pxPerM}
            dragging={dragId === screen.id}
            onPointerDown={(event) => startDrag(screen, event)}
          />
        ))}
      </div>
    </div>
  )
}
