// Connected components of the inked plate (docs/PLANNING.md §C.2 · relief): each
// piece of movable type is its own block of metal or wood, so it varies on its own
// (height, inking, wear, baseline). Runs at analysis resolution on the CPU.
//
// Output: per pixel, a 24-bit id for its piece (packed RGB) and alpha 255; pixels a
// little outside a piece take the nearest piece's id (so the full-resolution edge,
// which can sit a fraction of an analysis pixel outside, still finds its piece).

import { mix32 } from '../util/seed'

/**
 * @param inked  w × h mask (1 = ink)
 * @param grow   how many pixels the ids spread into the background
 * @returns RGBA8: rgb = piece id (stable: hashed from the piece's first pixel), a = 255 inside or near a piece
 */
export function pieceIds(inked: Uint8Array, w: number, h: number, grow = 2): Uint8Array {
  const n = w * h
  const parent = new Int32Array(n).fill(-1)
  const find = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r]
    while (parent[i] !== r) { const next = parent[i]; parent[i] = r; i = next }
    return r
  }
  // Keep the smallest index as the root: the id doesn't depend on scan details.
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    if (ra < rb) parent[rb] = ra
    else parent[ra] = rb
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!inked[i]) continue
      parent[i] = i
      // 8-connectivity: left, and the three above.
      if (x > 0 && inked[i - 1]) union(i, i - 1)
      if (y > 0) {
        if (inked[i - w]) union(i, i - w)
        if (x > 0 && inked[i - w - 1]) union(i, i - w - 1)
        if (x < w - 1 && inked[i - w + 1]) union(i, i - w + 1)
      }
    }
  }
  const label = new Int32Array(n).fill(-1)
  for (let i = 0; i < n; i++) if (inked[i]) label[i] = find(i)
  // Spread ids into the background, one ring per pass.
  for (let g = 0; g < grow; g++) {
    const prev = label.slice()
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (prev[i] >= 0) continue
        let best = -1
        if (x > 0 && prev[i - 1] >= 0) best = prev[i - 1]
        else if (x < w - 1 && prev[i + 1] >= 0) best = prev[i + 1]
        else if (y > 0 && prev[i - w] >= 0) best = prev[i - w]
        else if (y < h - 1 && prev[i + w] >= 0) best = prev[i + w]
        label[i] = best
      }
    }
  }
  const out = new Uint8Array(n * 4)
  for (let i = 0; i < n; i++) {
    if (label[i] < 0) continue
    const id = mix32(label[i] + 1) & 0xffffff
    out[i * 4] = id & 255
    out[i * 4 + 1] = (id >> 8) & 255
    out[i * 4 + 2] = id >> 16
    out[i * 4 + 3] = 255
  }
  return out
}
