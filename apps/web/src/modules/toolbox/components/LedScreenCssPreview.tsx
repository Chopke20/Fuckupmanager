import {
  calculateScreenFromSpec,
  type LedScreenSpec,
} from '../calculators/ledScreen'

function ScreenBox({
  screen,
  selected,
  pxPerM,
  onSelect,
}: {
  screen: LedScreenSpec
  selected: boolean
  pxPerM: number
  onSelect?: () => void
}) {
  const calc = calculateScreenFromSpec(screen)
  if (!calc.ok) return null
  const w = calc.screenWidthM * pxPerM
  const h = calc.screenHeightM * pxPerM
  const left = screen.layoutXM * pxPerM
  const top = screen.layoutYM * pxPerM
  const ghostH = calc.screenWidthM / screen.targetRatio * pxPerM

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`absolute overflow-hidden rounded-sm border text-left transition-shadow ${
        selected
          ? 'border-primary shadow-[0_0_0_2px_rgba(var(--primary-rgb,59,130,246),0.35)]'
          : 'border-border/80 hover:border-primary/50'
      }`}
      style={{
        left,
        top,
        width: w,
        height: h,
        background:
          'linear-gradient(145deg, rgba(40,40,48,0.95) 0%, rgba(22,22,28,0.98) 100%)',
      }}
      title={screen.label}
    >
      {/* ghost proporcji */}
      <span
        className="pointer-events-none absolute left-0 border border-dashed border-white/25"
        style={{
          width: w,
          height: Math.min(ghostH, h * 1.4),
          top: (h - Math.min(ghostH, h * 1.4)) / 2,
          opacity: 0.5,
        }}
      />
      {/* siatka kabinetów */}
      <span
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: `${w / calc.columns}px ${h / calc.rows}px`,
        }}
      />
      <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {screen.label}
      </span>
      <span className="absolute bottom-1.5 left-1.5 right-1.5 space-y-0.5 text-[10px] leading-tight text-white/90">
        <span className="block tabular-nums">
          {calc.screenWidthM} × {calc.screenHeightM} m
        </span>
        <span className="block tabular-nums text-white/70">
          {calc.screenPxW}×{calc.screenPxH} · P{screen.pitchMm} · {calc.columns}×{calc.rows}
        </span>
      </span>
    </button>
  )
}

export default function LedScreenCssPreview({
  screens,
  activeScreenId,
  onSelectScreen,
}: {
  screens: LedScreenSpec[]
  activeScreenId: string
  onSelectScreen?: (id: string) => void
}) {
  const calcs = screens
    .map((s) => ({ screen: s, calc: calculateScreenFromSpec(s) }))
    .filter((x): x is { screen: LedScreenSpec; calc: Extract<ReturnType<typeof calculateScreenFromSpec>, { ok: true }> } => x.calc.ok)

  if (calcs.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-border bg-background text-sm text-muted-foreground">
        Brak poprawnych ekranów do podglądu.
      </div>
    )
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
  const worldW = Math.max(0.5, maxX - minX)
  const worldH = Math.max(0.5, maxY - minY)
  const padM = Math.max(worldW, worldH) * 0.08
  const viewW = worldW + padM * 2
  const viewH = worldH + padM * 2
  const maxCssW = 640
  const maxCssH = 320
  const pxPerM = Math.min(maxCssW / viewW, maxCssH / viewH)

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>Podgląd CSS · skala {pxPerM.toFixed(0)} px/m</span>
        <span className="tabular-nums">
          scena {viewW.toFixed(1)} × {viewH.toFixed(1)} m
        </span>
      </div>
      <div
        className="relative overflow-hidden rounded-lg border border-border"
        style={{
          width: '100%',
          height: viewH * pxPerM,
          background:
            'radial-gradient(ellipse at center, #1c1c22 0%, #0c0c0f 70%)',
        }}
      >
        <div
          className="absolute"
          style={{
            left: (padM - minX) * pxPerM,
            top: (padM - minY) * pxPerM,
            width: worldW * pxPerM,
            height: worldH * pxPerM,
          }}
        >
          {calcs.map(({ screen }) => (
            <ScreenBox
              key={screen.id}
              screen={{
                ...screen,
                layoutXM: screen.layoutXM - minX,
                layoutYM: screen.layoutYM - minY,
              }}
              selected={screen.id === activeScreenId}
              pxPerM={pxPerM}
              onSelect={onSelectScreen ? () => onSelectScreen(screen.id) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
