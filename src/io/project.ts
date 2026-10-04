// Guardar / Abrir proyecto (docs/PLANNING.md §M · Fase 14): a `.imprenta` file is a
// ZIP with `project.json` (the document and what each image is) and `assets/` (the
// original bytes, plus the raster used for drawing when it differs, e.g. an SVG).
// Everything read back is untrusted: the document goes through the sanitiser and
// asset ids are checked before they become file names or keys.

import { zip, type ZipEntry } from './export/zip'
import { crc32 } from './export/pngStream'
import { sanitizeDoc } from '../model/sanitize'
import type { Doc } from '../model/doc'
import type { ImportedAsset } from './import/decode'
import type { SourceFormat } from './import/sniff'

export const PROJECT_EXT = '.imprenta'
const FORMAT = 1
const ID = /^[A-Za-z0-9_-]{1,128}$/
const FORMATS: SourceFormat[] = ['png', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'svg', 'heic', 'tiff', 'unknown']

interface AssetMeta { id: string; name: string; format: SourceFormat; natural: { w: number; h: number }; render: boolean }

export class ProjectError extends Error {}

export async function packProject(doc: Doc, assets: ImportedAsset[]): Promise<Blob> {
  const used = new Set(doc.layers.map((l) => l.assetId))
  const list = assets.filter((a) => used.has(a.id) && ID.test(a.id))
  const meta: AssetMeta[] = list.map((a) => ({ id: a.id, name: a.name, format: a.format, natural: a.natural, render: a.render !== a.blob }))
  const entries: ZipEntry[] = [{ name: 'project.json', data: new TextEncoder().encode(JSON.stringify({ format: FORMAT, app: 'taller-de-grabado', doc, assets: meta }, null, 1)) }]
  for (const a of list) {
    entries.push({ name: `assets/${a.id}`, data: new Uint8Array(await a.blob.arrayBuffer()) })
    if (a.render !== a.blob) entries.push({ name: `assets/${a.id}.render`, data: new Uint8Array(await a.render.arrayBuffer()) })
  }
  return zip(entries)
}

/** Entries of a ZIP (stored or deflated), by name. */
export async function unzip(blob: Blob): Promise<Map<string, Uint8Array>> {
  const b = new Uint8Array(await blob.arrayBuffer())
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let end = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { end = i; break }
  }
  if (end < 0) throw new ProjectError('not a zip')
  const count = v.getUint16(end + 10, true)
  let p = v.getUint32(end + 16, true)
  const out = new Map<string, Uint8Array>()
  const dec = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (p + 46 > b.length || v.getUint32(p, true) !== 0x02014b50) throw new ProjectError('bad directory')
    const method = v.getUint16(p + 10, true)
    const crc = v.getUint32(p + 16, true)
    const size = v.getUint32(p + 20, true)
    const nameLen = v.getUint16(p + 28, true)
    const extraLen = v.getUint16(p + 30, true)
    const commentLen = v.getUint16(p + 32, true)
    const local = v.getUint32(p + 42, true)
    const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    if (local + 30 > b.length || v.getUint32(local, true) !== 0x04034b50) throw new ProjectError('bad entry')
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const raw = b.subarray(start, start + size)
    let data: Uint8Array
    if (method === 0) data = raw
    else if (method === 8) data = new Uint8Array(await new Response(new Blob([raw as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())
    else throw new ProjectError('unsupported compression')
    if (crc32(data) !== crc) throw new ProjectError('damaged')
    out.set(name, data)
  }
  return out
}

const MIME: Partial<Record<SourceFormat, string>> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml', heic: 'image/heic', tiff: 'image/tiff' }

export async function unpackProject(blob: Blob): Promise<{ doc: Doc; assets: ImportedAsset[]; missing: number }> {
  const files = await unzip(blob)
  const json = files.get('project.json')
  if (!json) throw new ProjectError('no project.json')
  let raw: { format?: unknown; doc?: unknown; assets?: unknown }
  try { raw = JSON.parse(new TextDecoder().decode(json)) } catch { throw new ProjectError('bad json') }
  if (typeof raw !== 'object' || raw === null || raw.format !== FORMAT) throw new ProjectError('unknown format')
  const doc = sanitizeDoc(raw.doc)
  const assets: ImportedAsset[] = []
  for (const m of Array.isArray(raw.assets) ? raw.assets : []) {
    const a = m as Partial<AssetMeta>
    if (typeof a?.id !== 'string' || !ID.test(a.id)) continue
    const bytes = files.get(`assets/${a.id}`)
    if (!bytes) continue
    const format = FORMATS.includes(a.format as SourceFormat) ? (a.format as SourceFormat) : 'unknown'
    const w = Number(a.natural?.w)
    const h = Number(a.natural?.h)
    if (!(w >= 1 && h >= 1 && w <= 1e6 && h <= 1e6)) continue
    const type = MIME[format] ?? 'application/octet-stream'
    const original = new Blob([bytes as Uint8Array<ArrayBuffer>], { type })
    const renderBytes = a.render ? files.get(`assets/${a.id}.render`) : undefined
    const render = renderBytes ? new Blob([renderBytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }) : original
    assets.push({ id: a.id, name: typeof a.name === 'string' ? a.name.slice(0, 120) : 'Imagen', format, blob: original, render, natural: { w, h } })
  }
  const have = new Set(assets.map((a) => a.id))
  const layers = doc.layers.filter((l) => have.has(l.assetId))
  return { doc: { ...doc, layers }, assets, missing: doc.layers.length - layers.length }
}
