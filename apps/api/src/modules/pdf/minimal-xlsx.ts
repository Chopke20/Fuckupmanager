/**
 * Minimalny zapis .xlsx (OOXML) bez zewnętrznych bibliotek.
 * Formuły w XML są po angielsku (IF/SUMIF/ROUND) — Excel PL je przelicza.
 */
import { deflateRawSync } from 'zlib'

export type XlCell =
  | { t: 's'; v: string; s?: number }
  | { t: 'n'; v: number; s?: number }
  | { t: 'f'; f: string; v?: number; s?: number }
  | { t: 'empty'; s?: number }

export type XlColWidth = { min: number; max: number; width: number }

export type DefinedName = { name: string; ref: string }

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(n: number): Buffer {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n & 0xffff, 0)
  return b
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0, 0)
  return b
}

function zipDeflate(files: Array<{ path: string; body: string }>): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.path.replace(/\\/g, '/'), 'utf8')
    const data = Buffer.from(file.body, 'utf8')
    const compressed = deflateRawSync(data)
    const crc = crc32(data)
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      compressed,
    ])
    locals.push(local)
    centrals.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(8),
        u16(0),
        u16(0),
        u32(crc),
        u32(compressed.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    )
    offset += local.length
  }
  const centralDir = Buffer.concat(centrals)
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])
  return Buffer.concat([...locals, centralDir, eocd])
}

export function colLetter(col: number): string {
  let n = col
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function cellRef(col: number, row: number): string {
  return `${colLetter(col)}${row}`
}

function xmlEscape(s: string): string {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formulaXmlEscape(s: string): string {
  return xmlEscape(s).replace(/'/g, '&apos;')
}

export class SheetGrid {
  private cells = new Map<string, XlCell>()
  merges: string[] = []
  colWidths: XlColWidth[] = []
  autoFilter: string | null = null
  freezeRows = 0
  lastRow = 1
  lastCol = 1

  set(row: number, col: number, cell: XlCell) {
    this.cells.set(cellRef(col, row), cell)
    if (row > this.lastRow) this.lastRow = row
    if (col > this.lastCol) this.lastCol = col
  }

  merge(r1: number, c1: number, r2: number, c2: number) {
    this.merges.push(`${cellRef(c1, r1)}:${cellRef(c2, r2)}`)
  }

  toSheetXml(): string {
    const byRow = new Map<number, Array<{ col: number; cell: XlCell }>>()
    for (const [ref, cell] of this.cells) {
      const m = /^([A-Z]+)(\d+)$/.exec(ref)
      if (!m) continue
      const row = Number(m[2])
      const col = colLetterToNum(m[1]!)
      const list = byRow.get(row) ?? []
      list.push({ col, cell })
      byRow.set(row, list)
    }
    const rowNums = [...byRow.keys()].sort((a, b) => a - b)
    const rowXml = rowNums
      .map((r) => {
        const cells = (byRow.get(r) ?? []).sort((a, b) => a.col - b.col)
        const cellXml = cells.map(({ col, cell }) => serializeCell(col, r, cell)).join('')
        return `<row r="${r}">${cellXml}</row>`
      })
      .join('')

    const colsXml =
      this.colWidths.length === 0
        ? ''
        : `<cols>${this.colWidths
            .map((c) => `<col min="${c.min}" max="${c.max}" width="${c.width}" customWidth="1"/>`)
            .join('')}</cols>`

    const mergeXml =
      this.merges.length === 0
        ? ''
        : `<mergeCells count="${this.merges.length}">${this.merges
            .map((ref) => `<mergeCell ref="${ref}"/>`)
            .join('')}</mergeCells>`

    const autoFilterXml = this.autoFilter ? `<autoFilter ref="${this.autoFilter}"/>` : ''
    const dim = `A1:${cellRef(this.lastCol, this.lastRow)}`
    const freezeXml =
      this.freezeRows > 0
        ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${this.freezeRows}" topLeftCell="A${this.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
        : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="${dim}"/>
  ${freezeXml}
  <sheetFormatPr defaultRowHeight="15"/>
  ${colsXml}
  <sheetData>${rowXml}</sheetData>
  ${autoFilterXml}
  ${mergeXml}
  <pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`
  }
}

function colLetterToNum(letters: string): number {
  let n = 0
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64)
  }
  return n
}

function serializeCell(col: number, row: number, cell: XlCell): string {
  const r = cellRef(col, row)
  const sAttr = cell.s != null ? ` s="${cell.s}"` : ''
  if (cell.t === 'empty') return `<c r="${r}"${sAttr}/>`
  if (cell.t === 's') {
    return `<c r="${r}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.v)}</t></is></c>`
  }
  if (cell.t === 'n') {
    return `<c r="${r}"${sAttr} t="n"><v>${formatNum(cell.v)}</v></c>`
  }
  const v = cell.v != null ? `<v>${formatNum(cell.v)}</v>` : ''
  return `<c r="${r}"${sAttr} t="n"><f>${formulaXmlEscape(cell.f)}</f>${v}</c>`
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n * 10000) / 10000)
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="16"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF111827"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF3C4"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="3" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`

/** Style IDs used by the offer workbook. */
export const XlStyle = {
  default: 0,
  title: 1,
  header: 2,
  money: 3,
  moneyTotal: 4,
  moneyInput: 5,
  input: 6,
  section: 7,
  wrap: 8,
  bold: 9,
} as const

export function buildXlsxBuffer(sheet: SheetGrid, sheetName: string, names: DefinedName[]): Buffer {
  const safeName = sheetName.replace(/[\\/*?:\[\]]/g, ' ').slice(0, 31) || 'Oferta'
  const definedXml =
    names.length === 0
      ? ''
      : `<definedNames>${names
          .map((n) => `<definedName name="${xmlEscape(n.name)}">${xmlEscape(n.ref)}</definedName>`)
          .join('')}</definedNames>`

  const files = [
    {
      path: '[Content_Types].xml',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      path: '_rels/.rels',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      path: 'xl/workbook.xml',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${xmlEscape(safeName)}" sheetId="1" r:id="rId1"/>
  </sheets>
  ${definedXml}
  <calcPr calcId="0" fullCalcOnLoad="1"/>
</workbook>`,
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { path: 'xl/styles.xml', body: STYLES_XML },
    { path: 'xl/worksheets/sheet1.xml', body: sheet.toSheetXml() },
  ]
  return zipDeflate(files)
}
