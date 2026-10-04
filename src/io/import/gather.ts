// Collects candidate images from a drop, a paste, or the clipboard button.
// Files come first; if there are none (an image dragged from another web page),
// the image URL is tried — it may be blocked by the other site (CORS).

import { ImportError } from './decode'
import { looksLikeImage } from './sniff'

export interface Candidate { blob: Blob; name: string }

/** `rejected`: files that were dropped or pasted but aren't images (a PDF, a text file…). */
export interface Gathered { files: Candidate[]; urls: string[]; rejected: number }

function urlsFromTransfer(dt: DataTransfer): string[] {
  const out: string[] = []
  const html = dt.getData('text/html')
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('img[src]').forEach((img) => out.push((img as HTMLImageElement).getAttribute('src')!))
  }
  const list = dt.getData('text/uri-list')
  if (list) list.split(/\r?\n/).filter((l) => l && !l.startsWith('#')).forEach((u) => out.push(u))
  return [...new Set(out)].filter((u) => /^(https?:|data:image\/|blob:)/i.test(u))
}

export function gatherFromTransfer(dt: DataTransfer): Gathered {
  const files: Candidate[] = []
  let rejected = 0
  const all = Array.from(dt.items ?? []).filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter((f): f is File => !!f)
  for (const f of all.length ? all : Array.from(dt.files ?? [])) {
    if (looksLikeImage(f.type, f.name)) files.push({ blob: f, name: f.name })
    else rejected++
  }
  return { files, urls: files.length ? [] : urlsFromTransfer(dt), rejected }
}

/** Does this drag carry something we could import? (Checked on dragenter, before the data is readable.) */
export function transferMayHoldImage(dt: DataTransfer | null): boolean {
  if (!dt) return false
  const types = Array.from(dt.types)
  return types.includes('Files') || types.includes('text/uri-list') || types.includes('text/html')
}

export async function fetchImageUrl(url: string): Promise<Candidate> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    const name = decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() ?? '')
    return { blob, name: url.startsWith('data:') ? '' : name }
  } catch (e) {
    throw new ImportError('remote', String(e))
  }
}

export function clipboardButtonAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function'
}

/** The "Pegar" button: read images from the system clipboard (asks for permission). */
export async function readClipboardImages(): Promise<Candidate[]> {
  const items = await navigator.clipboard.read()
  const out: Candidate[] = []
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (type) out.push({ blob: await item.getType(type), name: '' })
  }
  if (!out.length) throw new ImportError('clipboard-empty')
  return out
}
