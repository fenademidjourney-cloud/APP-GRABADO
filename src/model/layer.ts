// A layer places one source asset on the sheet. Everything is in millimetres of the
// document; the source pixels are never modified (docs/PLANNING.md §F).

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'darken' | 'lighten'

export interface LayerTransform {
  x: number         // centre, mm from the sheet's left edge
  y: number         // centre, mm from the sheet's top edge
  scale: number     // mm per source pixel
  rotation: number  // degrees, clockwise
  flipX: boolean
}

/** Insets removed from each side, as fractions of the source (0 = no crop). */
export interface LayerCrop { l: number; t: number; r: number; b: number }

export interface Layer {
  id: string
  assetId: string
  name: string
  natural: { w: number; h: number }   // source size in px (layout never needs to decode)
  visible: boolean
  locked: boolean
  opacity: number
  blend: BlendMode
  transform: LayerTransform
  crop: LayerCrop
  inkTarget: 'auto' | string          // 'auto' = enters the colour separation; otherwise that ink's plate
  tone: { invert: boolean }
}

/** Share of the sheet a new layer fills (contain), leaving a margin around it. */
const FIT_SHARE = 0.88
/** New layers cascade so that pasting twice doesn't hide the first one. */
const CASCADE_MM = 8

export function fitLayerTransform(natural: { w: number; h: number }, sheet: { widthMm: number; heightMm: number }, index = 0): LayerTransform {
  const scale = Math.min((sheet.widthMm * FIT_SHARE) / natural.w, (sheet.heightMm * FIT_SHARE) / natural.h)
  const step = (index % 5) * CASCADE_MM
  return { x: sheet.widthMm / 2 + step, y: sheet.heightMm / 2 + step, scale, rotation: 0, flipX: false }
}

export function newLayerId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export function createLayer(assetId: string, name: string, natural: { w: number; h: number }, sheet: { widthMm: number; heightMm: number }, index: number): Layer {
  return {
    id: newLayerId(),
    assetId,
    name,
    natural,
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    transform: fitLayerTransform(natural, sheet, index),
    crop: { l: 0, t: 0, r: 0, b: 0 },
    inkTarget: 'auto',
    tone: { invert: false },
  }
}

/**
 * The layer's four corners on the sheet (mm), in the order TL, TR, BR, BL of the
 * cropped source, plus the matching texture coordinates (flip included).
 */
export function layerQuad(layer: Pick<Layer, 'natural' | 'transform' | 'crop'>): { corners: [number, number][]; uvs: [number, number][] } {
  const { natural: n, transform: tr, crop: c } = layer
  const w = n.w * (1 - c.l - c.r) * tr.scale
  const h = n.h * (1 - c.t - c.b) * tr.scale
  const a = (tr.rotation * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const local: [number, number][] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
  const corners = local.map(([x, y]) => [tr.x + x * cos - y * sin, tr.y + x * sin + y * cos] as [number, number])
  const u0 = c.l
  const u1 = 1 - c.r
  const v0 = c.t
  const v1 = 1 - c.b
  const uvs: [number, number][] = tr.flipX ? [[u1, v0], [u0, v0], [u0, v1], [u1, v1]] : [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
  return { corners, uvs }
}
