// Blue-noise threshold map by void-and-cluster (Ulichney 1993), on a torus so it
// tiles. Used by the stochastic (FM) screen: each cell is inked when its rank is
// below the tone, which spreads the dots evenly with no visible pattern.

import { rng } from '../util/prng'

/**
 * Ranks 0..n²−1 for an n × n toroidal tile, as a Float32Array normalised to [0, 1).
 * Deterministic for a given seed. n = 64 takes ~50 ms.
 */
export function voidAndCluster(n = 64, seed = 1, sigma = 1.5): Float32Array {
  const N = n * n
  const rand = rng(seed)
  // Gaussian energy kernel on the torus.
  const kernel = new Float32Array(N)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = Math.min(x, n - x)
      const dy = Math.min(y, n - y)
      kernel[y * n + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
    }
  }
  const energy = new Float32Array(N)
  const bits = new Uint8Array(N)
  const splat = (i: number, sign: number) => {
    const px = i % n
    const py = (i / n) | 0
    for (let y = 0; y < n; y++) {
      const ky = ((y - py + n) % n) * n
      const row = y * n
      for (let x = 0; x < n; x++) energy[row + x] += sign * kernel[ky + ((x - px + n) % n)]
    }
  }
  const tightest = () => { let best = -1, v = -Infinity; for (let i = 0; i < N; i++) if (bits[i] && energy[i] > v) { v = energy[i]; best = i } return best }
  const largestVoid = () => { let best = -1, v = Infinity; for (let i = 0; i < N; i++) if (!bits[i] && energy[i] < v) { v = energy[i]; best = i } return best }

  // Initial pattern: ~10 % random minority pixels, then relaxed until stable.
  const ones = Math.max(1, Math.floor(N * 0.1))
  let placed = 0
  while (placed < ones) {
    const i = Math.floor(rand() * N)
    if (!bits[i]) { bits[i] = 1; splat(i, 1); placed++ }
  }
  for (let guard = 0; guard < N; guard++) {
    const c = tightest()
    bits[c] = 0; splat(c, -1)
    const v = largestVoid()
    if (v === c) { bits[c] = 1; splat(c, 1); break }
    bits[v] = 1; splat(v, 1)
  }

  const rank = new Int32Array(N).fill(-1)
  const initial = bits.slice()
  const initialEnergy = energy.slice()
  // Phase 1: remove ones from the tightest clusters, ranking downwards.
  for (let r = ones - 1; r >= 0; r--) {
    const c = tightest()
    bits[c] = 0; splat(c, -1)
    rank[c] = r
  }
  // Phases 2–3: from the initial pattern, fill the largest voids, ranking upwards.
  bits.set(initial)
  energy.set(initialEnergy)
  for (let r = ones; r < N; r++) {
    const v = largestVoid()
    bits[v] = 1; splat(v, 1)
    rank[v] = r
  }
  const out = new Float32Array(N)
  for (let i = 0; i < N; i++) out[i] = rank[i] / N
  return out
}
