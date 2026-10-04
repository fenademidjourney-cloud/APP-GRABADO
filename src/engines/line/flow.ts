// The line engine's geometry (docs/PLANNING.md §C.2 · line), computed once on the
// CPU at analysis resolution, in mm of the sheet:
//   1. a direction field: the tangent of the tone's isophotes from a smoothed
//      structure tensor (lines wrap around forms, as an engraver's do), blended
//      with a fixed angle where the image has no clear form;
//   2. evenly spaced streamlines (Jobard & Lefer 1997), one family per crosshatch
//      layer, each layer turned from the previous one;
//   3. per vertex and per ink, the width the tone asks for (parallel lines of width
//      w every d cover w/d of the paper), cascaded through the layers.
// The result is a vertex buffer of triangle strips the GPU draws at any resolution:
// the preview and every export tile draw the very same lines.

import { rng } from '../../util/prng'

export interface ToneField {
  w: number
  h: number
  k: number                 // px per mm
  inks: Float32Array[]      // per ink (≤ 4), top-down rows, tone as dot % 0..1
}

export interface LineBuild {
  spacingMm: number         // distance between lines of one layer
  angleDeg: number          // the fixed direction (where the image has no form)
  follow: number            // 0..1: how much lines follow the forms
  layers: number            // 1..3 crosshatch layers
  swell: number             // 0..1: tone by width (engraving) vs by layers (etching)
  taper: number             // 0..1: entry and exit of the tool (length of the taper)
  tremorMm: number          // hand tremor across the line
  detail: number            // 0..1: small = the direction follows only large forms
  mode: 'tone' | 'white' | 'gouge'
  /** gouge mode (woodcut cuts): tones between low and high get white cuts. */
  gougeLow?: number
  gougeHigh?: number
  seed: number
}

/** Bytes per strip vertex: x, y, nx, ny, side (float32) + 4 widths (uint8, fraction of the spacing). */
export const LINE_STRIDE = 24

export interface LineGeometry {
  data: ArrayBuffer
  vertices: number          // strip vertices (drawArrays TRIANGLE_STRIP)
  lines: number             // polylines (before splitting into visible runs)
}

/** Crosshatch layers turn by these angles from the first. */
const LAYER_TURN = [0, 55, -50]

// ---- helpers ------------------------------------------------------------------

function blur(src: Float32Array, w: number, h: number, sigmaPx: number): Float32Array {
  if (sigmaPx < 0.3) return src.slice()
  const r = Math.ceil(sigmaPx * 2.5)
  const kern = new Float32Array(2 * r + 1)
  let sum = 0
  for (let i = -r; i <= r; i++) { kern[i + r] = Math.exp(-0.5 * (i * i) / (sigmaPx * sigmaPx)); sum += kern[i + r] }
  for (let i = 0; i < kern.length; i++) kern[i] /= sum
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let i = -r; i <= r; i++) s += src[row + Math.min(w - 1, Math.max(0, x + i))] * kern[i + r]
      tmp[row + x] = s
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let i = -r; i <= r; i++) s += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x] * kern[i + r]
      out[y * w + x] = s
    }
  }
  return out
}

function sampler(f: Float32Array, w: number, h: number, k: number) {
  return (xmm: number, ymm: number) => {
    const x = Math.min(w - 1.001, Math.max(0, xmm * k - 0.5))
    const y = Math.min(h - 1.001, Math.max(0, ymm * k - 0.5))
    const xi = x | 0
    const yi = y | 0
    const fx = x - xi
    const fy = y - yi
    const i = yi * w + xi
    const a = f[i] + (f[i + 1] - f[i]) * fx
    const b = f[i + w] + (f[i + w + 1] - f[i + w]) * fx
    return a + (b - a) * fy
  }
}

/** Smooth 1-D noise along a line (for the hand's tremor), −1..1. */
function noise1(r: () => number, n: number): (t: number) => number {
  const v = Array.from({ length: n }, () => r() * 2 - 1)
  return (t) => {
    const x = Math.max(0, Math.min(n - 1.001, t))
    const i = x | 0
    const f = x - i
    const u = f * f * (3 - 2 * f)
    return v[i] + (v[i + 1] - v[i]) * u
  }
}

// ---- direction field ----------------------------------------------------------

export interface DirectionField { c2: Float32Array; s2: Float32Array; dark: Float32Array; w: number; h: number; k: number }

/** Resolution of the direction field: forms are large, 1 px per mm is plenty (and fast). */
const FIELD_PX_PER_MM = 1

/**
 * Doubled-angle direction field (cos 2θ, sin 2θ): θ and θ + 180° are the same line.
 * Computed on a coarse grid (FIELD_PX_PER_MM); `dark` stays at the tone's resolution.
 */
export function directionField(field: ToneField, p: Pick<LineBuild, 'angleDeg' | 'follow' | 'detail'>): DirectionField {
  const darkFull = new Float32Array(field.w * field.h)
  for (const ink of field.inks) for (let i = 0; i < darkFull.length; i++) darkFull[i] = Math.max(darkFull[i], ink[i])
  // Box-average down to the field's grid.
  const f = Math.max(1, Math.round(field.k / FIELD_PX_PER_MM))
  const w = Math.max(1, Math.ceil(field.w / f))
  const h = Math.max(1, Math.ceil(field.h / f))
  const k = field.k / f
  const n = w * h
  const dark = new Float32Array(n)
  const cnt = new Float32Array(n)
  for (let y = 0; y < field.h; y++) {
    for (let x = 0; x < field.w; x++) {
      const i = ((y / f) | 0) * w + ((x / f) | 0)
      dark[i] += darkFull[y * field.w + x]
      cnt[i]++
    }
  }
  for (let i = 0; i < n; i++) dark[i] /= cnt[i] || 1
  const g = blur(dark, w, h, 0.8 * k)
  const j11 = new Float32Array(n)
  const j12 = new Float32Array(n)
  const j22 = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      // Tone change per mm.
      const gx = (g[y * w + Math.min(w - 1, x + 1)] - g[y * w + Math.max(0, x - 1)]) * 0.5 * k
      const gy = (g[Math.min(h - 1, y + 1) * w + x] - g[Math.max(0, y - 1) * w + x]) * 0.5 * k
      j11[i] = gx * gx
      j12[i] = gx * gy
      j22[i] = gy * gy
    }
  }
  const sigmaT = (6 - 4.5 * p.detail) * k
  const a11 = blur(j11, w, h, sigmaT)
  const a12 = blur(j12, w, h, sigmaT)
  const a22 = blur(j22, w, h, sigmaT)
  const base = (p.angleDeg * Math.PI) / 180
  const bc = Math.cos(2 * base)
  const bs = Math.sin(2 * base)
  const c2 = new Float32Array(n)
  const s2 = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    // The gradient's doubled angle is (J11 − J22, 2·J12); the tangent is 90° away,
    // i.e. the opposite doubled vector.
    const dx = a22[i] - a11[i]
    const dy = -2 * a12[i]
    const m = Math.hypot(dx, dy)
    const energy = a11[i] + a22[i]
    // Strength: a clear, coherent form (tone changing ≥ ~0.05 per mm).
    const coherent = m / (energy + 1e-9)
    const strong = Math.min(1, Math.max(0, (Math.sqrt(energy) - 0.01) / 0.06))
    const s = p.follow * coherent * strong
    let cx = bc * (1 - s) + (m > 0 ? (dx / m) * s : 0)
    let cy = bs * (1 - s) + (m > 0 ? (dy / m) * s : 0)
    const l = Math.hypot(cx, cy) || 1
    cx /= l
    cy /= l
    c2[i] = cx
    s2[i] = cy
  }
  return { c2, s2, dark: darkFull, w, h, k }
}

// ---- streamlines --------------------------------------------------------------

interface Grid { cell: number; cols: number; rows: number; head: Int32Array; next: number[]; px: number[]; py: number[]; line: number[]; seq: number[] }

function makeGrid(wmm: number, hmm: number, cell: number): Grid {
  const cols = Math.max(1, Math.ceil(wmm / cell))
  const rows = Math.max(1, Math.ceil(hmm / cell))
  return { cell, cols, rows, head: new Int32Array(cols * rows).fill(-1), next: [], px: [], py: [], line: [], seq: [] }
}

function gridAdd(g: Grid, x: number, y: number, line: number, seq: number) {
  const cx = Math.min(g.cols - 1, Math.max(0, Math.floor(x / g.cell)))
  const cy = Math.min(g.rows - 1, Math.max(0, Math.floor(y / g.cell)))
  const c = cy * g.cols + cx
  const id = g.px.length
  g.px.push(x); g.py.push(y); g.line.push(line); g.seq.push(seq)
  g.next.push(g.head[c])
  g.head[c] = id
}

/** Is (x, y) at least `d` from every live point (ignoring the current line's last samples)? */
function gridFree(g: Grid, x: number, y: number, d: number, dead: Set<number>, line = -1, seq = 0, skip = 0): boolean {
  const r = Math.ceil(d / g.cell)
  const cx = Math.floor(x / g.cell)
  const cy = Math.floor(y / g.cell)
  const d2 = d * d
  for (let j = cy - r; j <= cy + r; j++) {
    if (j < 0 || j >= g.rows) continue
    for (let i = cx - r; i <= cx + r; i++) {
      if (i < 0 || i >= g.cols) continue
      for (let p = g.head[j * g.cols + i]; p >= 0; p = g.next[p]) {
        if (dead.has(g.line[p])) continue
        if (g.line[p] === line && Math.abs(g.seq[p] - seq) <= skip) continue
        const dx = g.px[p] - x
        const dy = g.py[p] - y
        if (dx * dx + dy * dy < d2) return false
      }
    }
  }
  return true
}

/**
 * Evenly spaced streamlines of one layer: polylines in mm. `dirAt` returns the
 * doubled-angle vector; `alive(x, y)` says whether a line may run there.
 */
export function streamlines(
  wmm: number, hmm: number, d: number,
  dirAt: (x: number, y: number) => [number, number],
  alive: (x: number, y: number) => boolean,
): Array<Float32Array> {
  const dtest = 0.55 * d
  const step = Math.min(0.6, Math.max(0.2, d * 0.9))
  const skip = Math.ceil((dtest * 2.5) / step)
  const maxSteps = Math.ceil(400 / step)
  const minLen = Math.max(1.5, 3 * d)
  const g = makeGrid(wmm, hmm, d)
  const dead = new Set<number>()
  const out: Float32Array[] = []
  let lineId = 0

  const dirFrom = (x: number, y: number, px: number, py: number): [number, number] => {
    const [c, s] = dirAt(x, y)
    const a = Math.atan2(s, c) / 2
    let ux = Math.cos(a)
    let uy = Math.sin(a)
    if (ux * px + uy * py < 0) { ux = -ux; uy = -uy }
    return [ux, uy]
  }

  const trace = (sx: number, sy: number): Float32Array | null => {
    const id = lineId++
    const fwd: number[] = []
    const bwd: number[] = []
    const [c0, s0] = dirAt(sx, sy)
    const a0 = Math.atan2(s0, c0) / 2
    for (const sign of [1, -1]) {
      const pts = sign > 0 ? fwd : bwd
      let x = sx
      let y = sy
      let px = Math.cos(a0) * sign
      let py = Math.sin(a0) * sign
      let quiet = 0
      for (let n = 0; n < maxSteps; n++) {
        const seq = sign * (n + 1)
        // Midpoint (RK2) step along the field, keeping the heading.
        const [ux, uy] = dirFrom(x, y, px, py)
        const [vx, vy] = dirFrom(x + ux * step * 0.5, y + uy * step * 0.5, ux, uy)
        const nx = x + vx * step
        const ny = y + vy * step
        if (nx < 0 || ny < 0 || nx > wmm || ny > hmm) break
        if (!gridFree(g, nx, ny, dtest, dead, id, seq, skip)) break
        if (!alive(nx, ny)) { if (++quiet * step > 2) break } else quiet = 0
        pts.push(nx, ny)
        gridAdd(g, nx, ny, id, seq)
        x = nx; y = ny; px = vx; py = vy
      }
    }
    const count = (fwd.length + bwd.length) / 2 + 1
    if ((count - 1) * step < minLen) { dead.add(id); return null }
    const line = new Float32Array(count * 2)
    let o = 0
    for (let i = bwd.length - 2; i >= 0; i -= 2) { line[o++] = bwd[i]; line[o++] = bwd[i + 1] }
    line[o++] = sx; line[o++] = sy
    for (let i = 0; i < fwd.length; i += 2) { line[o++] = fwd[i]; line[o++] = fwd[i + 1] }
    gridAdd(g, sx, sy, id, 0)
    return line
  }

  const queue: Float32Array[] = []
  const grow = () => {
    while (queue.length) {
      const line = queue.shift()!
      for (let i = 0; i < line.length / 2; i += 2) {
        const x = line[i * 2]
        const y = line[i * 2 + 1]
        const j = Math.min(line.length / 2 - 1, i + 1)
        const k = Math.max(0, i - 1)
        let tx = line[j * 2] - line[k * 2]
        let ty = line[j * 2 + 1] - line[k * 2 + 1]
        const l = Math.hypot(tx, ty) || 1
        tx /= l; ty /= l
        for (const side of [1, -1]) {
          const cx = x - ty * d * side
          const cy = y + tx * d * side
          if (cx < 0 || cy < 0 || cx > wmm || cy > hmm || !alive(cx, cy)) continue
          if (!gridFree(g, cx, cy, d * 0.99, dead)) continue
          const nl = trace(cx, cy)
          if (nl) { out.push(nl); queue.push(nl) }
        }
      }
    }
  }
  // Seeds on a coarse grid catch every region the neighbours' seeds can't reach.
  const coarse = d * 3
  for (let y = coarse / 2; y < hmm; y += coarse) {
    for (let x = coarse / 2; x < wmm; x += coarse) {
      if (!alive(x, y) || !gridFree(g, x, y, d * 0.99, dead)) continue
      const l = trace(x, y)
      if (l) { out.push(l); queue.push(l); grow() }
    }
  }
  return out
}

// ---- widths and strips --------------------------------------------------------

/** Width (fraction of the spacing) of a layer's line for a remaining tone r. */
function layerWidth(r: number, p: LineBuild): number {
  const cap = 0.5 + 0.2 * p.swell
  const c = Math.min(r, cap)
  // Etching (low swell): the needle lays a line of nearly even width that stops in the
  // lights and thickens only as far as the bite allows in the darks.
  const even = cap * 0.55
  const drop = (1 - p.swell) * even * 0.5
  if (c <= drop) return 0
  // Lines thin out over a short ramp where a layer begins, instead of starting at full width.
  const ramp = Math.min(1, (c - drop) / 0.12)
  return Math.max(c, (even + (c - even) * p.swell) * ramp * ramp * (3 - 2 * ramp))
}

export function buildLines(field: ToneField, p: LineBuild): LineGeometry {
  const { w, h, k } = field
  const wmm = w / k
  const hmm = h / k
  const dir = directionField(field, p)
  const c2 = sampler(dir.c2, dir.w, dir.h, dir.k)
  const s2 = sampler(dir.s2, dir.w, dir.h, dir.k)
  const dark = sampler(dir.dark, w, h, k)
  const tones = field.inks.map((f) => sampler(f, w, h, k))
  const layers = p.mode === 'gouge' ? 1 : Math.max(1, Math.min(3, p.layers))
  const r = rng(p.seed)
  const taperMm = p.taper * 2.5

  // Tone of ink i as the lines see it (white mode: the paper between them).
  const toneOf = (i: number, x: number, y: number) => {
    const t = tones[i](x, y)
    return p.mode === 'white' ? 1 - t : t
  }
  const cap = 0.5 + 0.2 * p.swell
  const lo = p.gougeLow ?? 0.15
  const hi = p.gougeHigh ?? 0.5

  const runs: Array<{ pts: Float32Array; widths: Uint8Array }> = []
  let total = 0
  for (let L = 0; L < layers; L++) {
    const turn = (LAYER_TURN[L] * Math.PI) / 90 // doubled angle
    const ct = Math.cos(turn)
    const st = Math.sin(turn)
    const dirAt = (x: number, y: number): [number, number] => {
      const c = c2(x, y)
      const s = s2(x, y)
      return [c * ct - s * st, c * st + s * ct]
    }
    // A layer only runs where the tone needs it: layer L starts once the previous
    // layers are full.
    let need = 0.02
    for (let j = 0; j < L; j++) need = need + (1 - need) * cap
    const alive = p.mode === 'gouge'
      ? (x: number, y: number) => { const t = dark(x, y); return t > lo * 0.8 && t < hi * 1.1 }
      : p.mode === 'white'
        ? () => true
        : (x: number, y: number) => dark(x, y) > need * 0.9
    const lines = streamlines(wmm, hmm, p.spacingMm, dirAt, alive)
    total += lines.length
    for (const line of lines) {
      let n = line.length / 2
      // Arc length, for tapers and tremor.
      const s = new Float32Array(n)
      for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(line[i * 2] - line[i * 2 - 2], line[i * 2 + 1] - line[i * 2 - 1])
      const len = s[n - 1]
      const tremor = noise1(r, Math.ceil(len / 1.2) + 2)
      const widths = new Uint8Array(n * 4)
      const pts = new Float32Array(n * 2)
      for (let i = 0; i < n; i++) {
        const x = line[i * 2]
        const y = line[i * 2 + 1]
        let tip = 1
        if (taperMm > 0) tip = Math.min(1, s[i] / taperMm, (len - s[i]) / taperMm)
        tip = tip * tip * (3 - 2 * tip)
        for (let ink = 0; ink < Math.min(4, tones.length); ink++) {
          let wf: number
          if (p.mode === 'gouge') {
            const t = tones[ink](x, y)
            wf = Math.min(1, Math.max(0, (hi - t) / (hi - lo))) * 0.85
          } else {
            // Cascade: what the previous layers already cover, this one doesn't.
            let rem = toneOf(ink, x, y)
            for (let j = 0; j < L; j++) {
              const c = layerWidth(rem, p)
              rem = c >= 1 ? 0 : Math.max(0, (rem - c) / (1 - c))
            }
            wf = layerWidth(rem, p)
          }
          widths[i * 4 + ink] = Math.round(Math.min(1, wf * tip) * 255)
        }
        // The hand's tremor moves the line sideways (etching).
        let ox = 0
        let oy = 0
        if (p.tremorMm > 0) {
          const j = Math.min(n - 1, i + 1)
          const q = Math.max(0, i - 1)
          let tx = line[j * 2] - line[q * 2]
          let ty = line[j * 2 + 1] - line[q * 2 + 1]
          const l = Math.hypot(tx, ty) || 1
          tx /= l; ty /= l
          const m = tremor(s[i] / 1.2) * p.tremorMm
          ox = -ty * m
          oy = tx * m
        }
        pts[i * 2] = x + ox
        pts[i * 2 + 1] = y + oy
      }
      // Drop vertices the GPU can interpolate: nearly straight, nearly the same widths.
      const keep = new Uint8Array(n)
      keep[0] = 1
      keep[n - 1] = 1
      let last = 0
      for (let i = 1; i < n - 1; i++) {
        const ax = pts[i * 2] - pts[last * 2]
        const ay = pts[i * 2 + 1] - pts[last * 2 + 1]
        const bx = pts[i * 2 + 2] - pts[i * 2]
        const by = pts[i * 2 + 3] - pts[i * 2 + 1]
        const la = Math.hypot(ax, ay)
        const lb = Math.hypot(bx, by)
        const bend = la > 0 && lb > 0 ? 1 - (ax * bx + ay * by) / (la * lb) : 0
        let dw = 0
        for (let c = 0; c < 4; c++) dw = Math.max(dw, Math.abs(widths[i * 4 + c] - widths[last * 4 + c]))
        // bend 0.0006 ≈ 2°; widths within 6/255; never more than 3 mm between vertices.
        if (bend > 0.0006 || dw > 6 || la > 3) { keep[i] = 1; last = i }
      }
      let m = 0
      for (let i = 0; i < n; i++) {
        if (!keep[i]) continue
        pts[m * 2] = pts[i * 2]; pts[m * 2 + 1] = pts[i * 2 + 1]
        widths.copyWithin(m * 4, i * 4, i * 4 + 4)
        m++
      }
      n = m
      // Only the visible stretches are drawn (one vertex of margin so widths fade to 0).
      let start = -1
      const visible = (i: number) => widths[i * 4] + widths[i * 4 + 1] + widths[i * 4 + 2] + widths[i * 4 + 3] > 0
      for (let i = 0; i <= n; i++) {
        const v = i < n && visible(i)
        if (v && start < 0) start = Math.max(0, i - 1)
        if (!v && start >= 0) {
          const end = Math.min(n, i + 1)
          if (end - start >= 2) runs.push({ pts: pts.slice(start * 2, end * 2), widths: widths.slice(start * 4, end * 4) })
          start = -1
        }
      }
    }
  }

  // Triangle strips joined by degenerate triangles: 2 vertices per point, plus 2 per join.
  let count = 0
  for (const run of runs) count += (run.pts.length / 2) * 2 + 2
  const data = new ArrayBuffer(Math.max(1, count) * LINE_STRIDE)
  const f32 = new Float32Array(data)
  const u8 = new Uint8Array(data)
  let v = 0
  const put = (x: number, y: number, nx: number, ny: number, side: number, wd: Uint8Array, wi: number) => {
    const o = (v * LINE_STRIDE) / 4
    f32[o] = x; f32[o + 1] = y; f32[o + 2] = nx; f32[o + 3] = ny; f32[o + 4] = side
    u8.set(wd.subarray(wi * 4, wi * 4 + 4), v * LINE_STRIDE + 20)
    v++
  }
  for (const run of runs) {
    const n = run.pts.length / 2
    const normal = (i: number): [number, number] => {
      const j = Math.min(n - 1, i + 1)
      const q = Math.max(0, i - 1)
      let tx = run.pts[j * 2] - run.pts[q * 2]
      let ty = run.pts[j * 2 + 1] - run.pts[q * 2 + 1]
      const l = Math.hypot(tx, ty) || 1
      tx /= l; ty /= l
      return [-ty, tx]
    }
    for (let i = 0; i < n; i++) {
      const [nx, ny] = normal(i)
      const x = run.pts[i * 2]
      const y = run.pts[i * 2 + 1]
      if (i === 0) put(x, y, nx, ny, -1, run.widths, i)          // degenerate join in
      put(x, y, nx, ny, -1, run.widths, i)
      put(x, y, nx, ny, 1, run.widths, i)
      if (i === n - 1) put(x, y, nx, ny, 1, run.widths, i)       // degenerate join out
    }
  }
  return { data, vertices: v, lines: total }
}
