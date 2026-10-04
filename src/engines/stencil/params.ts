// The stencil engine (docs/PLANNING.md §C.2 · stencil): screenprint and risograph.
// Each ink is a stencil cut from its own plate (the separation or the layers sent
// to that ink); how the stencil holds the tone is the "fill":
//   solid  flat colour — the tone is simplified and cut into a few levels (pop
//          screenprint, photographic key on lith film)
//   am     halftone dots, built on the master's grid (riso) or the mesh (screen)
//   fm     stochastic grain (riso "grain" mode)
// Parameters are in print units: lpi, dpi of the master, threads per cm of the mesh.

import type { ParamDef, Params } from '../types'
import { SHAPE_INDEX, spotLut, type DotShape } from '../screen/spot'
import { screenAngles, type ScreenUniforms } from '../screen/params'

const mm = (um: number) => `${(um / 1000).toFixed(2).replace('.', ',')} mm`

export const STENCIL_PARAMS: ParamDef[] = [
  {
    id: 'fill', type: 'enum', labelKey: 'stencil.fill', hintKey: 'stencil.fillHint', default: 'am',
    options: [
      { value: 'solid', labelKey: 'fill.solid' },
      { value: 'am', labelKey: 'fill.am' },
      { value: 'fm', labelKey: 'fill.fm' },
    ],
  },
  {
    id: 'levels', type: 'enum', labelKey: 'stencil.levels', hintKey: 'stencil.levelsHint', default: 'cont',
    options: [
      { value: 'cont', labelKey: 'levels.cont' },
      { value: '2', labelKey: 'levels.2' },
      { value: '3', labelKey: 'levels.3' },
      { value: '4', labelKey: 'levels.4' },
      { value: '5', labelKey: 'levels.5' },
    ],
  },
  { id: 'lpi', type: 'number', labelKey: 'screen.lpi', hintKey: 'screen.lpiHint', min: 10, max: 150, step: 1, default: 60, display: (v) => `${v} lpi` },
  { id: 'angle', type: 'number', labelKey: 'screen.angle', hintKey: 'screen.angleHint', min: 0, max: 90, step: 1, default: 45, display: (v) => `${v}°` },
  { id: 'fmDot', type: 'number', labelKey: 'stencil.fmDot', hintKey: 'stencil.fmDotHint', min: 60, max: 500, step: 5, default: 130, display: mm },
  { id: 'gain', type: 'number', labelKey: 'screen.gain', hintKey: 'screen.gainHint', min: 0, max: 100, step: 1, default: 25, display: mm },
  { id: 'filmGrain', type: 'number', labelKey: 'stencil.filmGrain', hintKey: 'stencil.filmGrainHint', min: 0, max: 100, step: 1, default: 0, display: (v) => `${v}%` },
  { id: 'masterDpi', type: 'number', labelKey: 'stencil.master', hintKey: 'stencil.masterHint', min: 200, max: 600, step: 100, default: 600, display: (v) => `${v} dpi` },
  { id: 'mesh', type: 'number', labelKey: 'stencil.mesh', hintKey: 'stencil.meshHint', min: 40, max: 200, step: 5, default: 90, display: (v) => `${v} hilos/cm` },
  { id: 'maxDensity', type: 'number', labelKey: 'stencil.maxDensity', hintKey: 'stencil.maxDensityHint', min: 50, max: 100, step: 1, default: 100, display: (v) => `${v}%` },
]

/** What carries the stencil: the riso master (thermal head dots) or the screen mesh. */
export type StencilCarrier = 'master' | 'mesh'

export interface StencilUniforms {
  fill: 0 | 1 | 2           // solid · am · fm
  levels: number            // 0 = continuous, else 2..5
  simplifyMm: number        // σ of the smoothing before cutting the stencil
  filmGrain: number         // 0..1
  gridMm: number            // pitch of the master's dots / the mesh's openings
  gridAngle: number         // degrees: masters are square to the sheet, meshes a little off
  maxDensity: number        // 0..1: riso solids never reach a full film
}

/** Largest smoothing (DETALLE at 0 %), in mm. */
export const MAX_SIMPLIFY_MM = 1.5
/** A mesh is stretched a little off square so it doesn't beat with the image. */
const MESH_ANGLE = 7

const lutCache = new Map<DotShape, Float32Array>()

export function resolveStencil(p: Params, u: { detail: number; pressure: number; roughness: number }, inkCount: number, carrier: StencilCarrier): { stencil: StencilUniforms; screen?: ScreenUniforms } {
  const fill = p.fill === 'solid' ? 0 : p.fill === 'fm' ? 2 : 1
  const levels = p.levels === 'cont' ? 0 : Number(p.levels)
  const gridMm = carrier === 'master' ? 25.4 / Number(p.masterDpi) : 10 / Number(p.mesh)
  const stencil: StencilUniforms = {
    fill,
    levels: Number.isFinite(levels) ? levels : 0,
    simplifyMm: (1 - u.detail / 100) * MAX_SIMPLIFY_MM,
    filmGrain: Number(p.filmGrain) / 100,
    gridMm,
    gridAngle: carrier === 'master' ? 0 : MESH_ANGLE,
    maxDensity: Number(p.maxDensity) / 100,
  }
  if (fill === 0) return { stencil }
  if (!lutCache.has('round')) lutCache.set('round', spotLut('round'))
  const fmDotMm = Number(p.fmDot) / 1000
  let gainMm = (Number(p.gain) / 1000) * (u.pressure / 50)
  if (fill === 2) gainMm = Math.min(gainMm, 0.12 * fmDotMm)
  const screen: ScreenUniforms = {
    fm: fill === 2,
    shape: SHAPE_INDEX.round,
    lut: lutCache.get('round')!,
    lpi: Number(p.lpi),
    angles: screenAngles(Number(p.angle), 0, inkCount),
    gainMm,
    softMm: 0.01,
    roughness: u.roughness / 100,
    detail: 0,
    fmDotMm,
  }
  return { stencil, screen }
}
