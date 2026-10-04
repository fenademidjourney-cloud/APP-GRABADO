import { describe, expect, it } from 'vitest'
import { pieceIds } from '../../analysis/components'
import { resolveRelief, MAX_RELIEF_SIMPLIFY_MM } from './params'
import { presetParams, PRESETS } from '../../presets/defs'
import { applyPreset } from '../../presets/apply'
import { DEFAULT_DOC } from '../../model/doc'
import { sanitizeDoc } from '../../model/sanitize'

const idAt = (ids: Uint8Array, i: number) => ids[i * 4] | (ids[i * 4 + 1] << 8) | (ids[i * 4 + 2] << 16)

describe('pieces (connected components)', () => {
  // Two letters "I I" and a dot touching the second one diagonally.
  const w = 9
  const h = 5
  const rows = [
    '.#...#...',
    '.#...#...',
    '.#...#...',
    '.#....#..',
    '.........',
  ]
  const mask = new Uint8Array(rows.join('').split('').map((c) => (c === '#' ? 1 : 0)))

  it('gives each piece its own id and joins diagonal neighbours', () => {
    const ids = pieceIds(mask, w, h, 0)
    expect(idAt(ids, 1)).toBe(idAt(ids, 3 * w + 1))
    expect(idAt(ids, 5)).toBe(idAt(ids, 3 * w + 6))
    expect(idAt(ids, 1)).not.toBe(idAt(ids, 5))
    expect(ids[4 * 4 + 3]).toBe(0) // background stays empty without growth
  })

  it('spreads ids into the background and is deterministic', () => {
    const grown = pieceIds(mask, w, h, 1)
    expect(grown[0 * 4 + 3]).toBe(255)
    expect(idAt(grown, 0)).toBe(idAt(grown, 1))
    expect(Array.from(pieceIds(mask, w, h, 2))).toEqual(Array.from(pieceIds(mask, w, h, 2)))
  })
})

describe('relief engine', () => {
  const u = { detail: 50, pressure: 50, roughness: 20, ink: 100 }
  it('maps detail to the gouge and ink to over-inking', () => {
    expect(resolveRelief(presetParams('woodcut'), { ...u, detail: 0 }).simplifyMm).toBeCloseTo(MAX_RELIEF_SIMPLIFY_MM)
    expect(resolveRelief(presetParams('woodcut'), u).growMm).toBeCloseTo(0)
    expect(resolveRelief(presetParams('woodcut'), { ...u, ink: 150 }).growMm).toBeGreaterThan(0)
    expect(resolveRelief(presetParams('linocut'), u).woodGrain).toBe(0) // no grain without wood
    expect(resolveRelief(presetParams('movable-type'), u).pieces).toBeGreaterThan(0)
  })

  it('every relief preset applies to a valid document', () => {
    for (const id of ['woodcut', 'linocut', 'letterpress', 'movable-type']) {
      const d = applyPreset(DEFAULT_DOC, id)
      expect(PRESETS[id].essentials.length).toBeLessThanOrEqual(5)
      expect(sanitizeDoc(d)).toEqual(d)
    }
  })
})
