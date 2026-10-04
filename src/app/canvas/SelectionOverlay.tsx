import type { PointerEvent as ReactPointerEvent } from 'react'
import { t } from '../../i18n'
import type { Layer, LayerTransform } from '../../model/layer'
import { layerQuad } from '../../model/layer'
import { clampScale, cropToPoint, resetCrop, transformAround, type CropEdge } from '../../model/layerOps'
import type { Rect } from '../../render/view'

// The selection drawn over the canvas (accent colour: 01-principios.md §4). It lives
// in the DOM on the main thread so it follows the finger with no render latency.
//   Mover / Capas: corners scale around the centre, the knob above rotates (snaps to 0/90/180°).
//   Recortar:      the four edges crop; the dashed outline is the whole picture.
// Each handle has a 44 px invisible hit area (--touch).

const HIT_R = 22
const KNOB_OFFSET = 26
const SNAP_DEG = 4

type Pt = { x: number; y: number }

export interface HandleGesture {
  begin: () => void
  update: (patch: Pick<Layer, 'transform'> & Partial<Pick<Layer, 'crop'>>) => void
  end: () => void
}

function snapAngle(deg: number): number {
  for (const a of [-180, -90, 0, 90, 180]) if (Math.abs(deg - a) < SNAP_DEG) return a === -180 ? 180 : a
  return deg
}

export function SelectionOverlay({ layer, rect, mode, sheet, gesture }: {
  layer: Layer
  rect: Rect
  mode: 'transform' | 'crop'
  sheet: { widthMm: number; heightMm: number }
  gesture: HandleGesture
}) {
  const toPx = ([x, y]: [number, number]): Pt => ({ x: rect.x + x * rect.pxPerMm, y: rect.y + y * rect.pxPerMm })
  const corners = layerQuad(layer).corners.map(toPx)
  const centre = toPx([layer.transform.x, layer.transform.y])
  const poly = corners.map((c) => `${c.x},${c.y}`).join(' ')

  /** Drag helper: converts pointer positions to sheet mm and closes the gesture on up / cancel. */
  const drag = (e: ReactPointerEvent, onMoveMm: (mm: Pt, startMm: Pt) => void) => {
    e.preventDefault()
    e.stopPropagation()
    const svg = (e.currentTarget as SVGElement).ownerSVGElement ?? (e.currentTarget as SVGSVGElement)
    const box = () => svg.getBoundingClientRect()
    const toMm = (cx: number, cy: number): Pt => {
      const b = box()
      return { x: (cx - b.left - rect.x) / rect.pxPerMm, y: (cy - b.top - rect.y) / rect.pxPerMm }
    }
    const id = e.pointerId
    const startMm = toMm(e.clientX, e.clientY)
    let began = false
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return
      if (!began) { began = true; gesture.begin() }
      onMoveMm(toMm(ev.clientX, ev.clientY), startMm)
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (began) gesture.end()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const t0: LayerTransform = layer.transform
  const c0 = { x: t0.x, y: t0.y }

  const onScale = (e: ReactPointerEvent) =>
    drag(e, (mm, start) => {
      const d0 = Math.hypot(start.x - c0.x, start.y - c0.y)
      const d1 = Math.hypot(mm.x - c0.x, mm.y - c0.y)
      const k = clampScale(layer, t0.scale * (d0 > 0 ? d1 / d0 : 1), sheet) / t0.scale
      gesture.update({ transform: { ...t0, ...transformAround(t0, c0, k, 0, { x: 0, y: 0 }) } })
    })

  const onRotate = (e: ReactPointerEvent) =>
    drag(e, (mm, start) => {
      const a0 = Math.atan2(start.y - c0.y, start.x - c0.x)
      const a1 = Math.atan2(mm.y - c0.y, mm.x - c0.x)
      const raw = t0.rotation + ((a1 - a0) * 180) / Math.PI
      const target = snapAngle(((((raw + 180) % 360) + 360) % 360) - 180)
      gesture.update({ transform: { ...t0, rotation: target } })
    })

  const onCrop = (edge: CropEdge) => (e: ReactPointerEvent) => drag(e, (mm) => gesture.update(cropToPoint(layer, edge, mm)))

  // Rotation knob: above the middle of the top edge, along the layer's own "up".
  const topMid = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 }
  const upLen = Math.hypot(topMid.x - centre.x, topMid.y - centre.y) || 1
  const knob = { x: topMid.x + ((topMid.x - centre.x) / upLen) * KNOB_OFFSET, y: topMid.y + ((topMid.y - centre.y) / upLen) * KNOB_OFFSET }

  const edges: Array<{ edge: CropEdge; a: Pt; b: Pt }> = [
    { edge: 't', a: corners[0], b: corners[1] },
    { edge: 'r', a: corners[1], b: corners[2] },
    { edge: 'b', a: corners[2], b: corners[3] },
    { edge: 'l', a: corners[3], b: corners[0] },
  ]
  const full = mode === 'crop' ? layerQuad(resetCrop(layer)).corners.map(toPx) : null

  return (
    <svg className="selection" aria-hidden="true">
      {full && <polygon className="sel-ghost" points={full.map((c) => `${c.x},${c.y}`).join(' ')} />}
      <polygon className="sel-outline" points={poly} />
      {mode === 'transform' && (
        <>
          <line className="sel-outline" x1={topMid.x} y1={topMid.y} x2={knob.x} y2={knob.y} />
          <g data-handle className="sel-handle" onPointerDown={onRotate}>
            <title>{t('compose.rotateHandle')}</title>
            <circle className="sel-hit" cx={knob.x} cy={knob.y} r={HIT_R} />
            <circle className="sel-knob" cx={knob.x} cy={knob.y} r={6} />
          </g>
          {corners.map((c, i) => (
            <g key={i} data-handle className="sel-handle" onPointerDown={onScale}>
              <title>{t('compose.scaleHandle')}</title>
              <circle className="sel-hit" cx={c.x} cy={c.y} r={HIT_R} />
              <rect className="sel-corner" x={c.x - 5} y={c.y - 5} width={10} height={10} />
            </g>
          ))}
        </>
      )}
      {mode === 'crop' && edges.map(({ edge, a, b }) => {
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
        const half = Math.min(14, len / 3)
        return (
          <g key={edge} data-handle className="sel-handle" onPointerDown={onCrop(edge)}>
            <title>{t('compose.cropHandle')}</title>
            <circle className="sel-hit" cx={m.x} cy={m.y} r={HIT_R} />
            <line className="sel-crop" x1={m.x - u.x * half} y1={m.y - u.y * half} x2={m.x + u.x * half} y2={m.y + u.y * half} />
          </g>
        )
      })}
    </svg>
  )
}
