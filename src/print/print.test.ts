import { describe, expect, it } from 'vitest'
import { registrationOffsets, maxDisplacementMm, MAX_SHIFT_MM } from './registration'
import { DEFAULT_IMPERFECTIONS, imperfectionMask, sanitizeImperfections } from './imperfections'
import { streamSeed, sanitizeSeed, newSeed } from '../util/seed'
import { rollVariant } from '../presets/variant'
import { applyPreset } from '../presets/apply'
import { variantsOf, ENGINE_PARAMS } from '../presets/defs'
import { DEFAULT_DOC } from '../model/doc'
import { sanitizeDoc } from '../model/sanitize'

describe('seed streams', () => {
  it('are deterministic and independent per module', () => {
    expect(streamSeed(7, 'paper')).toBe(streamSeed(7, 'paper'))
    expect(streamSeed(7, 'paper')).not.toBe(streamSeed(7, 'registration'))
    expect(streamSeed(7, 'paper')).not.toBe(streamSeed(8, 'paper'))
  })

  it('validates seeds and never repeats the previous one', () => {
    expect(sanitizeSeed(12, 1)).toBe(12)
    expect(sanitizeSeed(-1, 1)).toBe(1)
    expect(sanitizeSeed(1.5, 1)).toBe(1)
    expect(sanitizeSeed(2 ** 33, 1)).toBe(1)
    for (let i = 0; i < 20; i++) expect(newSeed(5)).not.toBe(5)
  })
})

describe('registration', () => {
  it('keeps the first ink fixed and is zero when off', () => {
    const r = registrationOffsets(3, 80, 3)
    expect(r[0]).toEqual({ dx: 0, dy: 0, rot: 0 })
    expect(Math.hypot(r[1].dx, r[1].dy)).toBeGreaterThan(0)
    expect(registrationOffsets(3, 0, 3).every((g) => g.dx === 0 && g.dy === 0 && g.rot === 0)).toBe(true)
  })

  it('same seed, same drift; scales with the amount; bounded', () => {
    expect(registrationOffsets(9, 50, 4)).toEqual(registrationOffsets(9, 50, 4))
    const half = registrationOffsets(9, 50, 4)[2]
    const full = registrationOffsets(9, 100, 4)[2]
    expect(full.dx).toBeCloseTo(half.dx * 2)
    for (const g of registrationOffsets(11, 100, 6)) expect(Math.hypot(g.dx, g.dy)).toBeLessThanOrEqual(MAX_SHIFT_MM + 1e-9)
  })

  it('an ink keeps its drift when inks are added', () => {
    expect(registrationOffsets(4, 60, 2)[1]).toEqual(registrationOffsets(4, 60, 5)[1])
  })

  it('bounds the displacement for the export apron', () => {
    const r = registrationOffsets(2, 100, 3)
    expect(maxDisplacementMm(r, { widthMm: 210, heightMm: 297 })).toBeGreaterThan(0)
    expect(maxDisplacementMm(r, { widthMm: 210, heightMm: 297 })).toBeLessThan(3)
  })
})

describe('imperfections', () => {
  it('masks and sanitises', () => {
    expect(imperfectionMask(['pressure', 'dust'])).toBe(5)
    expect(sanitizeImperfections({ amount: 400, enabled: ['dust', 'dust', 'lasers', 'pressure'] }, DEFAULT_IMPERFECTIONS))
      .toEqual({ amount: 100, enabled: ['pressure', 'dust'] })
    expect(sanitizeImperfections(null, DEFAULT_IMPERFECTIONS)).toEqual(DEFAULT_IMPERFECTIONS)
  })
})

describe('Variante (dice)', () => {
  const news = applyPreset({ ...DEFAULT_DOC, layers: [] }, 'newspaper-halftone')

  it('never picks the same style twice in a row', () => {
    let d = news
    for (let seed = 1; seed < 60; seed++) {
      const { doc, index } = rollVariant(d, seed)
      expect(index).not.toBe(d.variant)
      d = doc
    }
  })

  it('draws inside the ranges, takes the seed and keeps what was set by hand', () => {
    for (let seed = 100; seed < 140; seed++) {
      const { doc, index } = rollVariant(news, seed)
      const style = variantsOf(news.technique)[index]
      expect(doc.seed).toBe(seed)
      expect(doc.inks).toEqual(news.inks)
      expect(doc.paper).toEqual(news.paper)
      expect(doc.toggles).toEqual(news.toggles)
      for (const [k, [lo, hi]] of Object.entries(style.universal ?? {})) {
        const v = doc.universal[k as keyof typeof doc.universal]
        expect(v).toBeGreaterThanOrEqual(lo)
        expect(v).toBeLessThanOrEqual(hi)
      }
      for (const [id, spec] of Object.entries(style.params ?? {})) {
        if (typeof spec[0] === 'number') {
          expect(doc.params[id]).toBeGreaterThanOrEqual(spec[0] as number)
          expect(doc.params[id]).toBeLessThanOrEqual(spec[1] as number)
        } else expect(spec).toContain(doc.params[id])
      }
      // The result is a valid document.
      expect(sanitizeDoc(doc)).toEqual(doc)
    }
  })

  it('is deterministic for a seed, and works for techniques without an engine', () => {
    expect(rollVariant(news, 77)).toEqual(rollVariant(news, 77))
    const riso = applyPreset({ ...DEFAULT_DOC }, 'risograph')
    const { doc } = rollVariant(riso, 5)
    expect(doc.seed).toBe(5)
    expect(doc).not.toEqual(riso)
  })

  it('every preset style names valid parameters', () => {
    for (const technique of ['newspaper-halftone', 'editorial-halftone']) {
      const defs = ENGINE_PARAMS.screen
      for (const style of variantsOf(technique)) for (const id of Object.keys(style.params ?? {})) expect(defs.some((p) => p.id === id)).toBe(true)
    }
  })
})

describe('Variante in every technique', () => {
  it('every style of every preset gives a valid, different document', async () => {
    const { PRESETS } = await import('../presets/defs')
    for (const id of Object.keys(PRESETS)) {
      let d = applyPreset({ ...DEFAULT_DOC }, id)
      const seen = new Set<number>()
      for (let seed = 1; seed <= 24; seed++) {
        const { doc, index } = rollVariant(d, seed)
        seen.add(index)
        expect(sanitizeDoc(doc)).toEqual(doc)
        expect(JSON.stringify(doc.params) + JSON.stringify(doc.universal)).not.toBe(JSON.stringify(d.params) + JSON.stringify(d.universal))
        d = doc
      }
      expect(seen.size).toBe(PRESETS[id].variants.length) // every style comes up
    }
  })
})
