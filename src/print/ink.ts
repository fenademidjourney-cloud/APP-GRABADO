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

/** Small L2 penalty: among equal matches, use less ink. */
export const SEPARATION_LAMBDA = 0.02
/** Coordinate-descent passes that settle the upper bound (a film can't exceed 1). */
export const SEPARATION_POLISH = 4

/** Solve (AᵀA + λI) d = Aᵀb for the inks in `idx` (1–3 of them). Null if singular. */
function solveSubset(at: RGB, inks: RGB[], idx: number[]): number[] | null {
  const m = idx.length
  const M: number[][] = idx.map((i) => idx.map((j) => inks[i][0] * inks[j][0] + inks[i][1] * inks[j][1] + inks[i][2] * inks[j][2]))
  for (let i = 0; i < m; i++) M[i][i] += SEPARATION_LAMBDA
  const r = idx.map((i) => inks[i][0] * at[0] + inks[i][1] * at[1] + inks[i][2] * at[2])
  if (m === 1) return [r[0] / M[0][0]]
  if (m === 2) {
    const det = M[0][0] * M[1][1] - M[0][1] * M[1][0]
    if (Math.abs(det) < 1e-9) return null
    return [(r[0] * M[1][1] - M[0][1] * r[1]) / det, (M[0][0] * r[1] - M[1][0] * r[0]) / det]
  }
  const [a, b, c] = M
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])
  if (Math.abs(det) < 1e-9) return null
  const col = (k: number) => M.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)))
  const d3 = (X: number[][]) => X[0][0] * (X[1][1] * X[2][2] - X[1][2] * X[2][1]) - X[0][1] * (X[1][0] * X[2][2] - X[1][2] * X[2][0]) + X[0][2] * (X[1][0] * X[2][1] - X[1][1] * X[2][0])
  return [d3(col(0)) / det, d3(col(1)) / det, d3(col(2)) / det]
}

/**
 * Densities (0..1) that best reproduce a linear colour with the given inks over
 * white paper: non-negative least squares in absorbance space with a small ridge.
 * With 3 channels an optimal solution uses at most 3 inks (Carathéodory), so every
 * support of 1–3 inks is solved exactly and the best non-negative one is kept; a few
 * projected coordinate-descent passes then settle the upper bound. Colours the inks
 * can't make get the closest they can. Mirrors the GLSL in render/shaders.ts.
 */
export function separate(target: RGB, inks: RGB[]): number[] {
  const at = target.map((c) => -Math.log(Math.max(MIN_T, c))) as RGB
  const n = inks.length
  let best = inks.map(() => 0)
  let bestCost = at[0] * at[0] + at[1] * at[1] + at[2] * at[2]
  for (let mask = 1; mask < 1 << n; mask++) {
    const idx: number[] = []
    for (let i = 0; i < n; i++) if (mask & (1 << i)) idx.push(i)
    if (idx.length > 3) continue
    const sol = solveSubset(at, inks, idx)
    if (!sol || sol.some((v) => v < 0)) continue
    const d = inks.map(() => 0)
    idx.forEach((i, k) => { d[i] = sol[k] })
    let cost = 0
    for (let ch = 0; ch < 3; ch++) {
      const e = inks.reduce((s, a, k) => s + a[ch] * d[k], 0) - at[ch]
      cost += e * e
    }
    cost += SEPARATION_LAMBDA * d.reduce((s, v) => s + v * v, 0)
    if (cost < bestCost - 1e-12) { bestCost = cost; best = d }
  }
  const d = best.map((v) => Math.min(1, Math.max(0, v)))
  for (let it = 0; it < SEPARATION_POLISH; it++) {
    for (let k = 0; k < n; k++) {
      const r = at.map((v, ch) => v - inks.reduce((s, a, j) => (j === k ? s : s + a[ch] * d[j]), 0))
      const a = inks[k]
      d[k] = Math.min(1, Math.max(0, (r[0] * a[0] + r[1] * a[1] + r[2] * a[2]) / (a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + SEPARATION_LAMBDA)))
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
