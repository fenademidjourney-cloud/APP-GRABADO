// The ink model (docs/PLANNING.md §H). It mirrors the GLSL in render/shaders.ts;
// these CPU versions are the reference the tests check and later passes reuse.
//
// Each ink is a filter: its colour, in linear sRGB, is the light it lets through at
// full density (transmittance T). Absorbance A = −ln T. A film of density d lets
// through exp(−A·d), so inks stack multiplicatively (Beer–Lambert): overprint and
// "two passes darken" come out of the model, not out of blend modes.

export type RGB = [number, number, number]

/** Smallest transmittance per channel: keeps absorbance finite for pure black / pure primaries. */
export const MIN_T = 0.002

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Absorbance of an ink given as an sRGB hex colour. */
export function inkAbsorbance(hex: string): RGB {
  return hexToRgb(hex).map((c) => -Math.log(Math.max(MIN_T, srgbToLinear(c)))) as RGB
}

/** Linear colour of the inks printed with densities `d` over a linear paper colour. */
export function overprint(paper: RGB, inks: RGB[], d: number[]): RGB {
  return paper.map((p, ch) => p * Math.exp(-inks.reduce((s, a, k) => s + a[ch] * (d[k] ?? 0), 0))) as RGB
}

/** Iterations of the separation solver: enough to converge for ≤ 6 inks. */
export const SEPARATION_ITERATIONS = 16
/** Small L2 penalty: among equal matches, use less ink. */
export const SEPARATION_LAMBDA = 0.02

/**
 * Densities (0..1) that best reproduce a linear colour with the given inks over
 * white paper: non-negative least squares in absorbance space, solved by projected
 * coordinate descent. Colours the inks can't make get the closest they can.
 */
export function separate(target: RGB, inks: RGB[]): number[] {
  const at = target.map((c) => -Math.log(Math.max(MIN_T, c))) as RGB
  const d = inks.map(() => 0)
  for (let it = 0; it < SEPARATION_ITERATIONS; it++) {
    for (let k = 0; k < inks.length; k++) {
      const r = at.map((v, ch) => v - inks.reduce((s, a, j) => (j === k ? s : s + a[ch] * d[j]), 0))
      const a = inks[k]
      const num = r[0] * a[0] + r[1] * a[1] + r[2] * a[2]
      const den = a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + SEPARATION_LAMBDA
      d[k] = Math.min(1, Math.max(0, num / den))
    }
  }
  return d
}

/** Linear luminance an ink lets through at full density. */
export function inkLuminance(hex: string): number {
  const a = inkAbsorbance(hex)
  return 0.2126 * Math.exp(-a[0]) + 0.7152 * Math.exp(-a[1]) + 0.0722 * Math.exp(-a[2])
}

/**
 * Tones are handled as "dot %": the share of paper an ink covers, on a perceptual
 * scale as in prepress files (a 50 % grey file ≈ a 50 % tint). A continuous film of
 * density d looks like a tint of this coverage. Mirrors the GLSL in render/shaders.ts.
 */
export function coverageForDensity(d: number, inkLum: number): number {
  const tl = Math.max(inkLum, MIN_T)
  const g = linearToSrgb(Math.exp(Math.log(tl) * d))
  return Math.min(1, Math.max(0, (1 - g) / Math.max(1 - linearToSrgb(tl), 1e-3)))
}

export function densityForCoverage(a: number, inkLum: number): number {
  const tl = Math.max(inkLum, MIN_T)
  const g = 1 - a * (1 - linearToSrgb(tl))
  return Math.min(1, Math.max(0, Math.log(Math.max(srgbToLinear(g), 1e-4)) / Math.log(tl)))
}

/**
 * Premultiplied RGBA of printed ink without paper (transparent export). `onWhite` is
 * what the inks give over white; alpha is the smallest that keeps every channel
 * non-negative, so compositing the result over white gives exactly `onWhite`.
 */
export function inkOnTransparent(onWhite: RGB): [number, number, number, number] {
  const alpha = Math.max(0, ...onWhite.map((c) => 1 - c))
  const c = (v: number) => Math.max(0, v - (1 - alpha))
  return [c(onWhite[0]), c(onWhite[1]), c(onWhite[2]), alpha]
}
