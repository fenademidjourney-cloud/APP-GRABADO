import { useEffect, useRef, type RefObject } from 'react'
import { panBy, sheetRect, zoomAt, type SheetMm, type Size, type View } from '../../render/view'
import { clampScale, transformAround } from '../../model/layerOps'
import type { Layer, LayerTransform } from '../../model/layer'

// Gestures on the canvas card (05-interaccion.md):
//   COMPONER  tap = choose a layer (empty = none) · drag = move it · two fingers on it = scale + rotate
//   both      two fingers elsewhere / Ctrl + wheel = zoom · one finger / wheel = pan when zoomed in
//             double tap = fit ↔ 100 %
// Pointer Events with capture; coordinates always from getBoundingClientRect(); a
// cancelled pointer closes the gesture without using its (possibly 0,0) coordinates.

const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_PX = 24
const MOVE_SLOP = 6

export interface LayerGesture {
  begin: () => void
  update: (id: string, transform: LayerTransform) => void
  end: () => void
}

interface Options {
  card: Size
  sheet: SheetMm
  view: View
  maxZoom: number
  setView: (v: View) => void
  onDoubleTap: (x: number, y: number) => void
  /** Only in COMPONER: layers can be picked and moved. */
  layersActive: boolean
  layers: Layer[]
  selectedId: string | null
  hitTest: (mmX: number, mmY: number) => string | null
  onSelect: (id: string | null) => void
  layerGesture: LayerGesture
}

type Pt = { x: number; y: number }

export function useCanvasGestures(ref: RefObject<HTMLElement | null>, opts: Options) {
  // Gestures read the latest values without re-binding listeners mid-gesture.
  const live = useRef(opts)
  live.current = opts

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const pointers = new Map<number, Pt>()
    let lastTap = { t: 0, x: 0, y: 0 }
    let moved = false
    let downAt: Pt = { x: 0, y: 0 }
    // The layer being handled: its transform and the pointers (in mm) when the current phase began.
    let layerDrag: { id: string; t0: LayerTransform; start: Map<number, Pt>; began: boolean } | null = null

    const local = (e: PointerEvent | WheelEvent): Pt => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const toMm = (p: Pt): Pt => {
      const { card, sheet, view } = live.current
      const r = sheetRect(card, sheet, view)
      return { x: (p.x - r.x) / r.pxPerMm, y: (p.y - r.y) / r.pxPerMm }
    }
    const isControl = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('button, input, a, label, [data-handle]')
    const layerById = (id: string) => live.current.layers.find((l) => l.id === id)

    /** (Re)start the layer gesture from the current pointers: called on down and when a finger is added or lifted. */
    const restartLayerDrag = (id: string) => {
      const l = layerById(id)
      if (!l) { layerDrag = null; return }
      const start = new Map<number, Pt>()
      pointers.forEach((p, pid) => start.set(pid, toMm(p)))
      layerDrag = { id, t0: l.transform, start, began: layerDrag?.began ?? false }
    }

    const endLayerDrag = () => {
      if (layerDrag?.began) live.current.layerGesture.end()
      layerDrag = null
    }

    const onDown = (e: PointerEvent) => {
      if (isControl(e.target)) return
      try { el.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
      const p = local(e)
      pointers.set(e.pointerId, p)
      const o = live.current
      if (pointers.size === 1) {
        moved = false
        downAt = p
        if (o.layersActive) {
          const mm = toMm(p)
          const id = o.hitTest(mm.x, mm.y)
          o.onSelect(id)
          if (id) restartLayerDrag(id)
        }
      } else if (layerDrag) {
        restartLayerDrag(layerDrag.id)
      }
    }

    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      const o = live.current
      const p = local(e)
      if (Math.hypot(p.x - downAt.x, p.y - downAt.y) > MOVE_SLOP) moved = true
      pointers.set(e.pointerId, p)

      if (layerDrag) {
        if (!moved && pointers.size === 1) return
        const l = layerById(layerDrag.id)
        if (!l) return
        if (!layerDrag.began) { layerDrag.began = true; o.layerGesture.begin() }
        const ids = [...layerDrag.start.keys()].filter((id) => pointers.has(id))
        if (ids.length >= 2) {
          const [a, b] = ids
          const a0 = layerDrag.start.get(a)!
          const b0 = layerDrag.start.get(b)!
          const a1 = toMm(pointers.get(a)!)
          const b1 = toMm(pointers.get(b)!)
          const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y)
          const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y)
          let k = d0 > 0 ? d1 / d0 : 1
          k = clampScale(l, layerDrag.t0.scale * k, o.sheet) / layerDrag.t0.scale
          const rot = ((Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x)) * 180) / Math.PI
          const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }
          const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 }
          const t = transformAround(layerDrag.t0, m0, k, rot, { x: m1.x - m0.x, y: m1.y - m0.y })
          o.layerGesture.update(layerDrag.id, { ...layerDrag.t0, ...t })
        } else if (ids.length === 1) {
          const s0 = layerDrag.start.get(ids[0])!
          const s1 = toMm(pointers.get(ids[0])!)
          o.layerGesture.update(layerDrag.id, { ...layerDrag.t0, x: layerDrag.t0.x + s1.x - s0.x, y: layerDrag.t0.y + s1.y - s0.y })
        }
        return
      }

      if (pointers.size === 1) {
        if (o.view.zoom > 1.001) o.setView(panBy(o.view, o.card, o.sheet, p.x - prev.x, p.y - prev.y))
        return
      }
      if (pointers.size === 2) {
        const [aId, bId] = [...pointers.keys()]
        const other = pointers.get(aId === e.pointerId ? bId : aId)!
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y)
        const d1 = Math.hypot(p.x - other.x, p.y - other.y)
        const m0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 }
        const m1 = { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 }
        let v = zoomAt(o.view, o.card, o.sheet, d0 > 0 ? d1 / d0 : 1, m0.x, m0.y, o.maxZoom)
        v = panBy(v, o.card, o.sheet, m1.x - m0.x, m1.y - m0.y)
        o.setView(v)
      }
    }

    const onUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      const single = pointers.size === 1
      pointers.delete(e.pointerId)
      if (layerDrag) {
        if (pointers.size === 0) endLayerDrag()
        else restartLayerDrag(layerDrag.id)
      }
      if (e.type === 'pointercancel' || !single || moved) return
      const p = local(e)
      const now = performance.now()
      if (now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < DOUBLE_TAP_PX) {
        lastTap = { t: 0, x: 0, y: 0 }
        live.current.onDoubleTap(p.x, p.y)
      } else {
        lastTap = { t: now, x: p.x, y: p.y }
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { card, sheet, view, maxZoom, setView } = live.current
      const p = local(e)
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? card.h : 1
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch arrives as ctrl + wheel with small deltas; a mouse wheel notch is ~100.
        const dy = Math.max(-60, Math.min(60, e.deltaY * unit))
        setView(zoomAt(view, card, sheet, Math.exp(-dy * 0.01), p.x, p.y, maxZoom))
      } else if (view.zoom > 1.001) {
        setView(panBy(view, card, sheet, -e.deltaX * unit, -e.deltaY * unit))
      }
    }

    // Long-press callouts, text selection and native drags would cancel the pointer mid-gesture.
    const block = (e: Event) => e.preventDefault()
    const blockTouch = (e: TouchEvent) => { if (!isControl(e.target)) e.preventDefault() }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('contextmenu', block)
    el.addEventListener('dragstart', block)
    el.addEventListener('selectstart', block)
    el.addEventListener('touchstart', blockTouch, { passive: false })
    el.addEventListener('touchmove', blockTouch, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', block)
      el.removeEventListener('dragstart', block)
      el.removeEventListener('selectstart', block)
      el.removeEventListener('touchstart', blockTouch)
      el.removeEventListener('touchmove', blockTouch)
      endLayerDrag()
    }
  }, [ref])
}
