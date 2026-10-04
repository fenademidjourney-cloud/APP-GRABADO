import { describe, expect, it } from 'vitest'
import { FIT_VIEW, actualSizeZoom, clampView, fitScale, sheetRect, zoomAt } from './view'

const card = { w: 400, h: 600 }
const a4 = { widthMm: 210, heightMm: 297 }

describe('view', () => {
  it('fits the sheet inside the card with the margin, centred', () => {
    const r = sheetRect(card, a4, FIT_VIEW)
    expect(r.w).toBeLessThanOrEqual(card.w - 32 + 1e-9)
    expect(r.h).toBeLessThanOrEqual(card.h - 32 + 1e-9)
    expect(Math.min(card.w - 32 - r.w, card.h - 32 - r.h)).toBeCloseTo(0)
    expect(r.x + r.w / 2).toBeCloseTo(card.w / 2)
    expect(r.y + r.h / 2).toBeCloseTo(card.h / 2)
  })

  it('zooming keeps the point under the cursor still', () => {
    const px = 150
    const py = 220
    const before = sheetRect(card, a4, FIT_VIEW)
    const mm = { x: (px - before.x) / before.pxPerMm, y: (py - before.y) / before.pxPerMm }
    const v = zoomAt(FIT_VIEW, card, a4, 3, px, py, 100)
    const after = sheetRect(card, a4, v)
    expect(after.x + mm.x * after.pxPerMm).toBeCloseTo(px)
    expect(after.y + mm.y * after.pxPerMm).toBeCloseTo(py)
    expect(v.zoom).toBeCloseTo(3)
  })

  it('clamps the zoom and keeps part of the sheet on screen', () => {
    expect(zoomAt(FIT_VIEW, card, a4, 0.01, 0, 0, 10).zoom).toBe(0.5)
    expect(zoomAt(FIT_VIEW, card, a4, 1000, 0, 0, 10).zoom).toBe(10)
    const far = clampView({ zoom: 2, panX: 1e6, panY: -1e6 }, card, a4)
    const r = sheetRect(card, a4, far)
    expect(r.x).toBeLessThan(card.w)
    expect(r.y + r.h).toBeGreaterThan(0)
  })

  it('"100 %" maps one export pixel to one device pixel', () => {
    const dpi = 300
    const dpr = 2
    const z = actualSizeZoom(card, a4, dpi, dpr)
    const devicePxPerMm = fitScale(card, a4) * z * dpr
    expect(devicePxPerMm).toBeCloseTo(dpi / 25.4)
  })
})
