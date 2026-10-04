// The line engine's parameters (docs/PLANNING.md §C.2 · line, §E.2) and how they
// become the CPU geometry build (flow.ts) and the print uniforms. Engraving and
// etching are the same engine with a different stroke and impression:
//   engraving  the burin swells the line with the tone, enters and leaves tapered
//   etching    the needle draws an even line; tone comes from crosshatch layers;
//              the hand trembles a little
// Intaglio impression: plate tone (the film left by wiping), the plate mark and
// the ink standing in relief on the paper.

import type { ParamDef, Params } from '../types'
import type { LineBuild } from './flow'

const mm2 = (v: number) => `${(v / 100).toFixed(2).replace('.', ',')} mm`
const pct = (v: number) => `${v}%`

export const LINE_PARAMS: ParamDef[] = [
  { id: 'spacing', type: 'number', labelKey: 'line.spacing', hintKey: 'line.spacingHint', min: 20, max: 150, step: 1, default: 45, display: mm2 },
  { id: 'angle', type: 'number', labelKey: 'line.angle', hintKey: 'line.angleHint', min: 0, max: 180, step: 1, default: 30, display: (v) => `${v}°` },
  { id: 'follow', type: 'number', labelKey: 'line.follow', hintKey: 'line.followHint', min: 0, max: 100, step: 1, default: 70, display: pct },
  {
    id: 'layers', type: 'enum', labelKey: 'line.layers', hintKey: 'line.layersHint', default: '2',
    options: [{ value: '1', labelKey: 'levels.1' }, { value: '2', labelKey: 'levels.2' }, { value: '3', labelKey: 'levels.3' }],
  },
  { id: 'swell', type: 'number', labelKey: 'line.swell', hintKey: 'line.swellHint', min: 0, max: 100, step: 1, default: 85, display: pct },
  { id: 'taper', type: 'number', labelKey: 'line.taper', hintKey: 'line.taperHint', min: 0, max: 100, step: 1, default: 60, display: pct },
  {
    id: 'polarity', type: 'enum', labelKey: 'line.polarity', hintKey: 'line.polarityHint', default: 'black',
    options: [{ value: 'black', labelKey: 'polarity.black' }, { value: 'white', labelKey: 'polarity.white' }],
  },
  { id: 'plateTone', type: 'number', labelKey: 'line.plateTone', hintKey: 'line.plateToneHint', min: 0, max: 100, step: 1, default: 20, display: pct },
  { id: 'plateMargin', type: 'number', labelKey: 'line.plateMargin', hintKey: 'line.plateMarginHint', min: 0, max: 40, step: 1, default: 15, display: (v) => `${v} mm` },
  { id: 'inkRelief', type: 'number', labelKey: 'line.inkRelief', hintKey: 'line.inkReliefHint', min: 0, max: 100, step: 1, default: 40, display: pct },
]

/** What the composite needs to print lines (and the intaglio impression). */
export interface LineUniforms {
  white: boolean          // white lines (paper) on an inked plate
  spacingMm: number
  plateTone: number       // 0..1
  plateMarginMm: number   // 0 = no plate mark
  inkRelief: number       // 0..1
}

/** Hand tremor at ASPEREZA 100 %, mm. */
const MAX_TREMOR_MM = 0.12

export function resolveLine(p: Params, u: { detail: number; roughness: number }, seed: number): { build: LineBuild; print: LineUniforms } {
  const spacingMm = Number(p.spacing) / 100
  const white = p.polarity === 'white'
  return {
    build: {
      spacingMm,
      angleDeg: Number(p.angle),
      follow: Number(p.follow) / 100,
      layers: Number(p.layers) || 1,
      swell: Number(p.swell) / 100,
      taper: Number(p.taper) / 100,
      tremorMm: (u.roughness / 100) * MAX_TREMOR_MM,
      detail: u.detail / 100,
      mode: white ? 'white' : 'tone',
      seed,
    },
    print: {
      white,
      spacingMm,
      plateTone: Number(p.plateTone) / 100,
      plateMarginMm: Number(p.plateMargin),
      inkRelief: Number(p.inkRelief) / 100,
    },
  }
}
