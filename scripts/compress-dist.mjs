import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { brotliCompress, constants, gzip } from 'node:zlib'

const brotli = promisify(brotliCompress)
const gzipAsync = promisify(gzip)
const DIST = path.resolve(process.cwd(), 'dist')
const COMPRESSIBLE = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg', '.txt', '.webmanifest'])
const MIN_BYTES = 1024

async function filesUnder(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(file) : [file]
  }))
  return nested.flat()
}

const files = (await filesUnder(DIST)).filter((file) =>
  COMPRESSIBLE.has(path.extname(file).toLowerCase()) && !file.endsWith('.br') && !file.endsWith('.gz'),
)

let sourceBytes = 0
let brotliBytes = 0
let gzipBytes = 0
let compressedFiles = 0

await Promise.all(files.map(async (file) => {
  const info = await stat(file)
  if (info.size < MIN_BYTES) return
  const input = await readFile(file)
  const [br, gz] = await Promise.all([
    brotli(input, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      },
    }),
    gzipAsync(input, { level: 9 }),
  ])
  await Promise.all([writeFile(`${file}.br`, br), writeFile(`${file}.gz`, gz)])
  sourceBytes += input.length
  brotliBytes += br.length
  gzipBytes += gz.length
  compressedFiles++
}))

const kb = (bytes) => (bytes / 1024).toFixed(1)
console.log(
  `[compress] ${compressedFiles} files: ${kb(sourceBytes)} KiB source, ` +
  `${kb(brotliBytes)} KiB br, ${kb(gzipBytes)} KiB gzip`,
)
