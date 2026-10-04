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
