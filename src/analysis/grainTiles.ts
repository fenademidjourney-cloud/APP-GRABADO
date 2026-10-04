// Grain tiles for the grain engine (docs/PLANNING.md §C.2 · grain): threshold maps
// with a physical character, generated once (seeded, deterministic), tileable, and
// histogram-equalised so that "ink where tone > G" covers exactly the tone.
//   stone    a grained litho stone: the crayon catches on the tooth's peaks first
//            (cells of a Worley field), roughened by multi-scale noise
//   tusche   a tusche wash dries into a reticulated skin: ridges of noise
//   spatter  crachis: ink flicked from a brush — dots of many sizes that appear
//            and grow with the tone

import { rng } from '../util/prng'

export type GrainKind = 'stone' | 'tusche' | 'spatter'
export const GRAIN_KINDS: GrainKind[] = ['stone', 'tusche', 'spatter']

/** Periodic value noise on an n-cell lattice wrapped over the tile. */
function periodicNoise(size: number, cells: number, r: () => number): Float32Array {
  const lat = Float32Array.from({ length: cells * cells }, () => r())
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells
    const y0 = Math.floor(fy)
    const ty = fy - y0
    const uy = ty * ty * (3 - 2 * ty)
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells
      const x0 = Math.floor(fx)
      const tx = fx - x0
      const ux = tx * tx * (3 - 2 * tx)
      const a = lat[(y0 % cells) * cells + (x0 % cells)]
      const b = lat[(y0 % cells) * cells + ((x0 + 1) % cells)]
      const c = lat[((y0 + 1) % cells) * cells + (x0 % cells)]
      const d = lat[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)]
      out[y * size + x] = (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy
    }
  }
  return out
}

function fbm(size: number, base: number, octaves: number, r: () => number): Float32Array {
  const out = new Float32Array(size * size)
  let amp = 1
  let sum = 0
  for (let o = 0; o < octaves; o++) {
    const n = periodicNoise(size, base << o, r)
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp
    sum += amp
    amp *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum
  return out
}

/** Distance to the nearest jittered point, on a wrapped grid of `cells` × `cells`. */
function worley(size: number, cells: number, r: () => number): Float32Array {
  const px = Float32Array.from({ length: cells * cells }, () => r())
  const py = Float32Array.from({ length: cells * cells }, () => r())
  const out = new Float32Array(size * size)
  const cs = size / cells
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cs)
      const cy = Math.floor(y / cs)
      let best = Infinity
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i
          const gy = cy + j
          const k = (((gy % cells) + cells) % cells) * cells + (((gx % cells) + cells) % cells)
          const dx = (gx + px[k]) * cs - x
          const dy = (gy + py[k]) * cs - y
          best = Math.min(best, dx * dx + dy * dy)
        }
      }
      out[y * size + x] = Math.sqrt(best) / cs
    }
  }
  return out
}

/** Map values to their rank (0..1): an exactly uniform histogram, order preserved. */
export function equalise(v: Float32Array): Float32Array {
  const idx = new Uint32Array(v.length)
  for (let i = 0; i < idx.length; i++) idx[i] = i
  idx.sort((a, b) => v[a] - v[b] || a - b)
  const out = new Float32Array(v.length)
  const n = v.length - 1 || 1
  for (let r = 0; r < idx.length; r++) out[idx[r]] = r / n
  return out
}

export function grainTile(kind: GrainKind, size: number, seed: number): Float32Array {
  const r = rng(seed * 7 + GRAIN_KINDS.indexOf(kind) + 1)
  const v = new Float32Array(size * size)
  if (kind === 'stone') {
    // ~size/6 grains across: each tooth a little cone; noise breaks the regularity.
    const w = worley(size, Math.max(4, Math.round(size / 6)), r)
    const n = fbm(size, Math.max(2, size / 64), 4, r)
    for (let i = 0; i < v.length; i++) v[i] = w[i] * 0.75 + n[i] * 0.55
  } else if (kind === 'tusche') {
    // Ridges of two fbm fields: a network that fills its cells as the tone darkens.
    const a = fbm(size, Math.max(2, size / 64), 5, r)
    const b = fbm(size, Math.max(2, size / 32), 3, r)
    for (let i = 0; i < v.length; i++) v[i] = Math.abs(a[i] - 0.5) * 1.6 + Math.abs(b[i] - 0.5) * 0.5
  } else {
    // Spatter: dots with a power-law spread of sizes; between dots, a soft order.
    v.fill(Infinity)
    const count = Math.round((size * size) / 90)
    for (let d = 0; d < count; d++) {
      const cx = r() * size
      const cy = r() * size
      const rad = 0.8 + 6 * Math.pow(r(), 3)
      const reach = Math.ceil(rad * 3)
      for (let j = -reach; j <= reach; j++) {
        for (let i = -reach; i <= reach; i++) {
          const x = (((Math.floor(cx) + i) % size) + size) % size
          const y = (((Math.floor(cy) + j) % size) + size) % size
          const dist = Math.hypot(Math.floor(cx) + i - cx, Math.floor(cy) + j - cy) / rad
          if (dist < v[y * size + x]) v[y * size + x] = dist
        }
      }
    }
    const n = fbm(size, Math.max(2, size / 32), 3, r)
    for (let i = 0; i < v.length; i++) v[i] = Math.min(v[i], 3) + n[i] * 0.3
  }
  return equalise(v)
}
