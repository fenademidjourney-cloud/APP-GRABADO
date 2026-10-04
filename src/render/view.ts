// The view onto the sheet: shared by the main thread (gestures, overlays) and the
// renderer (worker), so both always agree on where the sheet is. All values here are
// CSS pixels; the renderer multiplies by its device pixel ratio.

export interface View {
  zoom: number   // 1 = the sheet fitted in the card
  panX: number   // CSS px offset of the sheet from the centred position
  panY: number
}

export interface Size { w: number; h: number }
export interface SheetMm { widthMm: number; heightMm: number }
export interface Rect { x: number; y: number; w: number; h: number; pxPerMm: number }

export const FIT_VIEW: View = { zoom: 1, panX: 0, panY: 0 }
export const FIT_MARGIN = 16
export const MIN_ZOOM = 0.5

/** CSS px per mm when the sheet is fitted (fit = min(w/W, h/H)), keeping the margin. */
export function fitScale(card: Size, sheet: SheetMm, margin = FIT_MARGIN): number {
  return Math.max(1e-6, Math.min((card.w - margin * 2) / sheet.widthMm, (card.h - margin * 2) / sheet.heightMm))
}

export function sheetRect(card: Size, sheet: SheetMm, view: View): Rect {
  const pxPerMm = fitScale(card, sheet) * view.zoom
  const w = sheet.widthMm * pxPerMm
  const h = sheet.heightMm * pxPerMm
  return { x: (card.w - w) / 2 + view.panX, y: (card.h - h) / 2 + view.panY, w, h, pxPerMm }
}

/** Zoom at which one export pixel (at `dpi`) is one device pixel: the "100 %" view. */
export function actualSizeZoom(card: Size, sheet: SheetMm, dpi: number, dpr: number): number {
  return dpi / 25.4 / dpr / fitScale(card, sheet)
}

export function maxZoom(card: Size, sheet: SheetMm, dpi: number, dpr: number): number {
  return Math.max(4, actualSizeZoom(card, sheet, dpi, dpr) * 4)
}

/** Keep part of the sheet on screen: at least 40 px of it (or all of it, if smaller). */
export function clampView(view: View, card: Size, sheet: SheetMm): View {
  const r = sheetRect(card, sheet, { ...view, panX: 0, panY: 0 })
  const keep = 40
  const limX = Math.max(0, (card.w + r.w) / 2 - Math.min(keep, r.w))
  const limY = Math.max(0, (card.h + r.h) / 2 - Math.min(keep, r.h))
  return { zoom: view.zoom, panX: Math.max(-limX, Math.min(limX, view.panX)), panY: Math.max(-limY, Math.min(limY, view.panY)) }
}

/** Zoom by `factor` keeping the sheet point under (px, py) — card CSS coordinates — still. */
export function zoomAt(view: View, card: Size, sheet: SheetMm, factor: number, px: number, py: number, max: number): View {
  const zoom = Math.max(MIN_ZOOM, Math.min(max, view.zoom * factor))
  const before = sheetRect(card, sheet, view)
  const mmX = (px - before.x) / before.pxPerMm
  const mmY = (py - before.y) / before.pxPerMm
  const centred = sheetRect(card, sheet, { zoom, panX: 0, panY: 0 })
  const next = { zoom, panX: px - mmX * centred.pxPerMm - centred.x, panY: py - mmY * centred.pxPerMm - centred.y }
  return clampView(next, card, sheet)
}

export function panBy(view: View, card: Size, sheet: SheetMm, dx: number, dy: number): View {
  return clampView({ ...view, panX: view.panX + dx, panY: view.panY + dy }, card, sheet)
}
