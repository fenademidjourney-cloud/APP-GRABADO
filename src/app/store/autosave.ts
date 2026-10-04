// Autosave (05-interaccion.md · Persistencia): the document is saved by itself, with
// no save button, half a second after the last change. It goes to IndexedDB next to
// the assets; localStorage is the fallback (without images, they don't fit there).

import { PROJECT, dbGet, dbPut } from '../../io/db'
import { loadAsset } from '../../io/assets/assetStore'
import { sanitizeDoc } from '../../model/sanitize'
import type { Doc } from '../../model/doc'

const KEY = 'current'
const LS_KEY = 'taller-de-grabado:project'
export const AUTOSAVE_MS = 500
/** Saved shape; bump when the Doc changes in a way the sanitiser can't absorb. */
const FORMAT = 1

export async function saveDoc(doc: Doc): Promise<void> {
  const payload = { format: FORMAT, savedAt: Date.now(), doc }
  if (await dbPut(PROJECT, payload, KEY)) return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload))
  } catch {
    /* nowhere to save: the work lives until the tab closes */
  }
}

/**
 * The last saved document, sanitised, with its assets loaded into memory. Layers
 * whose image can't be found are dropped (reported as `missing`).
 */
export async function restoreDoc(): Promise<{ doc: Doc; missing: number } | null> {
  let raw: unknown = (await dbGet<{ doc?: unknown }>(PROJECT, KEY))?.doc
  if (raw === undefined) {
    try {
      raw = (JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') as { doc?: unknown } | null)?.doc
    } catch {
      raw = undefined
    }
  }
  if (raw === undefined) return null
  const doc = sanitizeDoc(raw)
  const found = await Promise.all(doc.layers.map((l) => loadAsset(l.assetId)))
  const layers = doc.layers.filter((_, i) => !!found[i])
  return { doc: { ...doc, layers }, missing: doc.layers.length - layers.length }
}
