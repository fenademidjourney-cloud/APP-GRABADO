import { describe, expect, it } from 'vitest'
import { DOT_SHAPES, spotLut, spotRaw, thresholdFor } from './spot'
import { voidAndCluster } from '../../analysis/bluenoise'
import { rng } from '../../util/prng'

describe('spot functions', () => {
  for (const shape of DOT_SHAPES) {
    it(`${shape}: the inked area equals the tone`, () => {
      const lut = spotLut(shape)
      const n = 200
      for (const tone of [0.05, 0.2, 0.5, 0.8, 0.95]) {
        const thr = thresholdFor(lut, tone)
        let inked = 0
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (spotRaw(shape, (x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5) < thr) inked++
        expect(inked / (n * n)).toBeCloseTo(tone, 1)
      }
    })
  }

  it('is continuous across cell borders (symmetric)', () => {
    for (const shape of DOT_SHAPES) expect(spotRaw(shape, 0.5, 0.2)).toBeCloseTo(spotRaw(shape, -0.5, 0.2))
  })

  it('no ink at 0 %, full cell at 100 % (over the sampled cell)', () => {
    for (const shape of DOT_SHAPES) {
      const lut = spotLut(shape)
      const n = 64
      let at0 = 0
      let at1 = 0
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const r = spotRaw(shape, (x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5)
          if (r < thresholdFor(lut, 0)) at0++
          if (r < thresholdFor(lut, 1)) at1++
        }
      }
      expect(at0).toBeLessThanOrEqual(4) // the exact centre sample may tie
      expect(at1).toBe(n * n)
    }
  })
})

describe('blue noise', () => {
  it('is a permutation of all ranks and deterministic', () => {
    const a = voidAndCluster(16, 3)
    const b = voidAndCluster(16, 3)
    expect(Array.from(a)).toEqual(Array.from(b))
    const ranks = Array.from(a, (v) => Math.round(v * 256)).sort((x, y) => x - y)
    expect(ranks).toEqual(Array.from({ length: 256 }, (_, i) => i))
  })

  it('spreads dots evenly: no two of the first 10 % are neighbours', () => {
    const n = 32
    const t = voidAndCluster(n, 5)
    const on: number[] = []
    t.forEach((v, i) => { if (v < 0.1) on.push(i) })
    for (const i of on) {
      const x = i % n
      const y = (i / n) | 0
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const j = ((y + dy + n) % n) * n + ((x + dx + n) % n)
        expect(t[j] < 0.1).toBe(false)
      }
    }
  })
})

describe('seeded random', () => {
  it('repeats exactly for the same seed', () => {
    const a = rng(42)
    const b = rng(42)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
    expect(rng(43)()).not.toBe(rng(42)())
  })
})
