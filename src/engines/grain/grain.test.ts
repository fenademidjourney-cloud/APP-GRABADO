import { describe, expect, it } from 'vitest'
import { equalise, grainTile, GRAIN_KINDS } from '../../analysis/grainTiles'
import { resolveGrain } from './params'
import { applyPreset } from '../../presets/apply'
import { presetParams, PRESETS } from '../../presets/defs'
import { DEFAULT_DOC } from '../../model/doc'
import { sanitizeDoc } from '../../model/sanitize'

const SIZE = 128

describe('grain tiles', () => {
  for (const kind of GRAIN_KINDS) {
    const t = grainTile(kind, SIZE, 1)

    it(`${kind}: uniform histogram — ink where tone > grain covers exactly the tone`, () => {
      for (const tone of [0.1, 0.33, 0.5, 0.8]) {
        let inked = 0
        for (const g of t) if (g < tone) inked++
        expect(inked / t.length).toBeCloseTo(tone, 2)
      }
    })

    it(`${kind}: tiles without a seam (edge steps like interior steps)`, () => {
      let edge = 0
      let inner = 0
      for (let y = 0; y < SIZE; y++) {
        edge += Math.abs(t[y * SIZE] - t[y * SIZE + SIZE - 1])
        inner += Math.abs(t[y * SIZE + 64] - t[y * SIZE + 63])
      }
      expect(edge).toBeLessThan(inner * 1.6 + 1)
    })
  }

  it('is deterministic and changes with the seed', () => {
    expect(Array.from(grainTile('stone', 64, 3))).toEqual(Array.from(grainTile('stone', 64, 3)))
    expect(Array.from(grainTile('stone', 64, 3))).not.toEqual(Array.from(grainTile('stone', 64, 4)))
  })

  it('equalise keeps the order', () => {
    expect(Array.from(equalise(new Float32Array([5, 1, 3])))).toEqual([1, 0, 0.5])
  })
})

describe('grain engine', () => {
  it('maps the medium to its tile and the stroke only to crayon', () => {
    const u = { detail: 50, roughness: 40 }
    expect(resolveGrain(presetParams('stone-lithography'), u).kind).toBe('stone')
    const tusche = resolveGrain({ ...presetParams('stone-lithography'), medium: 'tusche' }, u)
    expect(tusche.kind).toBe('tusche')
    expect(tusche.stroke).toBe(0)
  })

  it('the preset applies to a valid document', () => {
    const d = applyPreset(DEFAULT_DOC, 'stone-lithography')
    expect(PRESETS['stone-lithography'].essentials.length).toBeLessThanOrEqual(5)
    expect(sanitizeDoc(d)).toEqual(d)
  })
})
