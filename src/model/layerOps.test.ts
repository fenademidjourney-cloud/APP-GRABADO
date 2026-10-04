import { describe, expect, it } from 'vitest'
import { createLayer, layerQuad } from './layer'
import { cropToPoint, duplicateLayer, hitTest, reorder, resetCrop, transformAround, visibleSize } from './layerOps'

const a4 = { widthMm: 210, heightMm: 297 }

function layer(rotation = 0, flipX = false) {
  const l = createLayer('a', 'n', { w: 100, h: 50 }, a4, 0)
  l.transform = { x: 100, y: 100, scale: 1, rotation, flipX }
  return l
}

/** Where a visible edge sits on the sheet: the midpoint of its two corners. */
function edgeMid(l: ReturnType<typeof layer>, i: number, j: number) {
  const c = layerQuad(l).corners
  return { x: (c[i][0] + c[j][0]) / 2, y: (c[i][1] + c[j][1]) / 2 }
}

describe('crop', () => {
  for (const rotation of [0, 37, -90]) {
    for (const flipX of [false, true]) {
      it(`cropping the left edge keeps the right edge still (rot ${rotation}, flip ${flipX})`, () => {
        const l = layer(rotation, flipX)
        const rightBefore = edgeMid(l, 1, 2)
        const leftBefore = edgeMid(l, 0, 3)
        // Drag the left edge 30 % of the way to the right.
        const target = { x: leftBefore.x + (rightBefore.x - leftBefore.x) * 0.3, y: leftBefore.y + (rightBefore.y - leftBefore.y) * 0.3 }
        const next = { ...l, ...cropToPoint(l, 'l', target) }
        const rightAfter = edgeMid(next, 1, 2)
        expect(rightAfter.x).toBeCloseTo(rightBefore.x)
        expect(rightAfter.y).toBeCloseTo(rightBefore.y)
        expect(visibleSize(next).w).toBeCloseTo(70)
        // The pixels that stay keep their place: the source inset is on the mirrored side when flipped.
        expect(flipX ? next.crop.r : next.crop.l).toBeCloseTo(0.3)
        // Undoing the crop puts the full picture back where it was.
        const back = resetCrop(next)
        expect(back.transform.x).toBeCloseTo(l.transform.x)
        expect(back.transform.y).toBeCloseTo(l.transform.y)
      })
    }
  }

  it('never crops below the minimum size', () => {
    const l = layer()
    const next = cropToPoint(l, 'r', { x: -1000, y: 100 })
    expect(visibleSize({ ...l, ...next }).w).toBeGreaterThan(1.9)
  })
})

describe('transforms and order', () => {
  it('pinching around a point keeps that point fixed', () => {
    const t0 = layer().transform
    const pivot = { x: 120, y: 90 }
    const t = transformAround(t0, pivot, 2, 90, { x: 0, y: 0 })
    expect(t.scale).toBe(2)
    expect(t.rotation).toBe(90)
    // The layer centre was 20 mm left / 10 mm below the pivot; ×2 and a quarter turn.
    expect(t.x).toBeCloseTo(120 - 20)
    expect(t.y).toBeCloseTo(90 - 40)
  })

  it('reorders, duplicates', () => {
    const a = layer()
    const b = duplicateLayer(a)
    expect(b.id).not.toBe(a.id)
    expect(reorder([a, b], a.id, 1).map((l) => l.id)).toEqual([b.id, a.id])
    expect(reorder([a, b], a.id, -1)).toEqual([a, b])
  })
})

describe('hit test', () => {
  it('finds the topmost layer and lets taps through transparent pixels', () => {
    const bottom = layer()
    const top = { ...duplicateLayer(bottom, 0), assetId: 'b' }
    const transparentLeftHalf = { w: 2, h: 1, data: new Uint8Array([0, 255]) }
    const mask = (id: string) => (id === 'b' ? transparentLeftHalf : undefined)
    expect(hitTest([bottom, top], { x: 120, y: 100 }, mask)).toBe(top.id)
    expect(hitTest([bottom, top], { x: 80, y: 100 }, mask)).toBe(bottom.id)
    expect(hitTest([bottom, top], { x: 300, y: 100 }, mask)).toBeNull()
    expect(hitTest([bottom, { ...top, visible: false }], { x: 120, y: 100 }, mask)).toBe(bottom.id)
  })
})
