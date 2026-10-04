// The screen engine's parameters, in print units (lpi, degrees, µm), and how they
// turn into what the shader needs (docs/PLANNING.md §C.2, §E.2).

import type { ParamDef, Params } from '../types'
import { SHAPE_INDEX, spotLut, type DotShape } from './spot'

const mm = (um: number) => `${(um / 1000).toFixed(2).replace('.', ',')} mm`

export const SCREEN_PARAMS: ParamDef[] = [
  {
    id: 'shape', type: 'enum', labelKey: 'screen.shape', default: 'round',
    options: [
      { value: 'round', labelKey: 'shape.round' },
      { value: 'ellipse', labelKey: 'shape.ellipse' },
      { value: 'square', labelKey: 'shape.square' },
      { value: 'line', labelKey: 'shape.line' },
      { value: 'cross', labelKey: 'shape.cross' },
      { value: 'diamond', labelKey: 'shape.diamond' },
      { value: 'fm', labelKey: 'shape.fm' },
    ],
  },
  { id: 'lpi', type: 'number', labelKey: 'screen.lpi', hintKey: 'screen.lpiHint', min: 10, max: 200, step: 1, default: 85, display: (v) => `${v} lpi` },
  { id: 'angle', type: 'number', labelKey: 'screen.angle', hintKey: 'screen.angleHint', min: 0, max: 90, step: 1, default: 45, display: (v) => `${v}°` },
  { id: 'moire', type: 'number', labelKey: 'screen.moire', hintKey: 'screen.moireHint', min: 0, max: 100, step: 1, default: 0, display: (v) => `${v}%` },
  { id: 'gain', type: 'number', labelKey: 'screen.gain', hintKey: 'screen.gainHint', min: 0, max: 100, step: 1, default: 20, display: mm },
  { id: 'softness', type: 'number', labelKey: 'screen.softness', min: 0, max: 200, step: 5, default: 10, display: mm },
  { id: 'fmDot', type: 'number', labelKey: 'screen.fmDot', hintKey: 'screen.fmDotHint', min: 40, max: 600, step: 5, default: 150, display: mm },
]

/**
 * Screen angles per ink. The classic sets keep inks 30° (or 15° for yellow) apart so
 * rosettes don't beat into moiré: K 45 · C 15 · M 75 · Y 0. They rotate with the base
 * angle; "Moiré" pulls them together on purpose.
 */
const STANDARD_ANGLES: Record<number, number[]> = {
  1: [45],
  2: [45, 75],
  3: [15, 75, 0],
  4: [15, 75, 0, 45],
  5: [15, 75, 0, 45, 30],
  6: [15, 75, 0, 45, 30, 60],
}

export function screenAngles(base: number, moire: number, inkCount: number): number[] {
  const set = STANDARD_ANGLES[Math.max(1, Math.min(6, inkCount))]
  const m = Math.max(0, Math.min(1, moire / 100))
  return set.map((a, k) => {
    const standard = a + (base - 45)
    const beat = base + k * 2.5 // nearly the same angle: deliberate moiré
    return standard * (1 - m) + beat * m
  })
}

export interface ScreenUniforms {
  fm: boolean
  shape: number
  lut: Float32Array
  lpi: number
  angles: number[]       // degrees, per ink
  gainMm: number
  softMm: number
  roughness: number      // 0..1
  detail: number         // 0 = tone at the cell centre (classic) · 1 = tone per pixel
  fmDotMm: number
}

const lutCache = new Map<DotShape, Float32Array>()

export function resolveScreen(p: Params, u: { detail: number; pressure: number; roughness: number }, inkCount: number): ScreenUniforms {
  const shape = String(p.shape) as DotShape | 'fm'
  const s: DotShape = shape === 'fm' ? 'round' : shape
  if (!lutCache.has(s)) lutCache.set(s, spotLut(s))
  // Pressure scales the dot gain: 50 % is the preset's own value, 100 % doubles it.
  const fm = shape === 'fm'
  const fmDotMm = Number(p.fmDot) / 1000
  // FM dots are tiny: the same gain in mm would swallow them, so it stays a share of the dot.
  let gainMm = (Number(p.gain) / 1000) * (u.pressure / 50)
  if (fm) gainMm = Math.min(gainMm, 0.12 * fmDotMm)
  return {
    fm,
    shape: SHAPE_INDEX[s],
    lut: lutCache.get(s)!,
    lpi: Number(p.lpi),
    angles: screenAngles(Number(p.angle), Number(p.moire), inkCount),
    gainMm,
    softMm: Number(p.softness) / 1000,
    roughness: u.roughness / 100,
    detail: u.detail / 100,
    fmDotMm,
  }
}

/** Size of one screen cell (or one FM dot) in mm: what decides if the preview can show it. */
export function screenCellMm(p: Params): number {
  return String(p.shape) === 'fm' ? Number(p.fmDot) / 1000 : 25.4 / Number(p.lpi)
}
