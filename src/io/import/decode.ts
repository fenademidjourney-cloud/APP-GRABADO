// Turns a dropped / pasted / chosen file into an asset: validated, measured, hashed.
// The original bytes are kept untouched; SVGs also get a raster for the renderer
// (re-rasterising at export scale arrives in v1.1, docs/PLANNING.md §I).

import { hashBytes } from './hash'
import { formatFromHints, sniffBytes, type SourceFormat } from './sniff'

/** Long side of the raster made from an SVG. */
export const SVG_RASTER_MAX = 4096

export type ImportErrorCode = 'not-image' | 'heic' | 'tiff' | 'decode' | 'remote' | 'clipboard-empty'

export class ImportError extends Error {
  constructor(readonly code: ImportErrorCode, detail?: string) {
    super(detail ?? code)
  }
}

export interface ImportedAsset {
  id: string
  name: string
  format: SourceFormat
  blob: Blob            // the original file
  render: Blob          // what the renderer decodes (the original, or the SVG raster)
  natural: { w: number; h: number }
}

export function baseName(name: string, fallback: string): string {
  const clean = name.replace(/\.[a-z0-9]{2,5}$/i, '').trim()
  return clean || fallback
}

function svgSizeFromText(text: string): { w: number; h: number } | null {
  try {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement
    const w = parseFloat(svg.getAttribute('width') ?? '')
    const h = parseFloat(svg.getAttribute('height') ?? '')
    if (w > 0 && h > 0) return { w, h }
    const vb = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { w: vb[2], h: vb[3] }
  } catch {
    /* not parseable: the caller uses a default */
  }
  return null
}

async function rasteriseSvg(text: string): Promise<{ blob: Blob; natural: { w: number; h: number } }> {
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const size = (img.naturalWidth > 0 && img.naturalHeight > 0 ? { w: img.naturalWidth, h: img.naturalHeight } : null) ?? svgSizeFromText(text) ?? { w: 1024, h: 1024 }
    const s = SVG_RASTER_MAX / Math.max(size.w, size.h)
    const w = Math.max(1, Math.round(size.w * s))
    const h = Math.max(1, Math.round(size.h * s))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) throw new ImportError('decode', 'svg raster')
    return { blob, natural: { w, h } }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function importBlob(blob: Blob, name: string, fallbackName: string): Promise<ImportedAsset> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let format = sniffBytes(bytes)
  if (format === 'unknown') format = formatFromHints(blob.type, name)
  if (format === 'unknown' && !blob.type.startsWith('image/')) throw new ImportError('not-image')
  const id = await hashBytes(bytes)
  const displayName = baseName(name, fallbackName)

  if (format === 'svg') {
    const text = new TextDecoder().decode(bytes)
    const { blob: render, natural } = await rasteriseSvg(text)
    return { id, name: displayName, format, blob, render, natural }
  }

  try {
    const bitmap = await createImageBitmap(blob)
    const natural = { w: bitmap.width, h: bitmap.height }
    bitmap.close()
    return { id, name: displayName, format, blob, render: blob, natural }
  } catch (e) {
    if (format === 'heic') throw new ImportError('heic')
    if (format === 'tiff') throw new ImportError('tiff')
    throw new ImportError('decode', String(e))
  }
}
