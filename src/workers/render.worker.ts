// The render worker: owns the GPU context through an OffscreenCanvas so the
// interface thread never waits for drawing or exporting (docs/PLANNING.md §K).

import { ExportCancelled, Renderer, frameScheduler } from '../render/Renderer'
import type { FromRenderer, ToRenderer } from '../render/scene'

const post = (m: FromRenderer) => (self as unknown as Worker).postMessage(m)
let renderer: Renderer | null = null
const cancelled = new Set<number>()

self.onmessage = (e: MessageEvent<ToRenderer>) => {
  const m = e.data
  if (m.type === 'init') {
    let r: Renderer | null = null
    const schedule = frameScheduler(() => r?.draw())
    try {
      r = Renderer.create(m.canvas, post, schedule)
    } catch (err) {
      post({ type: 'error', code: 'no-webgl2', detail: String(err) })
      return
    }
    if (!r) { post({ type: 'error', code: 'no-webgl2' }); return }
    renderer = r
    renderer.setViewport(m.viewport)
    post({ type: 'ready', maxTexture: renderer.maxTexture })
    return
  }
  if (m.type === 'export-cancel') { cancelled.add(m.id); return }
  if (!renderer) return
  if (m.type === 'viewport') renderer.setViewport(m.viewport)
  else if (m.type === 'scene') renderer.setScene(m.scene)
  else if (m.type === 'asset') renderer.addAsset(m.id, m.blob, m.natural)
  else if (m.type === 'export') {
    const { id } = m
    renderer
      .exportPng(m.job, (done, total) => post({ type: 'export-progress', id, done, total }), () => cancelled.has(id))
      .then((blob) => post({ type: 'export-done', id, blob }))
      .catch((err) => post({ type: 'export-error', id, cancelled: err instanceof ExportCancelled, detail: String(err) }))
      .finally(() => cancelled.delete(id))
  }
}
