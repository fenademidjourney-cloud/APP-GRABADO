// Pure operations on layers: every function returns new objects (the undo history
// keeps the old ones). Geometry is in millimetres of the sheet; angles in degrees.

import { fitLayerTransform, layerQuad, newLayerId, type Layer, type LayerCrop, type LayerTransform } from './layer'

type Sheet = { widthMm: number; heightMm: number }
type Pt = { x: number; y: number }

/** Smallest visible side a crop or a scale may leave, in mm. */
export const MIN_SIDE_MM = 2
/** Largest side relative to the sheet's longest side. */
export const MAX_SIDE_FACTOR = 6

const rad = (deg: number) => (deg * Math.PI) / 180

/** Visible (cropped) size of a layer on the sheet, mm. */
export function visibleSize(l: Pick<Layer, 'natural' | 'transform' | 'crop'>): { w: number; h: number } {
  return {
    w: l.natural.w * (1 - l.crop.l - l.crop.r) * l.transform.scale,
    h: l.natural.h * (1 - l.crop.t - l.crop.b) * l.transform.scale,
  }
}

/** A sheet point expressed in the layer's own axes (origin at its centre, before flip). */
export function toLocal(t: LayerTransform, p: Pt): Pt {
  const a = rad(-t.rotation)
  const dx = p.x - t.x
  const dy = p.y - t.y
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) }
}

function fromLocalVector(t: LayerTransform, v: Pt): Pt {
  const a = rad(t.rotation)
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) }
}

export function clampScale(l: Pick<Layer, 'natural' | 'crop'>, scale: number, sheet: Sheet): number {
  const w = l.natural.w * (1 - l.crop.l - l.crop.r)
  const h = l.natural.h * (1 - l.crop.t - l.crop.b)
  const min = MIN_SIDE_MM / Math.max(1e-9, Math.min(w, h))
  const max = (Math.max(sheet.widthMm, sheet.heightMm) * MAX_SIDE_FACTOR) / Math.max(1e-9, Math.max(w, h))
  return Math.max(min, Math.min(max, scale))
}

export function normaliseAngle(deg: number): number {
  const a = ((deg % 360) + 360) % 360
  return a > 180 ? a - 360 : a
}

/**
 * Two-finger / handle transform: starting from `t0`, scale by `k` and rotate by `dRot`
 * around the sheet point `pivot`, then translate by `move`.
 */
export function transformAround(t0: LayerTransform, pivot: Pt, k: number, dRot: number, move: Pt): Omit<LayerTransform, 'flipX'> {
  const a = rad(dRot)
  const dx = t0.x - pivot.x
  const dy = t0.y - pivot.y
  return {
    x: pivot.x + (dx * Math.cos(a) - dy * Math.sin(a)) * k + move.x,
    y: pivot.y + (dx * Math.sin(a) + dy * Math.cos(a)) * k + move.y,
    scale: t0.scale * k,
    rotation: normaliseAngle(t0.rotation + dRot),
  }
}

export type CropEdge = 'l' | 't' | 'r' | 'b'

/**
 * Drag one visible edge of the layer to the sheet point `p`. The opposite edge stays
 * where it is on the sheet, so the picture doesn't move while you crop.
 * Flip mirrors which side of the source each visible edge cuts.
 */
export function cropToPoint(l: Pick<Layer, 'natural' | 'transform' | 'crop'>, edge: CropEdge, p: Pt): { crop: LayerCrop; transform: LayerTransform } {
  const t = l.transform
  const local = toLocal(t, p)
  const { w, h } = visibleSize(l)
  const fullW = l.natural.w * t.scale
  const fullH = l.natural.h * t.scale
  const crop = { ...l.crop }
  let shift: Pt = { x: 0, y: 0 }
  // Source inset that the visible left / right edge controls (swapped when flipped).
  const leftKey: 'l' | 'r' = t.flipX ? 'r' : 'l'
  const rightKey: 'l' | 'r' = t.flipX ? 'l' : 'r'
  if (edge === 'l' || edge === 'r') {
    const fixed = edge === 'l' ? w / 2 : -w / 2
    const key = edge === 'l' ? leftKey : rightKey
    const otherInset = edge === 'l' ? crop[rightKey] : crop[leftKey]
    const maxW = fullW * (1 - otherInset)
    let newW = Math.abs(fixed - local.x)
    newW = Math.max(Math.min(MIN_SIDE_MM, maxW), Math.min(maxW, newW))
    crop[key] = Math.max(0, 1 - otherInset - newW / fullW)
    shift = { x: edge === 'l' ? fixed - newW / 2 : fixed + newW / 2, y: 0 }
  } else {
    const fixed = edge === 't' ? h / 2 : -h / 2
    const other = edge === 't' ? crop.b : crop.t
    const maxH = fullH * (1 - other)
    let newH = Math.abs(fixed - local.y)
    newH = Math.max(Math.min(MIN_SIDE_MM, maxH), Math.min(maxH, newH))
    crop[edge] = Math.max(0, 1 - other - newH / fullH)
    shift = { x: 0, y: edge === 't' ? fixed - newH / 2 : fixed + newH / 2 }
  }
  const d = fromLocalVector(t, shift)
  return { crop, transform: { ...t, x: t.x + d.x, y: t.y + d.y } }
}

/** Remove the crop keeping the visible part where it is. */
export function resetCrop(l: Layer): Layer {
  const c = l.crop
  // Centre offset of the cropped window inside the full picture, in local mm.
  const sx = l.transform.flipX ? -1 : 1
  const off = { x: sx * ((c.l - c.r) / 2) * l.natural.w * l.transform.scale, y: ((c.t - c.b) / 2) * l.natural.h * l.transform.scale }
  const d = fromLocalVector(l.transform, off)
  return { ...l, crop: { l: 0, t: 0, r: 0, b: 0 }, transform: { ...l.transform, x: l.transform.x - d.x, y: l.transform.y - d.y } }
}

/** Fit (contain) or cover the sheet, centred and upright. */
export function fitToSheet(l: Layer, sheet: Sheet, mode: 'contain' | 'cover'): Layer {
  const w = l.natural.w * (1 - l.crop.l - l.crop.r)
  const h = l.natural.h * (1 - l.crop.t - l.crop.b)
  const scale = mode === 'contain' ? Math.min(sheet.widthMm / w, sheet.heightMm / h) : Math.max(sheet.widthMm / w, sheet.heightMm / h)
  return { ...l, transform: { ...l.transform, x: sheet.widthMm / 2, y: sheet.heightMm / 2, scale, rotation: 0 } }
}

export function duplicateLayer(l: Layer, offsetMm = 5): Layer {
  return { ...l, id: newLayerId(), transform: { ...l.transform, x: l.transform.x + offsetMm, y: l.transform.y + offsetMm } }
}

/** Move a layer one step up (+1, towards the viewer) or down (-1). */
export function reorder(layers: Layer[], id: string, dir: 1 | -1): Layer[] {
  const i = layers.findIndex((l) => l.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= layers.length) return layers
  const next = [...layers]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function updateLayer(layers: Layer[], id: string, fn: (l: Layer) => Layer): Layer[] {
  return layers.map((l) => (l.id === id ? fn(l) : l))
}

/** An alpha mask of the source, small (≤ 128 px): enough to tap through transparent parts. */
export interface AlphaMask { w: number; h: number; data: Uint8Array }

/**
 * Which layer is under the sheet point `p`? Topmost first; hidden and locked layers
 * are skipped; transparent pixels let the tap through when a mask is known.
 */
export function hitTest(layers: Layer[], p: Pt, mask: (assetId: string) => AlphaMask | undefined): string | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]
    if (!l.visible || l.locked) continue
    const local = toLocal(l.transform, p)
    const { w, h } = visibleSize(l)
    if (Math.abs(local.x) > w / 2 || Math.abs(local.y) > h / 2) continue
    const m = mask(l.assetId)
    if (!m) return l.id
    let fx = local.x / w + 0.5
    if (l.transform.flipX) fx = 1 - fx
    const u = l.crop.l + fx * (1 - l.crop.l - l.crop.r)
    const v = l.crop.t + (local.y / h + 0.5) * (1 - l.crop.t - l.crop.b)
    const mx = Math.min(m.w - 1, Math.max(0, Math.floor(u * m.w)))
    const my = Math.min(m.h - 1, Math.max(0, Math.floor(v * m.h)))
    if (m.data[my * m.w + mx] > 16) return l.id
  }
  return null
}

export { fitLayerTransform, layerQuad }
