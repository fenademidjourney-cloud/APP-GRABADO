// Preset definitions (docs/PLANNING.md §E): a technique = an engine + starting values.
// Techniques whose engine isn't built yet have no entry: they print in continuous
// tone and keep the current inks and paper.

import type { EngineId, ParamDef, Params } from '../engines/types'
import { defaultsOf } from '../engines/types'
import { SCREEN_PARAMS } from '../engines/screen/params'
import type { InkMode, PaperSettings, Universal } from '../model/doc'

export interface PresetDef {
  engine: EngineId
  params: Params
  universal: Partial<Universal>
  inkMode?: InkMode
  inks?: string[]
  paper?: PaperSettings
  /** Up to five controls on top of the Efecto panel (universal ids or engine params). */
  essentials: string[]
  /** Engine parameters in Avanzado. */
  advanced: string[]
}

export const ENGINE_PARAMS: Record<EngineId, ParamDef[]> = {
  none: [],
  screen: SCREEN_PARAMS,
}

export const PRESETS: Record<string, PresetDef> = {
  // Newsprint: coarse round dots; soft absorbent paper gives ~20–25 % gain in the midtones.
  'newspaper-halftone': {
    engine: 'screen',
    params: { shape: 'round', lpi: 65, angle: 45, moire: 0, gain: 35, softness: 20, fmDot: 150 },
    universal: { contrast: 15, ink: 100, detail: 20, pressure: 55, roughness: 35 },
    inkMode: 'one',
    inks: ['#1d1d1b'],
    paper: { id: 'newsprint', texture: 85 },
    essentials: ['lpi', 'detail', 'ink', 'pressure', 'contrast'],
    advanced: ['shape', 'angle', 'moire', 'gain', 'softness', 'roughness', 'fmDot'],
  },
  // Magazine / book reproduction: fine chain (elliptical) dots, little gain, smooth paper.
  'editorial-halftone': {
    engine: 'screen',
    params: { shape: 'ellipse', lpi: 133, angle: 45, moire: 0, gain: 10, softness: 5, fmDot: 90 },
    universal: { contrast: 5, ink: 100, detail: 55, pressure: 45, roughness: 8 },
    inkMode: 'one',
    inks: ['#1d1d1b'],
    paper: { id: 'white', texture: 30 },
    essentials: ['lpi', 'detail', 'ink', 'pressure', 'contrast'],
    advanced: ['shape', 'angle', 'moire', 'gain', 'softness', 'roughness', 'fmDot'],
  },
}

export function engineOf(technique: string): EngineId {
  return PRESETS[technique]?.engine ?? 'none'
}

export function presetParams(technique: string): Params {
  const def = PRESETS[technique]
  return def ? { ...defaultsOf(ENGINE_PARAMS[def.engine]), ...def.params } : {}
}
