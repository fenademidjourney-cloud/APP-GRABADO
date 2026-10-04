import { describe, expect, it } from 'vitest'
import { coverageForDensity, densityForCoverage, hexToRgb, inkAbsorbance, inkLuminance, inkOnTransparent, linearToSrgb, overprint, separate, srgbToLinear, type RGB } from './ink'

const WHITE: RGB = [1, 1, 1]
const lin = (hex: string) => hexToRgb(hex).map(srgbToLinear) as RGB

describe('ink model', () => {
  it('full density of one ink over white gives the ink colour', () => {
    const pink = '#ff48b0'
    const out = overprint(WHITE, [inkAbsorbance(pink)], [1])
    lin(pink).forEach((c, i) => expect(out[i]).toBeCloseTo(Math.max(c, 0.002), 3))
  })

  it('overprinting darkens: two inks are darker than either alone', () => {
    const a = inkAbsorbance('#ff48b0')
    const b = inkAbsorbance('#3255a4')
    const both = overprint(WHITE, [a, b], [1, 1])
    const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    expect(lum(both)).toBeLessThan(lum(overprint(WHITE, [a], [1])))
    expect(lum(both)).toBeLessThan(lum(overprint(WHITE, [b], [1])))
  })

  it('separation recovers the densities that made a colour', () => {
    const inks = [inkAbsorbance('#ff48b0'), inkAbsorbance('#3255a4')]
    const made = overprint(WHITE, inks, [0.6, 0.3])
    const d = separate(made, inks)
    expect(d[0]).toBeCloseTo(0.6, 1)
    expect(d[1]).toBeCloseTo(0.3, 1)
  })

  it('white needs no ink, and densities stay within 0..1', () => {
    const inks = [inkAbsorbance('#1d1d1b')]
    expect(separate(WHITE, inks)[0]).toBeCloseTo(0, 5)
    expect(separate([0, 0, 0], inks)[0]).toBeLessThanOrEqual(1)
  })

  it('transparent output composited over white gives back the print', () => {
    const onWhite = overprint(WHITE, [inkAbsorbance('#ff48b0'), inkAbsorbance('#3255a4')], [0.4, 0.7])
    const [r, g, b, a] = inkOnTransparent(onWhite)
    expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(0)
    expect(r + (1 - a)).toBeCloseTo(onWhite[0])
    expect(g + (1 - a)).toBeCloseTo(onWhite[1])
    expect(b + (1 - a)).toBeCloseTo(onWhite[2])
    expect(inkOnTransparent(WHITE)[3]).toBe(0)
  })

  it('dot % and film density convert both ways; a 50 % grey is about a 50 % tint', () => {
    const black = inkLuminance('#1d1d1b')
    for (const a of [0, 0.1, 0.5, 0.9, 1]) expect(coverageForDensity(densityForCoverage(a, black), black)).toBeCloseTo(a, 3)
    // Separation of a mid grey with black ink, converted to dot %:
    const d = separate([srgbToLinear(0.5), srgbToLinear(0.5), srgbToLinear(0.5)], [inkAbsorbance('#1d1d1b')])[0]
    expect(coverageForDensity(d, black)).toBeGreaterThan(0.5)
    expect(coverageForDensity(d, black)).toBeLessThan(0.62)
  })

  it('sRGB conversions round-trip', () => {
    for (const v of [0, 0.02, 0.5, 1]) expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 6)
  })
})
