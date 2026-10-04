// Source assets, kept by id (content hash) in memory and in IndexedDB, so a reload
// restores the work. The bytes are never modified.

import type { ImportedAsset } from '../import/decode'
import type { AlphaMask } from '../../model/layerOps'
import { ASSETS, dbGet, dbPut } from '../db'

export interface AssetRecord {
  id: string
  name: string
  format: string
  natural: { w: number; h: number }
  blob: Blob
  render: Blob
  createdAt: number
}

/** Longest side of the alpha mask used to tap through transparent pixels. */
const MASK_MAX = 128

const memory = new Map<string, AssetRecord>()
const masks = new Map<string, AlphaMask>()
const maskJobs = new Set<string>()

/** Keep an asset. Resolves false if it could only be kept in memory (no IndexedDB). */
export async function putAsset(a: ImportedAsset): Promise<boolean> {
  const rec: AssetRecord = { id: a.id, name: a.name, format: a.format, natural: a.natural, blob: a.blob, render: a.render, createdAt: Date.now() }
  if (!memory.has(rec.id)) memory.set(rec.id, rec)
  return dbPut(ASSETS, rec)
}

export function getAsset(id: string): AssetRecord | undefined {
  return memory.get(id)
}

/** Bring a stored asset into memory (used when restoring a project). */
export async function loadAsset(id: string): Promise<AssetRecord | undefined> {
  const hit = memory.get(id)
  if (hit) return hit
  const rec = await dbGet<AssetRecord>(ASSETS, id)
  if (rec && rec.blob instanceof Blob && rec.render instanceof Blob) {
    memory.set(id, rec)
    return rec
  }
  return undefined
}

/** The alpha mask, if computed; asks for it otherwise (`onReady` fires once it exists). */
export function alphaMask(id: string, onReady?: () => void): AlphaMask | undefined {
  const m = masks.get(id)
  if (m || maskJobs.has(id)) return m
  const rec = memory.get(id)
  if (!rec) return undefined
  maskJobs.add(id)
  ;(async () => {
    try {
      const s = Math.min(1, MASK_MAX / Math.max(rec.natural.w, rec.natural.h))
      const w = Math.max(1, Math.round(rec.natural.w * s))
      const h = Math.max(1, Math.round(rec.natural.h * s))
      const bmp = await createImageBitmap(rec.render, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' })
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(bmp, 0, 0)
      bmp.close()
      const px = ctx.getImageData(0, 0, w, h).data
      const data = new Uint8Array(w * h)
      for (let i = 0; i < data.length; i++) data[i] = px[i * 4 + 3]
      masks.set(id, { w, h, data })
      onReady?.()
    } catch {
      /* without a mask the whole rectangle is tappable */
    }
  })()
  return undefined
}
