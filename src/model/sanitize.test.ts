import { describe, expect, it } from 'vitest'
import { sanitizeDoc } from './sanitize'
import { DEFAULT_DOC } from './doc'

const goodLayer = {
  id: 'L1', assetId: 'sha256-x', name: 'foto', natural: { w: 800, h: 600 }, visible: true, locked: false, opacity: 0.5,
  blend: 'multiply', transform: { x: 10, y: 20, scale: 0.2, rotation: 15, flipX: true }, crop: { l: 0.1, t: 0, r: 0, b: 0 },
  inkTarget: 'ink-2', tone: { invert: false },
}

describe('sanitizeDoc', () => {
  it('returns the defaults for garbage', () => {
    expect(sanitizeDoc(null)).toEqual(DEFAULT_DOC)
    expect(sanitizeDoc('x')).toEqual(DEFAULT_DOC)
  })

  it('keeps valid data and drops unknown fields', () => {
    const d = sanitizeDoc({ ...DEFAULT_DOC, layers: [goodLayer], hacked: true })
    expect(d.layers).toHaveLength(1)
    expect(d.layers[0]).toEqual(goodLayer)
    expect('hacked' in d).toBe(false)
  })

  it('repairs invalid values', () => {
    const d = sanitizeDoc({
      technique: 'no-such-technique', sheetId: 'b99', inkMode: 'one', inks: ['#ff0000', 'red', '#00ff00'],
      layers: [{ ...goodLayer, opacity: 7, blend: 'glow', inkTarget: 'ink-2', transform: { x: NaN } }, { id: 'bad' }, goodLayer],
    })
    expect(d.technique).toBe(DEFAULT_DOC.technique)
    expect(d.sheetId).toBe(DEFAULT_DOC.sheetId)
    expect(d.inks).toEqual(['#ff0000'])
    expect(d.layers).toHaveLength(1) // the bad one is dropped, the duplicate id too
    expect(d.layers[0].opacity).toBe(1)
    expect(d.layers[0].blend).toBe('normal')
    expect(d.layers[0].inkTarget).toBe('auto') // ink-2 doesn't exist with one ink
    expect(d.layers[0].transform.x).toBe(0)
  })
})

describe('sanitizeDoc · Phase 06 fields', () => {
  it('fills seed, imperfections, grain, registration and light in older saves', () => {
    const { seed, imperfections, variant, ...old } = DEFAULT_DOC
    void seed; void imperfections; void variant
    const d = sanitizeDoc({ ...old, universal: { contrast: 10 }, paper: { id: 'kraft', texture: 50 } })
    expect(d.seed).toBe(DEFAULT_DOC.seed)
    expect(d.variant).toBe(-1)
    expect(d.imperfections).toEqual(DEFAULT_DOC.imperfections)
    expect(d.universal.grain).toBe(DEFAULT_DOC.universal.grain)
    expect(d.universal.registration).toBe(DEFAULT_DOC.universal.registration)
    expect(d.paper).toEqual({ id: 'kraft', texture: 50, light: DEFAULT_DOC.paper.light })
  })

  it('keeps a valid seed and rejects a bad one', () => {
    expect(sanitizeDoc({ ...DEFAULT_DOC, seed: 4294967295 }).seed).toBe(4294967295)
    expect(sanitizeDoc({ ...DEFAULT_DOC, seed: 'x' }).seed).toBe(DEFAULT_DOC.seed)
  })
})
