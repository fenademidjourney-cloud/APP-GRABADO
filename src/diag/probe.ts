// Phase 00 spike: does the single-HTML delivery (file://) support everything the
// plan relies on? Open the app with #diag to see the report. Results are recorded in
// docs/PLANNING.md ("Decisiones tomadas").

import ProbeWorker from './probe.worker?worker&inline'
import type { WorkerProbe } from './probe.worker'

export interface ProbeResult {
  id: string
  label: string
  ok: boolean
  detail?: string
}

function idbRoundTrip(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('sin indexedDB'))
    const req = indexedDB.open('taller-de-grabado:probe', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('k')
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const blob = new Blob([new Uint8Array(1024 * 1024)])
      const tx = db.transaction('k', 'readwrite')
      tx.objectStore('k').put(blob, 'blob')
      tx.oncomplete = () => {
        const get = db.transaction('k').objectStore('k').get('blob')
        get.onsuccess = () => {
          db.close()
          resolve(`blob de ${(get.result as Blob).size / 1024 / 1024} MB guardado y leído`)
        }
        get.onerror = () => reject(get.error)
      }
      tx.onerror = () => reject(tx.error)
    }
  })
}

function workerProbe(): Promise<WorkerProbe> {
  return new Promise((resolve, reject) => {
    let w: Worker
    try {
      w = new ProbeWorker()
    } catch (e) {
      return reject(e)
    }
    const timer = setTimeout(() => { w.terminate(); reject(new Error('el worker no respondió')) }, 4000)
    w.onmessage = (e: MessageEvent<WorkerProbe>) => { clearTimeout(timer); w.terminate(); resolve(e.data) }
    w.onerror = (e) => { clearTimeout(timer); w.terminate(); reject(new Error(e.message || 'error del worker')) }
    w.postMessage(null)
  })
}

export async function runProbe(): Promise<ProbeResult[]> {
  const r: ProbeResult[] = []
  r.push({ id: 'protocol', label: 'Protocolo', ok: true, detail: location.protocol })
  r.push({ id: 'secure', label: 'Contexto seguro', ok: window.isSecureContext })

  const canvas = document.createElement('canvas')
  r.push({ id: 'transfer', label: 'transferControlToOffscreen', ok: 'transferControlToOffscreen' in canvas })
  const gl = canvas.getContext('webgl2')
  r.push({ id: 'webgl2-main', label: 'WebGL2 (hilo principal)', ok: !!gl, detail: gl ? `textura máx. ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}` : undefined })

  try {
    const w = await workerProbe()
    r.push({ id: 'worker', label: 'Worker inline', ok: true })
    r.push({ id: 'webgl2-worker', label: 'WebGL2 en worker (OffscreenCanvas)', ok: w.webgl2, detail: w.webgl2 ? `textura máx. ${w.maxTexture} · ${w.renderer ?? ''}` : w.error })
    r.push({ id: 'float', label: 'Render a float / half-float', ok: !!w.halfFloatTargets, detail: w.floatTargets ? 'RGBA32F y RGBA16F' : w.halfFloatTargets ? 'solo RGBA16F' : undefined })
    r.push({ id: 'highp', label: 'highp en fragment shader', ok: !!w.highpFloat })
    r.push({ id: 'compression-worker', label: 'CompressionStream en worker', ok: w.compression })
  } catch (e) {
    r.push({ id: 'worker', label: 'Worker inline', ok: false, detail: String(e) })
  }

  try {
    r.push({ id: 'idb', label: 'IndexedDB', ok: true, detail: await idbRoundTrip() })
  } catch (e) {
    r.push({ id: 'idb', label: 'IndexedDB', ok: false, detail: String(e) })
  }

  let ls = false
  try { localStorage.setItem('taller-de-grabado:probe', '1'); ls = localStorage.getItem('taller-de-grabado:probe') === '1'; localStorage.removeItem('taller-de-grabado:probe') } catch { ls = false }
  r.push({ id: 'ls', label: 'localStorage', ok: ls })

  r.push({ id: 'clip-read', label: 'navigator.clipboard.read', ok: typeof navigator.clipboard?.read === 'function' })
  r.push({ id: 'compression', label: 'CompressionStream', ok: typeof CompressionStream !== 'undefined' })
  r.push({ id: 'bitmap', label: 'createImageBitmap', ok: typeof createImageBitmap === 'function' })
  r.push({ id: 'share', label: 'navigator.share (archivos)', ok: typeof navigator.canShare === 'function' })
  return r
}
