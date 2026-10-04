// Seeded randomness (docs/PLANNING.md §30): the same seed gives exactly the same
// numbers on every device. sfc32 (Chris Doty-Humphrey): small, fast, good quality.

export function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
    const t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    const r = (t + d) | 0
    c = (c + r) | 0
    return (r >>> 0) / 4294967296
  }
}

/** A generator from one integer seed (warmed up so nearby seeds diverge). */
export function rng(seed: number): () => number {
  const next = sfc32(0x9e3779b9, 0x243f6a88, 0xb7e15162, seed >>> 0)
  for (let i = 0; i < 15; i++) next()
  return next
}
