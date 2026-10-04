import { describe, expect, it } from 'vitest'
import { createLayer, fitLayerTransform, layerQuad } from './layer'

const a4 = { widthMm: 210, heightMm: 297 }

describe('layer', () => {
  it('a new layer fits inside the sheet, centred, keeping its proportions', () => {
    const t = fitLayerTransform({ w: 3000, h: 1000 }, a4)
    expect(3000 * t.scale).toBeLessThanOrEqual(210)
    expect(1000 * t.scale).toBeLessThanOrEqual(297)
    expect(t.x).toBe(105)
    expect(t.y).toBe(148.5)
  })

  it('cascades successive layers', () => {
    expect(fitLayerTransform({ w: 10, h: 10 }, a4, 1).x).toBeGreaterThan(fitLayerTransform({ w: 10, h: 10 }, a4, 0).x)
  })

  it('quad corners follow scale, rotation and crop', () => {
    const l = createLayer('a', 'n', { w: 100, h: 50 }, a4, 0)
    l.transform = { x: 0, y: 0, scale: 1, rotation: 90, flipX: false }
    l.crop = { l: 0.5, t: 0, r: 0, b: 0 }
    const { corners, uvs } = layerQuad(l)
    // Cropped to 50 × 50 mm, rotated 90° clockwise: the top-left corner goes to the top-right.
    expect(corners[0][0]).toBeCloseTo(25)
    expect(corners[0][1]).toBeCloseTo(-25)
    expect(uvs[0]).toEqual([0.5, 0])
  })

  it('flipX mirrors the texture coordinates', () => {
    const l = createLayer('a', 'n', { w: 10, h: 10 }, a4, 0)
    l.transform.flipX = true
    expect(layerQuad(l).uvs[0]).toEqual([1, 0])
  })
})
