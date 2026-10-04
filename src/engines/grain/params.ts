// The grain engine (docs/PLANNING.md §C.2 · grain): stone lithography. The tone is
// held by a stochastic grain with a physical character (analysis/grainTiles.ts):
// ink where the tone rises above the grain's threshold. Because each tile is
// histogram-equalised, the inked share equals the tone: rich tone, no bands.
//   medium   crayon on grained stone · tusche wash (reticulation) · crachis (spatter)
//   stroke   the crayon's direction: the grain stretches and bands along the stroke
//   scum     planographic scumming: grease catching on the stone's open grain

import type { ParamDef, Params } from '../types'
import type { GrainKind } from '../../analysis/grainTiles'

const pct = (v: number) => `${v}%`
const um = (v: number) => `${(v / 1000).toFixed(2).replace('.', ',')} mm`

export const GRAIN_PARAMS: ParamDef[] = [
  {
    id: 'medium', type: 'enum', labelKey: 'grain.medium', hintKey: 'grain.mediumHint', default: 'crayon',
    options: [
      { value: 'crayon', labelKey: 'medium.crayon' },
      { value: 'tusche', labelKey: 'medium.tusche' },
      { value: 'crachis', labelKey: 'medium.crachis' },
    ],
  },
  { id: 'grainSize', type: 'number', labelKey: 'grain.size', hintKey: 'grain.sizeHint', min: 30, max: 300, step: 5, default: 110, display: um },
  { id: 'stroke', type: 'number', labelKey: 'grain.stroke', hintKey: 'grain.strokeHint', min: 0, max: 100, step: 1, default: 35, display: pct },
  { id: 'strokeAngle', type: 'number', labelKey: 'grain.strokeAngle', min: 0, max: 180, step: 1, default: 60, display: (v) => `${v}°` },
  { id: 'scum', type: 'number', labelKey: 'grain.scum', hintKey: 'grain.scumHint', min: 0, max: 100, step: 1, default: 15, display: pct },
]

export interface GrainUniforms {
  kind: GrainKind
  cellMm: number        // one tile pixel, mm
  stroke: number        // 0..1
  strokeAngle: number   // degrees
  sharp: number         // 0..1: crisp grain (broken crayon) vs soft
  scum: number          // 0..1
  simplifyMm: number    // σ of the tone smoothing
}

/** Tile pixels per tile side (analysis/grainTiles.ts). */
export const GRAIN_TILE = 512
/** Largest tone smoothing (DETALLE 0 %), mm. */
export const MAX_GRAIN_SIMPLIFY_MM = 1

const KIND: Record<string, GrainKind> = { crayon: 'stone', tusche: 'tusche', crachis: 'spatter' }

export function resolveGrain(p: Params, u: { detail: number; roughness: number }): GrainUniforms {
  return {
    kind: KIND[String(p.medium)] ?? 'stone',
    // grainSize is the size of one tooth (≈ 6 tile pixels), in µm.
    cellMm: Number(p.grainSize) / 1000 / 6,
    stroke: p.medium === 'crayon' ? Number(p.stroke) / 100 : 0,
    strokeAngle: Number(p.strokeAngle),
    sharp: u.roughness / 100,
    scum: Number(p.scum) / 100,
    simplifyMm: (1 - u.detail / 100) * MAX_GRAIN_SIMPLIFY_MM,
  }
}
