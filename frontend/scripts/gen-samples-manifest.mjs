import { readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const samplesDir = join(dirname(fileURLToPath(import.meta.url)), '../public/samples')

const files = readdirSync(samplesDir, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name !== 'manifest.json')
  .map((e) => e.name)
  .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))

const manifest = files.map((file) => ({ name: file, file }))

writeFileSync(
  join(samplesDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8'
)

console.log(`manifest.json: ${manifest.length} entries`)
