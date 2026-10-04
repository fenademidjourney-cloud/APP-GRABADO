// Preset definitions (docs/PLANNING.md §E): a technique = an engine + starting values.
// Techniques whose engine isn't built yet have no entry: they print in continuous
// tone and keep the current inks and paper.

import type { EngineId, ParamDef, Params } from '../engines/types'
import { defaultsOf } from '../engines/types'
import { SCREEN_PARAMS } from '../engines/screen/params'
import type { InkMode, PaperSettings, Universal } from '../model/doc'
import type { ImperfectionId, ImperfectionSettings } from '../print/imperfections'
import type { TextKey } from '../i18n'
import type { ImpressionModel } from '../print/impression'

export type Range = [number, number]

/**
 * A style the dice (Variante) can land on (05-interaccion.md · "Sugerir"): ranges the
 * values are drawn from, choices for enums. What a style doesn't mention stays as it is.
 */
export interface VariantDef {
  nameKey: TextKey
  universal?: Partial<Record<keyof Universal, Range>>
  params?: Record<string, Range | string[]>
  imperfections?: ImperfectionId[]
  impAmount?: Range
}

export interface PresetDef {
  engine: EngineId
  /** How ink meets paper; without it, the catalogue's process family decides (print/impression.ts). */
  impression?: ImpressionModel
  params: Params
  universal: Partial<Universal>
  inkMode?: InkMode
  inks?: string[]
  paper?: PaperSettings
  /** Up to five controls on top of the Efecto panel (universal ids or engine params). */
  essentials: string[]
  /** Engine parameters in Avanzado. */
  advanced: string[]
  imperfections: ImperfectionSettings
  /** Styles the dice cycles through; each tap picks one other than the last. */
  variants: VariantDef[]
}

export const ENGINE_PARAMS: Record<EngineId, ParamDef[]> = {
  none: [],
  screen: SCREEN_PARAMS,
}

export const PRESETS: Record<string, PresetDef> = {
  // Newsprint: coarse round dots; soft absorbent paper gives ~20–25 % gain in the midtones.
  'newspaper-halftone': {
    engine: 'screen',
    impression: 'offset',
    params: { shape: 'round', lpi: 65, angle: 45, moire: 0, gain: 35, softness: 20, fmDot: 150 },
    universal: { contrast: 15, ink: 100, detail: 20, pressure: 55, roughness: 35, grain: 30, registration: 25 },
    inkMode: 'one',
    inks: ['#1d1d1b'],
    paper: { id: 'newsprint', texture: 85, light: 25 },
    essentials: ['lpi', 'detail', 'ink', 'pressure', 'contrast'],
    advanced: ['shape', 'angle', 'moire', 'gain', 'softness', 'roughness', 'grain', 'registration', 'fmDot'],
    imperfections: { amount: 45, enabled: ['pressure', 'starved', 'dust', 'wear'] },
    variants: [
      { nameKey: 'variant.newsWorn', params: { shape: ['round'], lpi: [50, 65], gain: [40, 60] }, universal: { pressure: [60, 80], roughness: [40, 65], grain: [50, 75], ink: [85, 105] }, imperfections: ['pressure', 'starved', 'dust', 'wear'], impAmount: [50, 75] },
      { nameKey: 'variant.newsClean', params: { shape: ['round', 'ellipse'], lpi: [75, 90], gain: [15, 30] }, universal: { pressure: [40, 55], roughness: [10, 25], grain: [20, 40], ink: [100, 115] }, imperfections: ['pressure', 'dust'], impAmount: [15, 30] },
      { nameKey: 'variant.newsCoarse', params: { shape: ['round', 'square'], lpi: [30, 42], gain: [25, 45] }, universal: { pressure: [50, 65], roughness: [25, 45], detail: [0, 20] }, imperfections: ['pressure', 'starved', 'dust'], impAmount: [30, 50] },
      { nameKey: 'variant.newsLine', params: { shape: ['line'], lpi: [40, 60], angle: [30, 60] }, universal: { pressure: [45, 65], roughness: [20, 40] }, imperfections: ['pressure', 'dust'], impAmount: [25, 45] },
    ],
  },
  // Magazine / book reproduction: fine chain (elliptical) dots, little gain, smooth paper.
  'editorial-halftone': {
    engine: 'screen',
    impression: 'offset',
    params: { shape: 'ellipse', lpi: 133, angle: 45, moire: 0, gain: 10, softness: 5, fmDot: 90 },
    universal: { contrast: 5, ink: 100, detail: 55, pressure: 45, roughness: 8, grain: 12, registration: 10 },
    inkMode: 'one',
    inks: ['#1d1d1b'],
    paper: { id: 'white', texture: 30, light: 15 },
    essentials: ['lpi', 'detail', 'ink', 'pressure', 'contrast'],
    advanced: ['shape', 'angle', 'moire', 'gain', 'softness', 'roughness', 'grain', 'registration', 'fmDot'],
    imperfections: { amount: 15, enabled: ['dust'] },
    variants: [
      { nameKey: 'variant.editorialChain', params: { shape: ['ellipse'], lpi: [120, 150], gain: [5, 15] }, universal: { detail: [45, 70], roughness: [0, 12] }, imperfections: ['dust'], impAmount: [5, 20] },
      { nameKey: 'variant.editorialSquare', params: { shape: ['square'], lpi: [85, 110], gain: [10, 20] }, universal: { detail: [30, 55], roughness: [5, 15] }, imperfections: ['dust'], impAmount: [10, 25] },
      { nameKey: 'variant.editorialCross', params: { shape: ['cross', 'diamond'], lpi: [60, 85], gain: [10, 25] }, universal: { detail: [20, 45], roughness: [5, 20] }, imperfections: ['dust', 'pressure'], impAmount: [15, 30] },
      { nameKey: 'variant.editorialFm', params: { shape: ['fm'], fmDot: [80, 160], gain: [5, 15] }, universal: { roughness: [0, 15], grain: [15, 35] }, imperfections: ['dust'], impAmount: [5, 20] },
    ],
  },
}

/**
 * Styles for techniques whose engine isn't built yet: they still print with the
 * impression model, so ink, pressure, grain, registration and imperfections change.
 */
export const GENERIC_VARIANTS: VariantDef[] = [
  { nameKey: 'variant.even', universal: { ink: [100, 115], pressure: [50, 65], grain: [15, 30], registration: [5, 20] }, imperfections: ['dust'], impAmount: [10, 25] },
  { nameKey: 'variant.heavy', universal: { ink: [120, 145], pressure: [70, 90], grain: [35, 55], contrast: [10, 30] }, imperfections: ['pressure', 'dust'], impAmount: [25, 45] },
  { nameKey: 'variant.starved', universal: { ink: [65, 85], pressure: [20, 40], grain: [55, 80] }, imperfections: ['pressure', 'starved', 'wear'], impAmount: [50, 75] },
  { nameKey: 'variant.offRegister', universal: { registration: [60, 95], grain: [30, 50], pressure: [45, 60] }, imperfections: ['pressure', 'starved', 'dust'], impAmount: [30, 50] },
  { nameKey: 'variant.aged', universal: { ink: [85, 100], grain: [40, 60], contrast: [-15, 0] }, imperfections: ['pressure', 'dust', 'wear', 'stains'], impAmount: [45, 70] },
]

export function variantsOf(technique: string): VariantDef[] {
  return PRESETS[technique]?.variants ?? GENERIC_VARIANTS
}

export function engineOf(technique: string): EngineId {
  return PRESETS[technique]?.engine ?? 'none'
}

export function presetParams(technique: string): Params {
  const def = PRESETS[technique]
  return def ? { ...defaultsOf(ENGINE_PARAMS[def.engine]), ...def.params } : {}
}
