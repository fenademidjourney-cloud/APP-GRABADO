import { describe, expect, it } from 'vitest'
import { buildLines, directionField, streamlines, LINE_STRIDE, type LineBuild, type ToneField } from './flow'
import { applyPreset } from '../../presets/apply'
import { PRESETS } from '../../presets/defs'
import { DEFAULT_DOC } from '../../model/doc'
import { sanitizeDoc } from '../../model/sanitize'

const K = 4
function field(wmm: number, hmm: number, tone: (x: number, y: number) => number): ToneField {
  const w = wmm * K
  const h = hmm * K
  const f = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) f[y * w + x] = tone((x + 0.5) / K, (y + 0.5) / K)
  return { w, h, k: K, inks: [f] }
}
const base: LineBuild = { spacingMm: 1, angleDeg: 0, follow: 0.8, layers: 1, swell: 1, taper: 0, tremorMm: 0, detail: 0.5, mode: 'tone', seed: 1 }

describe('direction field', () => {
  it('uses the fixed angle on a flat tone', () => {
    const f = field(20, 20, () => 0.5)
    const d = directionField(f, { angleDeg: 0, follow: 1, detail: 0.5 })
    const i = 10 * d.w + 10
    expect(d.c2[i]).toBeCloseTo(1, 3)
    expect(d.s2[i]).toBeCloseTo(0, 3)
  })

  it('follows the isophotes of a form: around a dark disc the lines run tangentially', () => {
    const f = field(40, 40, (x, y) => Math.max(0, 1 - Math.hypot(x - 20, y - 20) / 15))
    const d = directionField(f, { angleDeg: 0, follow: 1, detail: 0.8 })
    // Right of the centre (x = 30, y = 20) the tangent is vertical: θ = 90°, doubled 180°.
    const i = 20 * d.w + 30
    expect(d.c2[i]).toBeLessThan(-0.8)
  })
})

describe('streamlines', () => {
  it('are evenly spaced and parallel in a uniform field', () => {
    const lines = streamlines(20, 20, 1, () => [1, 0], () => true)
    expect(lines.length).toBeGreaterThan(14)
    const ys = lines.map((l) => l[1]).sort((a, b) => a - b)
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThan(0.5)
    for (const l of lines) for (let j = 1; j < l.length / 2; j++) expect(Math.abs(l[j * 2 + 1] - l[1])).toBeLessThan(1e-3)
  })

  it('stay out of regions that are not alive', () => {
    const lines = streamlines(20, 20, 1, () => [1, 0], (x) => x < 10)
    for (const l of lines) expect(l[0]).toBeLessThan(13) // runs at most ~2 mm into the dead side
  })
})

describe('line geometry', () => {
  const flat = (t: number) => field(30, 30, () => t)
  const meanWidth = (geo: ReturnType<typeof buildLines>) => {
    const u8 = new Uint8Array(geo.data)
    let s = 0
    for (let v = 0; v < geo.vertices; v++) s += u8[v * LINE_STRIDE + 20]
    return s / Math.max(1, geo.vertices) / 255
  }

  it('is deterministic for the same input', () => {
    const a = buildLines(flat(0.4), { ...base, tremorMm: 0.1 })
    const b = buildLines(flat(0.4), { ...base, tremorMm: 0.1 })
    expect(a.vertices).toBe(b.vertices)
    expect(new Uint8Array(a.data)).toEqual(new Uint8Array(b.data))
  })

  it('makes lines wide enough to cover the tone (width ≈ tone in one layer)', () => {
    expect(meanWidth(buildLines(flat(0.3), base))).toBeCloseTo(0.3, 1)
    expect(meanWidth(buildLines(flat(0.6), base))).toBeGreaterThan(meanWidth(buildLines(flat(0.3), base)))
  })

  it('draws nothing on white paper; adds crosshatch layers in the dark', () => {
    expect(buildLines(flat(0), base).vertices).toBe(0)
    const one = buildLines(flat(0.9), { ...base, layers: 1 })
    const three = buildLines(flat(0.9), { ...base, layers: 3 })
    expect(three.lines).toBeGreaterThan(one.lines * 2)
  })

  it('gouges cut only the mid tones', () => {
    const g = { ...base, mode: 'gouge' as const, gougeLow: 0.2, gougeHigh: 0.6 }
    expect(buildLines(flat(0.95), g).vertices).toBe(0)
    expect(buildLines(flat(0.4), g).vertices).toBeGreaterThan(0)
  })
})

describe('line presets', () => {
  it('apply to a valid document', () => {
    for (const id of ['copperplate-engraving', 'etching']) {
      const d = applyPreset(DEFAULT_DOC, id)
      expect(PRESETS[id].essentials.length).toBeLessThanOrEqual(5)
      expect(sanitizeDoc(d)).toEqual(d)
    }
  })
})
