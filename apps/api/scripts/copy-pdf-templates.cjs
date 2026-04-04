/* Copies HTML templates next to compiled PDF module so production (dist-only) finds them. */
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'src', 'modules', 'pdf', 'templates')
const dest = path.join(__dirname, '..', 'dist', 'modules', 'pdf', 'templates')

if (!fs.existsSync(src)) {
  console.error('[copy-pdf-templates] Brak katalogu źródłowego:', src)
  process.exit(1)
}
fs.mkdirSync(dest, { recursive: true })
fs.cpSync(src, dest, { recursive: true })
console.log('[copy-pdf-templates] OK →', dest)
