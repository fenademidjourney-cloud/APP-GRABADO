// Spot functions of the AM screen (docs/PLANNING.md §C.2 · screen). Inside a cell,
// f ∈ [−½, ½]², each shape gives a continuous "raw" value; a pixel is inked when
// raw < threshold(tone). Shapes are symmetric, so raw is continuous across cells.
//
// The threshold is not the tone itself: a quantile table makes the inked area equal
// the tone exactly, whatever the shape (round, chain, cross…). The GLSL in
// render/shaders.ts mirrors `spotRaw`; keep both in step (tests check this file).

export type DotShape = 'round' | 'ellipse' | 'square' | 'line' | 'cross' | 'diamond'
export const DOT_SHAPES: DotShape[] = ['round', 'ellipse', 'square', 'line', 'cross', 'diamond']
export const SHAPE_INDEX: Record<DotShape, number> = { round: 0, ellipse: 1, square: 2, line: 3, cross: 4, diamond: 5 }

/** Aspect of the elliptical (chain) dot: dots join along x first. */
export const ELLIPSE_ASPECT = 1.4
/** Entries of the quantile table (tone 0, 1/32, …, 1). */
export const SPOT_LUT_SIZE = 33

export function spotRaw(shape: DotShape, fx: number, fy: number): number {
  const ax = Math.abs(fx)
  const ay = Math.abs(fy)
  switch (shape) {
    case 'round': {
      // Distance to the centre vs. to the nearest corner: round dots in the light
      // tones, round holes in the dark ones, a checkerboard at 50 % (Euclidean dot).
      const c = Math.hypot(ax, ay)
      const e = Math.hypot(0.5 - ax, 0.5 - ay)
      return c / (c + e + 1e-9)
    }
    case 'ellipse': {
      const c = Math.hypot(ax, ay * ELLIPSE_ASPECT)
      const e = Math.hypot(0.5 - ax, (0.5 - ay) * ELLIPSE_ASPECT)
      return c / (c + e + 1e-9)
    }
    case 'square': {
      const c = Math.max(ax, ay)
      const e = Math.max(0.5 - ax, 0.5 - ay)
      return c / (c + e + 1e-9)
    }
    case 'line':
      return ay * 2
    case 'cross':
      return Math.min(ax, ay) * 2
    case 'diamond':
      return ax + ay
  }
}

/** Threshold for tones 0, 1/32 … 1: the raw value below which that share of the cell lies. */
export function spotLut(shape: DotShape, samples = 256): Float32Array {
  const values = new Float32Array(samples * samples)
  for (let y = 0; y < samples; y++) {
    for (let x = 0; x < samples; x++) values[y * samples + x] = spotRaw(shape, (x + 0.5) / samples - 0.5, (y + 0.5) / samples - 0.5)
  }
  values.sort()
  const lut = new Float32Array(SPOT_LUT_SIZE)
  for (let i = 0; i < SPOT_LUT_SIZE; i++) {
    const t = i / (SPOT_LUT_SIZE - 1)
    // The ends sit just outside the range of raw values: 0 % inks nothing, 100 % everything.
    lut[i] = t <= 0 ? values[0] - 1e-4 : t >= 1 ? values[values.length - 1] + 1e-4 : values[Math.min(values.length - 1, Math.floor(t * values.length))]
  }
  return lut
}

export function thresholdFor(lut: Float32Array, tone: number): number {
  const x = Math.max(0, Math.min(1, tone)) * (SPOT_LUT_SIZE - 1)
  const i = Math.min(SPOT_LUT_SIZE - 2, Math.floor(x))
  return lut[i] + (lut[i + 1] - lut[i]) * (x - i)
}
