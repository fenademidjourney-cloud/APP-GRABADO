// Registration (docs/PLANNING.md §C.3 · 1): each ink is a separate pass, and no pass
// lands exactly where the previous one did. Per ink, an affine shift (dx, dy in mm)
// and a small rotation about the sheet centre, applied to the coordinates the plate
// is read with: nothing is resampled. The first ink is the reference (the press
// registers the others to it); the drift comes from the seed's own stream.

import { streamRng } from '../util/seed'

export interface InkRegistration {
  dx: number   // mm
  dy: number   // mm
  rot: number  // degrees
}

/** At 100 %: the largest shift (mm) and turn (degrees) of a pass. A hand-fed press is ~0.5 mm off. */
export const MAX_SHIFT_MM = 1.2
export const MAX_TURN_DEG = 0.25

export function registrationOffsets(seed: number, amount: number, inkCount: number): InkRegistration[] {
  const r = streamRng(seed, 'registration')
  const a = Math.max(0, Math.min(1, amount / 100))
  return Array.from({ length: inkCount }, (_, k) => {
    // Draw for every ink even when unused, so ink k's offset doesn't depend on the amount.
    const ang = r() * Math.PI * 2
    const len = 0.4 + 0.6 * r()
    const turn = r() * 2 - 1
    if (k === 0 || a === 0) return { dx: 0, dy: 0, rot: 0 }
    return { dx: Math.cos(ang) * len * MAX_SHIFT_MM * a, dy: Math.sin(ang) * len * MAX_SHIFT_MM * a, rot: turn * MAX_TURN_DEG * a }
  })
}

/** Largest distance (mm) a point of any plate moves on a sheet of this size. */
export function maxDisplacementMm(regs: InkRegistration[], sheet: { widthMm: number; heightMm: number }): number {
  const radius = Math.hypot(sheet.widthMm, sheet.heightMm) / 2
  return regs.reduce((m, g) => Math.max(m, Math.hypot(g.dx, g.dy) + Math.abs((g.rot * Math.PI) / 180) * radius), 0)
}
