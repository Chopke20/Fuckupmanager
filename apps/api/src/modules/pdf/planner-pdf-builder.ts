/**
 * PDF planera — przegląd osi czasu (A4 landscape) + szczegóły bloków/sekcji.
 * Jasna paleta pod druk; nie zrzut dark UI.
 */

const PDF_TIME_ZONE = 'Europe/Warsaw'

const SECTION_COLORS = [
  '#fde68a',
  '#bbf7d0',
  '#bfdbfe',
  '#fbcfe8',
  '#ddd6fe',
  '#a5f3fc',
  '#fed7aa',
  '#e2e8f0',
] as const

const DEFAULT_BLOCK_COLOR = '#3b82f6'

export interface PlannerPdfSection {
  id: string
  title: string
  text: string
  color?: string
}

export interface PlannerPdfBlock {
  id: string
  dayOffset: number
  startMin: number
  endMin: number
  title: string
  sections: PlannerPdfSection[]
  color?: string
}

export interface PlannerPdfNote {
  id: string
  y: number
  title?: string
  body: string
}

export interface PlannerPdfBoard {
  version: 1
  range: { startDate: string; dayCount: number }
  time: { startHour: number; endHour: number; snapMinutes: number }
  blocks: PlannerPdfBlock[]
  notes: PlannerPdfNote[]
}

interface LayoutSlot {
  col: number
  colCount: number
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtPlDate(value: Date | string | null | undefined): string {
  if (value == null || value === '') return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: PDF_TIME_ZONE,
  })
}

function parseIsoParts(isoDate: string): { y: number; m: number; d: number } {
  const parts = isoDate.split('-').map(Number)
  return { y: parts[0] ?? 1970, m: parts[1] ?? 1, d: parts[2] ?? 1 }
}

function addDaysIso(isoDate: string, offset: number): string {
  const { y, m, d } = parseIsoParts(isoDate)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + offset)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function formatDayHeader(isoDate: string): string {
  const { y, m, d } = parseIsoParts(isoDate)
  const dt = new Date(y, m - 1, d)
  const weekday = dt.toLocaleDateString('pl-PL', { weekday: 'short' })
  const day = dt.toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' })
  return `${weekday} ${day}`
}

function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Kolor sekcji zawsze z kolejności (1., 2., 3.…). */
function sectionAccent(index: number): string {
  return SECTION_COLORS[index % SECTION_COLORS.length] ?? SECTION_COLORS[0]
}

function layoutOverlappingBlocks(blocks: PlannerPdfBlock[]): Map<string, LayoutSlot> {
  const result = new Map<string, LayoutSlot>()
  if (blocks.length === 0) return result

  const sorted = [...blocks].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.id.localeCompare(b.id)
  )

  const clusters: PlannerPdfBlock[][] = []
  let current: PlannerPdfBlock[] = []
  let clusterEnd = -1
  for (const b of sorted) {
    if (current.length === 0 || b.startMin < clusterEnd) {
      current.push(b)
      clusterEnd = Math.max(clusterEnd, b.endMin)
    } else {
      clusters.push(current)
      current = [b]
      clusterEnd = b.endMin
    }
  }
  if (current.length) clusters.push(current)

  for (const cluster of clusters) {
    const colEnds: number[] = []
    const cols = new Map<string, number>()
    const ordered = [...cluster].sort(
      (a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.id.localeCompare(b.id)
    )
    for (const b of ordered) {
      let placed = false
      for (let c = 0; c < colEnds.length; c++) {
        const end = colEnds[c]
        if (end !== undefined && end <= b.startMin) {
          cols.set(b.id, c)
          colEnds[c] = b.endMin
          placed = true
          break
        }
      }
      if (!placed) {
        cols.set(b.id, colEnds.length)
        colEnds.push(b.endMin)
      }
    }
    const colCount = Math.max(1, colEnds.length)
    for (const b of cluster) {
      result.set(b.id, { col: cols.get(b.id) ?? 0, colCount })
    }
  }
  return result
}

function contrastText(bg: string): string {
  const hex = bg.replace('#', '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(0, 6)
  if (full.length < 6) return '#ffffff'
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#111111' : '#ffffff'
}

export function buildPlannerPdfHtml(params: {
  name: string
  board: PlannerPdfBoard
  issuedAt: string
  companyName?: string | null
}): string {
  const { board } = params
  const dayStart = board.time.startHour * 60
  const dayEnd = board.time.endHour * 60
  const totalMin = Math.max(60, dayEnd - dayStart)
  const hourCount = Math.max(1, board.time.endHour - board.time.startHour)

  // Skala: mieszczenie w landscape (~170mm wysokości roboczej)
  const pxPerHour = Math.max(18, Math.min(36, Math.floor(420 / hourCount)))
  const gridHeight = (totalMin / 60) * pxPerHour
  const gutterW = 44

  const days = Array.from({ length: board.range.dayCount }, (_, i) => i)
  const endDate = addDaysIso(board.range.startDate, Math.max(0, board.range.dayCount - 1))
  const rangeLabel =
    board.range.dayCount === 1
      ? formatDayHeader(board.range.startDate)
      : `${formatDayHeader(board.range.startDate)} – ${formatDayHeader(endDate)}`
  const hoursLabel = `${minutesToLabel(dayStart)}–${minutesToLabel(dayEnd)}`
  const issued = fmtPlDate(params.issuedAt)
  const company = (params.companyName || '').trim() || 'Lama Stage'

  const hourLines: string[] = []
  for (let h = board.time.startHour; h < board.time.endHour; h++) {
    const top = ((h * 60 - dayStart) / 60) * pxPerHour
    hourLines.push(
      `<div class="hour-line" style="top:${top}px"><span>${escapeHtml(minutesToLabel(h * 60))}</span></div>`
    )
  }

  const dayColumns = days
    .map((offset) => {
      const dayBlocks = board.blocks.filter((b) => b.dayOffset === offset)
      const layout = layoutOverlappingBlocks(dayBlocks)
      const blocksHtml = dayBlocks
        .map((block) => {
          const top = ((block.startMin - dayStart) / 60) * pxPerHour
          const height = Math.max(14, ((block.endMin - block.startMin) / 60) * pxPerHour)
          const slot = layout.get(block.id)
          const col = slot?.col ?? 0
          const colCount = slot?.colCount ?? 1
          const widthPct = 100 / colCount
          const leftPct = widthPct * col
          const bg = block.color && /^#/.test(block.color) ? block.color : DEFAULT_BLOCK_COLOR
          const fg = contrastText(bg)
          const sectionHints = (block.sections ?? [])
            .filter((s) => s.title.trim())
            .slice(0, 3)
            .map((s) => escapeHtml(s.title.trim()))
            .join(' · ')
          return `<div class="block" style="top:${top}px;height:${height}px;left:calc(${leftPct}% + 1px);width:calc(${widthPct}% - 2px);background:${escapeHtml(bg)};color:${fg}">
            <div class="block__title">${escapeHtml(block.title)}</div>
            <div class="block__time">${escapeHtml(minutesToLabel(block.startMin))}–${escapeHtml(minutesToLabel(block.endMin))}</div>
            ${sectionHints ? `<div class="block__hint">${sectionHints}</div>` : ''}
          </div>`
        })
        .join('')

      return `<div class="day-col">
        <div class="day-col__head">${escapeHtml(formatDayHeader(addDaysIso(board.range.startDate, offset)))}</div>
        <div class="day-col__body" style="height:${gridHeight}px">
          ${hourLines.map((l) => l.replace('class="hour-line"', 'class="hour-line hour-line--grid"')).join('')}
          ${blocksHtml}
        </div>
      </div>`
    })
    .join('')

  const notesSummary =
    board.notes.length === 0
      ? '<p class="muted">Brak wolnych notatek.</p>'
      : `<ul class="notes-list">${board.notes
          .slice()
          .sort((a, b) => a.y - b.y)
          .map((n) => {
            const title = (n.title || '').trim()
            const body = (n.body || '').trim()
            const label = title || body.slice(0, 80) || 'Notatka'
            return `<li><strong>${escapeHtml(title || 'Notatka')}</strong>${body && title ? ` — ${escapeHtml(body.slice(0, 120))}${body.length > 120 ? '…' : ''}` : body && !title ? ` — ${escapeHtml(label)}` : ''}</li>`
          })
          .join('')}</ul>`

  const detailDays = days
    .map((offset) => {
      const iso = addDaysIso(board.range.startDate, offset)
      const dayBlocks = board.blocks
        .filter((b) => b.dayOffset === offset)
        .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
      if (dayBlocks.length === 0) {
        return `<section class="day-detail">
          <h2>${escapeHtml(formatDayHeader(iso))}</h2>
          <p class="muted">Brak bloków tego dnia.</p>
        </section>`
      }
      const cards = dayBlocks
        .map((block) => {
          const bg = block.color && /^#/.test(block.color) ? block.color : DEFAULT_BLOCK_COLOR
          const sections = (block.sections ?? [])
            .map((s, i) => {
              const accent = sectionAccent(i)
              const title = (s.title || '').trim() || `Sekcja ${i + 1}`
              const text = (s.text || '').trim()
              return `<div class="section" style="border-left-color:${escapeHtml(accent)}">
                <div class="section__title"><span class="dot" style="background:${escapeHtml(accent)}"></span>${escapeHtml(title)}</div>
                ${text ? `<div class="section__body">${escapeHtml(text).replace(/\n/g, '<br/>')}</div>` : '<div class="section__body muted">—</div>'}
              </div>`
            })
            .join('')
          return `<article class="card">
            <div class="card__bar" style="background:${escapeHtml(bg)}"></div>
            <div class="card__body">
              <h3>${escapeHtml(block.title)}</h3>
              <div class="card__time">${escapeHtml(minutesToLabel(block.startMin))}–${escapeHtml(minutesToLabel(block.endMin))}</div>
              ${sections || '<p class="muted">Brak sekcji.</p>'}
            </div>
          </article>`
        })
        .join('')
      return `<section class="day-detail">
        <h2>${escapeHtml(formatDayHeader(iso))}</h2>
        ${cards}
      </section>`
    })
    .join('')

  const notesDetail =
    board.notes.length === 0
      ? ''
      : `<section class="day-detail notes-detail">
        <h2>Notatki</h2>
        ${board.notes
          .slice()
          .sort((a, b) => a.y - b.y)
          .map((n) => {
            const title = (n.title || '').trim() || 'Notatka'
            const body = (n.body || '').trim()
            return `<article class="card card--note">
              <div class="card__body">
                <h3>${escapeHtml(title)}</h3>
                ${body ? `<div class="section__body">${escapeHtml(body).replace(/\n/g, '<br/>')}</div>` : ''}
              </div>
            </article>`
          })
          .join('')}
      </section>`

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(params.name)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #111;
    background: #fff;
    font-size: 10pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { font-size: 16pt; margin: 0 0 2px; }
  h2 { font-size: 12pt; margin: 0 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 11pt; margin: 0 0 2px; }
  .muted { color: #666; font-size: 9pt; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 10px;
  }
  .header__meta { text-align: right; font-size: 8.5pt; color: #444; }
  .header__meta strong { color: #111; }
  .overview { page-break-after: always; }
  .grid-wrap {
    display: grid;
    grid-template-columns: ${gutterW}px repeat(${board.range.dayCount}, minmax(0, 1fr));
    border: 1px solid #ccc;
    border-radius: 4px;
    overflow: hidden;
  }
  .gutter {
    position: relative;
    background: #f7f7f5;
    border-right: 1px solid #ddd;
    height: ${gridHeight + 28}px;
  }
  .gutter .hour-line {
    position: absolute;
    right: 4px;
    transform: translateY(-50%);
    font-size: 7pt;
    color: #666;
  }
  .day-col { min-width: 0; border-right: 1px solid #e5e5e5; }
  .day-col:last-child { border-right: none; }
  .day-col__head {
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8.5pt;
    font-weight: 700;
    background: #f0f0ee;
    border-bottom: 1px solid #ddd;
  }
  .day-col__body { position: relative; background: #fff; }
  .hour-line--grid {
    position: absolute;
    left: 0; right: 0;
    border-top: 1px solid #ececec;
    height: 0;
  }
  .hour-line--grid span { display: none; }
  .block {
    position: absolute;
    border-radius: 3px;
    padding: 2px 4px;
    overflow: hidden;
    font-size: 7.5pt;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12);
  }
  .block__title { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .block__time { opacity: 0.9; font-size: 7pt; }
  .block__hint { opacity: 0.85; font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .notes-box { margin-top: 10px; }
  .notes-box h2 { font-size: 10pt; }
  .notes-list { margin: 0; padding-left: 16px; font-size: 8.5pt; }
  .details { }
  .day-detail { page-break-inside: avoid; margin-bottom: 14px; }
  .card {
    display: flex;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
    page-break-inside: avoid;
    background: #fff;
  }
  .card__bar { width: 6px; flex-shrink: 0; }
  .card__body { padding: 8px 10px; flex: 1; min-width: 0; }
  .card__time { font-size: 8.5pt; color: #555; margin-bottom: 6px; }
  .card--note { border-left: 4px solid #eab308; }
  .section {
    border-left: 3px solid #ccc;
    padding: 4px 0 4px 8px;
    margin: 4px 0;
    background: #fafafa;
    border-radius: 0 3px 3px 0;
  }
  .section__title {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 8pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 2px;
  }
  .section__title .dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  }
  .section__body { font-size: 9pt; white-space: pre-wrap; }
</style>
</head>
<body>
  <section class="overview">
    <div class="header">
      <div>
        <h1>${escapeHtml(params.name)}</h1>
        <div class="muted">${escapeHtml(rangeLabel)} · ${escapeHtml(hoursLabel)}</div>
      </div>
      <div class="header__meta">
        <div><strong>${escapeHtml(company)}</strong></div>
        <div>Wygenerowano: ${escapeHtml(issued)}</div>
        <div>Planer — przegląd</div>
      </div>
    </div>
    <div class="grid-wrap">
      <div class="gutter" style="height:${gridHeight + 28}px">
        <div style="height:28px;border-bottom:1px solid #ddd;background:#f0f0ee"></div>
        <div style="position:relative;height:${gridHeight}px">${hourLines.join('')}</div>
      </div>
      ${dayColumns}
    </div>
    <div class="notes-box">
      <h2>Notatki (skrót)</h2>
      ${notesSummary}
    </div>
  </section>

  <section class="details">
    <div class="header">
      <div>
        <h1>${escapeHtml(params.name)} — szczegóły</h1>
        <div class="muted">${escapeHtml(rangeLabel)}</div>
      </div>
      <div class="header__meta">
        <div><strong>${escapeHtml(company)}</strong></div>
        <div>${escapeHtml(issued)}</div>
      </div>
    </div>
    ${detailDays}
    ${notesDetail}
  </section>
</body>
</html>`
}
