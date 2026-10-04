// Main-thread side of the renderer. Prefers the render worker (OffscreenCanvas);
// if the browser can't run WebGL2 there, the caller gets `onFallback` and creates
// a fresh <canvas> to render inline — a canvas whose control was transferred can't
// be drawn on from the main thread anymore.

import RenderWorker from '../workers/render.worker?worker&inline'
import { ExportCancelled, Renderer, frameScheduler } from './Renderer'
import type { ExportJob, FromRenderer, Scene, ToRenderer, Viewport } from './scene'

export interface RenderHostEvents {
  onFallback: () => void
  onError: (m: Extract<FromRenderer, { type: 'error' }>) => void
}

/** A running export: resolves with the PNG, rejects with `cancelled` true if stopped. */
export interface ExportHandle {
  promise: Promise<Blob>
  cancel: () => void
}

export class ExportFailed extends Error {
  constructor(readonly cancelled: boolean, detail?: string) {
    super(detail ?? (cancelled ? 'cancelled' : 'export failed'))
  }
}

let nextExportId = 1

export class RenderHost {
  private worker: Worker | null = null
  private inline: Renderer | null = null
  private sent = new Set<string>()
  private exports = new Map<number, { resolve: (b: Blob) => void; reject: (e: Error) => void; progress: (done: number, total: number) => void }>()
  readonly mode: 'worker' | 'inline'

  constructor(canvas: HTMLCanvasElement, viewport: Viewport, forceInline: boolean, private events: RenderHostEvents) {
    if (!forceInline && typeof canvas.transferControlToOffscreen === 'function') {
      try {
        const worker = new RenderWorker()
        const offscreen = canvas.transferControlToOffscreen()
        worker.onmessage = (e: MessageEvent<FromRenderer>) => this.onMessage(e.data)
        worker.onerror = () => this.events.onFallback()
        this.post({ type: 'init', canvas: offscreen, viewport }, worker, [offscreen])
        this.worker = worker
        this.mode = 'worker'
        return
      } catch {
        // The canvas may already be transferred: let the caller start over inline.
        this.mode = 'inline'
        queueMicrotask(() => this.events.onFallback())
        return
      }
    }
    this.mode = 'inline'
    let r: Renderer | null = null
    r = Renderer.create(canvas, (m) => this.onMessage(m), frameScheduler(() => r?.draw()))
    if (!r) { this.events.onError({ type: 'error', code: 'no-webgl2' }); return }
    this.inline = r
    r.setViewport(viewport)
  }

  private onMessage(m: FromRenderer) {
    if (m.type === 'error' && m.code === 'no-webgl2' && this.worker) this.events.onFallback()
    else if (m.type === 'error') this.events.onError(m)
    else if (m.type === 'export-progress') this.exports.get(m.id)?.progress(m.done, m.total)
    else if (m.type === 'export-done') { this.exports.get(m.id)?.resolve(m.blob); this.exports.delete(m.id) }
    else if (m.type === 'export-error') { this.exports.get(m.id)?.reject(new ExportFailed(m.cancelled, m.detail)); this.exports.delete(m.id) }
  }

  /** Render the job to a PNG, off the interface thread when there is a worker. */
  exportPng(job: ExportJob, onProgress: (done: number, total: number) => void): ExportHandle {
    const id = nextExportId++
    if (this.inline) {
      let stop = false
      const promise = this.inline.exportPng(job, onProgress, () => stop).catch((e) => {
        throw new ExportFailed(e instanceof ExportCancelled, String(e))
      })
      return { promise, cancel: () => { stop = true } }
    }
    const promise = new Promise<Blob>((resolve, reject) => {
      if (!this.worker) return reject(new ExportFailed(false, 'no renderer'))
      this.exports.set(id, { resolve, reject, progress: onProgress })
      this.post({ type: 'export', id, job })
    })
    return { promise, cancel: () => this.post({ type: 'export-cancel', id }) }
  }

  private post(m: ToRenderer, worker = this.worker, transfer: Transferable[] = []) {
    worker?.postMessage(m, transfer)
  }

  setViewport(viewport: Viewport) {
    if (this.inline) this.inline.setViewport(viewport)
    else this.post({ type: 'viewport', viewport })
  }

  setScene(scene: Scene) {
    if (this.inline) this.inline.setScene(scene)
    else this.post({ type: 'scene', scene })
  }

  /** Send a source image once; later scenes only reference it by id. */
  ensureAsset(id: string, blob: Blob, natural: { w: number; h: number }) {
    if (this.sent.has(id)) return
    this.sent.add(id)
    if (this.inline) this.inline.addAsset(id, blob, natural)
    else this.post({ type: 'asset', id, blob, natural })
  }

  dispose() {
    for (const e of this.exports.values()) e.reject(new ExportFailed(true))
    this.exports.clear()
    this.worker?.terminate()
    this.worker = null
    this.inline = null
  }
}
