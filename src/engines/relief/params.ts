// The relief engine (docs/PLANNING.md §C.2 · relief): woodcut, linocut, letterpress
// and movable type. The raised surface takes the ink; what is cut away stays paper.
// The matrix is a cut through the simplified tone, kept as a distance to its edge
// in mm (φ, §C.1), so over-inking, wear, splinters and squash are offsets of φ:
//   surface   what the block is made of: wood (grain lines that hold less ink),
//             lino (fine isotropic mottle), metal type, photopolymer
//   splinter  edges break along the grain (anisotropic)
//   printing  a press (even) or a baren rubbed by hand (directional strokes)
//   squash    the ink pushed to the edge of each mark: a darker rim, a lighter middle
//   deboss    the plate pressed into the paper, seen in the raking light
//   pieces    movable type: every piece varies on its own (height, ink, baseline, wear)

import type { ParamDef, Params } from '../types'

const pct = (v: number) => `${v}%`
const deg = (v: number) => `${v}°`

export const RELIEF_PARAMS: ParamDef[] = [
  { id: 'threshold', type: 'number', labelKey: 'relief.threshold', hintKey: 'relief.thresholdHint', min: 10, max: 90, step: 1, default: 50, display: pct },
  {
    id: 'surface', type: 'enum', labelKey: 'relief.surface', hintKey: 'relief.surfaceHint', default: 'wood',
    options: [
      { value: 'wood', labelKey: 'surface.wood' },
      { value: 'lino', labelKey: 'surface.lino' },
      { value: 'metal', labelKey: 'surface.metal' },
      { value: 'polymer', labelKey: 'surface.polymer' },
    ],
  },
  { id: 'woodGrain', type: 'number', labelKey: 'relief.woodGrain', hintKey: 'relief.woodGrainHint', min: 0, max: 100, step: 1, default: 50, display: pct },
  { id: 'grainAngle', type: 'number', labelKey: 'relief.grainAngle', min: 0, max: 180, step: 1, default: 90, display: deg },
  { id: 'splinter', type: 'number', labelKey: 'relief.splinter', hintKey: 'relief.splinterHint', min: 0, max: 100, step: 1, default: 40, display: pct },
  {
    id: 'printing', type: 'enum', labelKey: 'relief.printing', hintKey: 'relief.printingHint', default: 'press',
    options: [
      { value: 'press', labelKey: 'printing.press' },
      { value: 'baren', labelKey: 'printing.baren' },
    ],
  },
  { id: 'squash', type: 'number', labelKey: 'relief.squash', hintKey: 'relief.squashHint', min: 0, max: 100, step: 1, default: 15, display: pct },
  { id: 'deboss', type: 'number', labelKey: 'relief.deboss', hintKey: 'relief.debossHint', min: 0, max: 100, step: 1, default: 15, display: pct },
  { id: 'gouges', type: 'number', labelKey: 'relief.gouges', hintKey: 'relief.gougesHint', min: 0, max: 100, step: 1, default: 0, display: pct },
  { id: 'pieces', type: 'number', labelKey: 'relief.pieces', hintKey: 'relief.piecesHint', min: 0, max: 100, step: 1, default: 0, display: pct },
]

export const SURFACE_INDEX = { wood: 0, lino: 1, metal: 2, polymer: 3 } as const

export interface ReliefUniforms {
  threshold: number      // 0..1: tone (dot %) above which the surface stays and prints
  surface: number        // SURFACE_INDEX
  woodGrain: number      // 0..1
  grainAngle: number     // degrees
  splinterMm: number     // reach of the splinters
  baren: boolean
  squash: number         // 0..1
  deboss: number         // 0..1
  pieces: number         // 0..1
  gouges: number         // 0..1: white cuts carry the mid tones (woodcut v2)
  gougeLow: number       // tone below which the block is cleared
  simplifyMm: number     // σ of the smoothing: the smallest detail the knife keeps
  growMm: number         // over-inking (+) closes counters, under-inking (−) thins marks
  roughMm: number        // ragged edges
}

/** Largest smoothing (DETALLE at 0 %): a wide gouge leaves no detail under ~2 mm. */
export const MAX_RELIEF_SIMPLIFY_MM = 2
/** Splinters at 100 %. */
const MAX_SPLINTER_MM = 0.35

export function resolveRelief(p: Params, u: { detail: number; pressure: number; roughness: number; ink: number }): ReliefUniforms {
  const surface = SURFACE_INDEX[String(p.surface) as keyof typeof SURFACE_INDEX] ?? 0
  // Ink and pressure spread the ink past the edge of the surface (or starve it).
  const growMm = 0.05 * (u.ink / 100 - 1) + 0.04 * (u.pressure / 50 - 1)
  return {
    threshold: Number(p.threshold) / 100,
    surface,
    woodGrain: surface === 0 ? Number(p.woodGrain) / 100 : 0,
    grainAngle: Number(p.grainAngle),
    splinterMm: (Number(p.splinter) / 100) * MAX_SPLINTER_MM,
    baren: p.printing === 'baren',
    squash: Number(p.squash) / 100,
    deboss: Number(p.deboss) / 100,
    pieces: Number(p.pieces) / 100,
    gouges: Number(p.gouges) / 100,
    // The more gouging, the deeper into the lights the block is kept (and cut).
    gougeLow: (Number(p.threshold) / 100) * (1 - 0.8 * (Number(p.gouges) / 100)),
    simplifyMm: (1 - u.detail / 100) * MAX_RELIEF_SIMPLIFY_MM,
    growMm,
    roughMm: (u.roughness / 100) * 0.12,
  }
}
