// Preset definitions (docs/PLANNING.md §E): a technique = an engine + starting values.
// Techniques whose engine isn't built yet have no entry: they print in continuous
// tone and keep the current inks and paper.

import type { EngineId, ParamDef, Params } from '../engines/types'
import { defaultsOf } from '../engines/types'
import { SCREEN_PARAMS } from '../engines/screen/params'
import { STENCIL_PARAMS } from '../engines/stencil/params'
import { RELIEF_PARAMS } from '../engines/relief/params'
import { LINE_PARAMS } from '../engines/line/params'
import { GRAIN_PARAMS } from '../engines/grain/params'
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
  /** Per ink, 0..100: how much each pass covers what's under it (screenprint ink is opaque). */
  inkOpacity?: number[]
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
  stencil: STENCIL_PARAMS,
  relief: RELIEF_PARAMS,
  line: LINE_PARAMS,
  grain: GRAIN_PARAMS,
}

const LINE_ADVANCED = ['angle', 'follow', 'layers', 'swell', 'taper', 'polarity', 'plateTone', 'plateMargin', 'inkRelief', 'roughness', 'grain', 'registration']

const RELIEF_ADVANCED = ['surface', 'woodGrain', 'grainAngle', 'splinter', 'gouges', 'printing', 'squash', 'deboss', 'pieces', 'roughness', 'grain', 'registration']

const RISO_ADVANCED = ['fill', 'levels', 'angle', 'gain', 'maxDensity', 'masterDpi', 'pressure', 'roughness', 'grain', 'filmGrain']
const SCREEN_ADVANCED = ['fill', 'levels', 'lpi', 'angle', 'gain', 'mesh', 'pressure', 'roughness', 'grain', 'filmGrain', 'fmDot']

export const PRESETS: Record<string, PresetDef> = {
  // Stone lithography: crayon drawn on a grained limestone; the grease catches on the
  // tooth, so every tone is built from grain. Planographic: even contact, a slightly
  // soft edge, a little scumming.
  'stone-lithography': {
    engine: 'grain',
    impression: 'planographic',
    params: { medium: 'crayon', grainSize: 110, stroke: 35, strokeAngle: 60, scum: 15 },
    universal: { contrast: 10, ink: 100, detail: 70, pressure: 50, roughness: 40, grain: 25, registration: 15 },
    inkMode: 'one',
    inks: ['#231f1c'],
    inkOpacity: [0],
    paper: { id: 'ivory', texture: 50, light: 25 },
    essentials: ['grainSize', 'detail', 'ink', 'contrast', 'medium'],
    advanced: ['stroke', 'strokeAngle', 'scum', 'roughness', 'pressure', 'grain', 'registration'],
    imperfections: { amount: 20, enabled: ['pressure', 'dust'] },
    variants: [
      { nameKey: 'variant.lithoFine', params: { medium: ['crayon'], grainSize: [60, 90], stroke: [10, 30] }, universal: { roughness: [20, 40], detail: [70, 90] }, imperfections: ['pressure', 'dust'], impAmount: [10, 25] },
      { nameKey: 'variant.lithoCoarse', params: { medium: ['crayon'], grainSize: [150, 240], stroke: [40, 75] }, universal: { roughness: [45, 75] }, imperfections: ['pressure', 'dust'], impAmount: [20, 35] },
      { nameKey: 'variant.lithoTusche', params: { medium: ['tusche'], grainSize: [120, 220], scum: [10, 30] }, universal: { detail: [55, 80], roughness: [30, 60] }, imperfections: ['pressure', 'dust', 'stains'], impAmount: [20, 40] },
      { nameKey: 'variant.lithoCrachis', params: { medium: ['crachis'], grainSize: [150, 260], scum: [0, 15] }, universal: { detail: [60, 85], roughness: [50, 80] }, imperfections: ['pressure', 'dust'], impAmount: [15, 30] },
    ],
  },
  // Copperplate engraving: the burin ploughs clean lines that swell with the tone,
  // enter and leave tapered, wrap around the forms and cross in the shadows; printed
  // from a wiped plate on damp paper, which keeps the plate mark.
  'copperplate-engraving': {
    engine: 'line',
    impression: 'intaglio',
    params: { spacing: 40, angle: 30, follow: 75, layers: '2', swell: 90, taper: 70, polarity: 'black', plateTone: 15, plateMargin: 15, inkRelief: 45 },
    universal: { contrast: 15, ink: 100, detail: 55, pressure: 60, roughness: 0, grain: 15, registration: 10 },
    inkMode: 'one',
    inks: ['#1d1d1b'],
    inkOpacity: [0],
    paper: { id: 'cotton', texture: 65, light: 40 },
    essentials: ['spacing', 'detail', 'ink', 'contrast', 'follow'],
    advanced: LINE_ADVANCED,
    imperfections: { amount: 15, enabled: ['dust'] },
    variants: [
      { nameKey: 'variant.burinFine', params: { spacing: [28, 36], layers: ['2'], swell: [85, 100], follow: [65, 85] }, universal: { detail: [55, 75] }, imperfections: ['dust'], impAmount: [5, 20] },
      { nameKey: 'variant.burinBold', params: { spacing: [50, 70], layers: ['1', '2'], swell: [90, 100], taper: [60, 90] }, universal: { detail: [40, 60], contrast: [15, 30] }, imperfections: ['dust'], impAmount: [10, 25] },
      { nameKey: 'variant.burinStraight', params: { spacing: [35, 50], follow: [0, 20], angle: [20, 70], layers: ['2', '3'] }, universal: { detail: [50, 70] }, imperfections: ['dust'], impAmount: [5, 20] },
      { nameKey: 'variant.burinPlate', params: { spacing: [35, 50], plateTone: [35, 60], inkRelief: [50, 80] }, universal: { pressure: [60, 80] }, imperfections: ['dust', 'pressure'], impAmount: [15, 30] },
    ],
  },
  // Etching: a needle draws through the ground and acid bites even lines; tone is
  // built by crosshatching; the line wavers with the hand; more plate tone.
  etching: {
    engine: 'line',
    impression: 'intaglio',
    params: { spacing: 45, angle: 40, follow: 55, layers: '3', swell: 25, taper: 10, polarity: 'black', plateTone: 30, plateMargin: 15, inkRelief: 30 },
    universal: { contrast: 15, ink: 100, detail: 50, pressure: 60, roughness: 45, grain: 25, registration: 10 },
    inkMode: 'one',
    inks: ['#2a2420'],
    inkOpacity: [0],
    paper: { id: 'cream', texture: 70, light: 35 },
    essentials: ['spacing', 'detail', 'ink', 'contrast', 'layers'],
    advanced: LINE_ADVANCED,
    imperfections: { amount: 25, enabled: ['pressure', 'dust'] },
    variants: [
      { nameKey: 'variant.etchLoose', params: { spacing: [50, 75], swell: [10, 30], follow: [30, 55] }, universal: { roughness: [55, 85] }, imperfections: ['dust', 'pressure'], impAmount: [20, 40] },
      { nameKey: 'variant.etchDense', params: { spacing: [28, 38], layers: ['3'], swell: [20, 40] }, universal: { roughness: [25, 45], detail: [55, 75] }, imperfections: ['dust'], impAmount: [10, 25] },
      { nameKey: 'variant.etchToned', params: { plateTone: [50, 80], spacing: [40, 55] }, universal: { roughness: [35, 55] }, imperfections: ['dust', 'pressure', 'stains'], impAmount: [25, 45] },
      { nameKey: 'variant.etchStraight', params: { follow: [0, 15], angle: [30, 60], layers: ['2', '3'] }, universal: { roughness: [30, 50] }, imperfections: ['dust', 'pressure'], impAmount: [15, 30] },
    ],
  },
  // Woodcut: plank wood cut with knife and gouges, printed by rubbing a baren: strong
  // masses, grain in the solids, edges that splinter along the grain.
  woodcut: {
    engine: 'relief',
    impression: 'relief',
    params: { threshold: 50, surface: 'wood', woodGrain: 55, grainAngle: 90, splinter: 45, gouges: 45, printing: 'baren', squash: 10, deboss: 15, pieces: 0 },
    universal: { contrast: 20, ink: 100, detail: 45, pressure: 50, roughness: 35, grain: 45, registration: 25 },
    inkMode: 'one',
    inks: ['#1d1d1b'],
    inkOpacity: [0],
    paper: { id: 'ivory', texture: 70, light: 30 },
    essentials: ['threshold', 'detail', 'ink', 'pressure', 'contrast'],
    advanced: RELIEF_ADVANCED,
    imperfections: { amount: 35, enabled: ['pressure', 'starved', 'dust'] },
    variants: [
      { nameKey: 'variant.woodBold', params: { gouges: [0, 20], threshold: [40, 55], woodGrain: [40, 60], splinter: [35, 60], printing: ['baren'] }, universal: { detail: [25, 45], roughness: [30, 50], contrast: [15, 35] }, imperfections: ['pressure', 'starved', 'dust'], impAmount: [30, 50] },
      { nameKey: 'variant.woodGrainy', params: { gouges: [30, 60], woodGrain: [70, 95], grainAngle: [80, 100], splinter: [40, 70] }, universal: { detail: [40, 60], grain: [50, 75] }, imperfections: ['pressure', 'starved'], impAmount: [30, 50] },
      { nameKey: 'variant.woodPress', params: { gouges: [55, 85], printing: ['press'], woodGrain: [25, 45], splinter: [20, 40] }, universal: { detail: [50, 70], roughness: [15, 30] }, imperfections: ['pressure', 'dust'], impAmount: [15, 30] },
      { nameKey: 'variant.woodWorn', params: { woodGrain: [50, 80], splinter: [55, 85], printing: ['baren'] }, universal: { ink: [75, 95], pressure: [30, 45], grain: [60, 85] }, imperfections: ['pressure', 'starved', 'dust', 'wear'], impAmount: [50, 75] },
    ],
  },
  // Linocut: isotropic linoleum, soft curves, clean edges and a fine mottle in the solids.
  linocut: {
    engine: 'relief',
    impression: 'relief',
    params: { threshold: 50, surface: 'lino', woodGrain: 0, grainAngle: 90, splinter: 8, printing: 'press', squash: 15, deboss: 20, pieces: 0 },
    universal: { contrast: 15, ink: 100, detail: 55, pressure: 50, roughness: 15, grain: 40, registration: 25 },
    inkMode: 'one',
    inks: ['#1d1d1b'],
    inkOpacity: [0],
    paper: { id: 'cream', texture: 60, light: 25 },
    essentials: ['threshold', 'detail', 'ink', 'pressure', 'contrast'],
    advanced: RELIEF_ADVANCED,
    imperfections: { amount: 30, enabled: ['pressure', 'starved', 'dust'] },
    variants: [
      { nameKey: 'variant.linoClean', params: { threshold: [45, 55], splinter: [0, 10], printing: ['press'] }, universal: { detail: [55, 75], roughness: [5, 15] }, imperfections: ['pressure', 'dust'], impAmount: [10, 25] },
      { nameKey: 'variant.linoBold', params: { threshold: [38, 50] }, universal: { detail: [25, 45], contrast: [20, 40] }, imperfections: ['pressure', 'starved', 'dust'], impAmount: [25, 45] },
      { nameKey: 'variant.linoBaren', params: { printing: ['baren'], splinter: [5, 20] }, universal: { detail: [45, 65], pressure: [35, 50], grain: [50, 70] }, imperfections: ['pressure', 'starved'], impAmount: [30, 50] },
      { nameKey: 'variant.linoHeavy', params: { squash: [25, 45] }, universal: { ink: [120, 145], pressure: [65, 85] }, imperfections: ['pressure', 'dust'], impAmount: [20, 35] },
    ],
  },
  // Letterpress today: crisp photopolymer plates driven deep into thick cotton paper.
  letterpress: {
    engine: 'relief',
    impression: 'relief',
    params: { threshold: 50, surface: 'polymer', woodGrain: 0, grainAngle: 90, splinter: 0, printing: 'press', squash: 25, deboss: 75, pieces: 0 },
    universal: { contrast: 10, ink: 100, detail: 92, pressure: 60, roughness: 5, grain: 25, registration: 15 },
    inkMode: 'one',
    inks: ['#2e3f8f'],
    inkOpacity: [0],
    paper: { id: 'cotton', texture: 85, light: 55 },
    essentials: ['threshold', 'detail', 'ink', 'pressure', 'contrast'],
    advanced: RELIEF_ADVANCED,
    imperfections: { amount: 15, enabled: ['dust'] },
    variants: [
      { nameKey: 'variant.lpDeep', params: { deboss: [75, 100], squash: [20, 35] }, universal: { pressure: [60, 80] }, imperfections: ['dust'], impAmount: [5, 20] },
      { nameKey: 'variant.lpKiss', params: { deboss: [5, 20], squash: [15, 30] }, universal: { pressure: [40, 55] }, imperfections: ['dust'], impAmount: [5, 20] },
      { nameKey: 'variant.lpBlind', params: { deboss: [85, 100], squash: [0, 10] }, universal: { ink: [15, 35], pressure: [70, 90] }, imperfections: [], impAmount: [0, 10] },
      { nameKey: 'variant.lpHeavy', params: { deboss: [50, 75], squash: [35, 55] }, universal: { ink: [115, 140], pressure: [60, 80], grain: [35, 55] }, imperfections: ['dust', 'pressure'], impAmount: [15, 30] },
    ],
  },
  // Movable type: every piece is its own block — heights, inking and wear vary piece
  // by piece; a kiss impression, a darker rim of squashed ink.
  'movable-type': {
    engine: 'relief',
    impression: 'relief',
    params: { threshold: 50, surface: 'metal', woodGrain: 0, grainAngle: 0, splinter: 0, printing: 'press', squash: 40, deboss: 15, pieces: 70 },
    universal: { contrast: 15, ink: 100, detail: 90, pressure: 50, roughness: 20, grain: 45, registration: 20 },
    inkMode: 'one',
    inks: ['#1d1d1b'],
    inkOpacity: [0],
    paper: { id: 'ivory', texture: 70, light: 30 },
    essentials: ['pieces', 'detail', 'ink', 'pressure', 'contrast'],
    advanced: ['threshold', ...RELIEF_ADVANCED.filter((p) => p !== 'pieces')],
    imperfections: { amount: 40, enabled: ['pressure', 'starved', 'dust', 'wear'] },
    variants: [
      { nameKey: 'variant.typeMetal', params: { surface: ['metal'], pieces: [55, 80], squash: [30, 50] }, universal: { grain: [35, 55] }, imperfections: ['pressure', 'starved', 'dust', 'wear'], impAmount: [30, 50] },
      { nameKey: 'variant.typeWood', params: { surface: ['wood'], woodGrain: [45, 75], grainAngle: [0, 10], pieces: [60, 90], squash: [20, 35] }, universal: { grain: [50, 70] }, imperfections: ['pressure', 'starved', 'dust', 'wear'], impAmount: [40, 60] },
      { nameKey: 'variant.typeWorn', params: { pieces: [85, 100], squash: [40, 60] }, universal: { ink: [80, 95], pressure: [35, 50], roughness: [35, 55] }, imperfections: ['pressure', 'starved', 'dust', 'wear'], impAmount: [55, 80] },
      { nameKey: 'variant.typeFresh', params: { pieces: [25, 45], squash: [25, 40] }, universal: { ink: [100, 115], roughness: [5, 15] }, imperfections: ['dust'], impAmount: [10, 25] },
    ],
  },
  // Risograph: soy ink through a master burnt at 600 dpi; dots built on the master's
  // grid, solids that never reach a full film, passes that drift up to a couple of mm.
  risograph: {
    engine: 'stencil',
    impression: 'riso',
    params: { fill: 'am', levels: 'cont', lpi: 65, angle: 45, fmDot: 130, gain: 30, filmGrain: 0, masterDpi: 600, mesh: 90, maxDensity: 88 },
    universal: { contrast: 5, ink: 100, detail: 85, pressure: 50, roughness: 25, grain: 45, registration: 35 },
    inkMode: 'two',
    inks: ['#ff48b0', '#3255a4'],
    inkOpacity: [0, 0],
    paper: { id: 'white', texture: 55, light: 20 },
    essentials: ['lpi', 'detail', 'ink', 'registration', 'contrast'],
    advanced: [...RISO_ADVANCED, 'fmDot'],
    imperfections: { amount: 40, enabled: ['pressure', 'starved', 'dust', 'bands'] },
    variants: [
      { nameKey: 'variant.risoPhoto', params: { fill: ['am'], levels: ['cont'], lpi: [55, 85] }, universal: { detail: [80, 95], registration: [15, 40], grain: [35, 55] }, imperfections: ['pressure', 'starved', 'dust', 'bands'], impAmount: [25, 45] },
      { nameKey: 'variant.risoCoarse', params: { fill: ['am'], levels: ['cont'], lpi: [24, 40] }, universal: { detail: [70, 90], registration: [30, 60], grain: [40, 60] }, imperfections: ['pressure', 'starved', 'dust', 'bands'], impAmount: [35, 55] },
      { nameKey: 'variant.risoFlat', params: { fill: ['solid'], levels: ['2', '3'] }, universal: { detail: [35, 65], registration: [40, 80], grain: [45, 70] }, imperfections: ['pressure', 'starved', 'dust'], impAmount: [30, 50] },
      { nameKey: 'variant.risoMisprint', params: { fill: ['am'], levels: ['cont'], lpi: [45, 70] }, universal: { registration: [75, 100], grain: [60, 85], ink: [85, 110] }, imperfections: ['pressure', 'starved', 'dust', 'bands', 'ghost'], impAmount: [55, 80] },
    ],
  },
  // Risograph in "grain" mode: a stochastic screen on the master instead of dots.
  'risograph-grain': {
    engine: 'stencil',
    impression: 'riso',
    params: { fill: 'fm', levels: 'cont', lpi: 65, angle: 45, fmDot: 130, gain: 20, filmGrain: 0, masterDpi: 600, mesh: 90, maxDensity: 88 },
    universal: { contrast: 10, ink: 100, detail: 85, pressure: 50, roughness: 15, grain: 50, registration: 35 },
    inkMode: 'two',
    inks: ['#ff48b0', '#3255a4'],
    inkOpacity: [0, 0],
    paper: { id: 'white', texture: 55, light: 20 },
    essentials: ['fmDot', 'detail', 'ink', 'registration', 'contrast'],
    advanced: [...RISO_ADVANCED, 'lpi'],
    imperfections: { amount: 40, enabled: ['pressure', 'starved', 'dust', 'bands'] },
    variants: [
      { nameKey: 'variant.grainFine', params: { fill: ['fm'], levels: ['cont'], fmDot: [85, 130] }, universal: { detail: [80, 95], registration: [15, 40] }, imperfections: ['pressure', 'starved', 'dust', 'bands'], impAmount: [25, 45] },
      { nameKey: 'variant.grainCoarse', params: { fill: ['fm'], levels: ['cont'], fmDot: [200, 320] }, universal: { detail: [70, 90], registration: [25, 55], grain: [45, 65] }, imperfections: ['pressure', 'starved', 'dust', 'bands'], impAmount: [35, 55] },
      { nameKey: 'variant.grainKey', params: { fill: ['solid'], levels: ['2'], filmGrain: [45, 80] }, universal: { detail: [55, 80], registration: [30, 60] }, imperfections: ['pressure', 'starved', 'dust'], impAmount: [30, 50] },
      { nameKey: 'variant.risoMisprint', params: { fill: ['fm'], levels: ['cont'], fmDot: [110, 200] }, universal: { registration: [75, 100], grain: [60, 85] }, imperfections: ['pressure', 'starved', 'dust', 'bands', 'ghost'], impAmount: [55, 80] },
    ],
  },
  // Screenprint: a thick, nearly opaque film squeegeed through a mesh; coarse
  // halftones whose edges carry the mesh's teeth.
  screenprint: {
    engine: 'stencil',
    impression: 'screenprint',
    params: { fill: 'am', levels: 'cont', lpi: 35, angle: 22, fmDot: 200, gain: 20, filmGrain: 0, masterDpi: 600, mesh: 90, maxDensity: 100 },
    universal: { contrast: 15, ink: 110, detail: 80, pressure: 50, roughness: 20, grain: 20, registration: 25 },
    inkMode: 'two',
    inks: ['#f15060', '#1d1d1b'],
    inkOpacity: [70, 85],
    paper: { id: 'cotton', texture: 45, light: 25 },
    essentials: ['lpi', 'detail', 'ink', 'registration', 'contrast'],
    advanced: SCREEN_ADVANCED,
    imperfections: { amount: 30, enabled: ['pressure', 'dust', 'bands'] },
    variants: [
      { nameKey: 'variant.screenHalftone', params: { fill: ['am'], levels: ['cont'], lpi: [30, 50], mesh: [90, 140] }, universal: { detail: [75, 90], registration: [15, 35] }, imperfections: ['pressure', 'dust', 'bands'], impAmount: [20, 40] },
      { nameKey: 'variant.screenPoster', params: { fill: ['solid'], levels: ['3', '4'] }, universal: { detail: [40, 65], registration: [20, 45] }, imperfections: ['pressure', 'dust', 'bands'], impAmount: [25, 45] },
      { nameKey: 'variant.screenCoarseMesh', params: { fill: ['am'], levels: ['cont'], lpi: [18, 28], mesh: [40, 60] }, universal: { detail: [60, 80], roughness: [35, 60] }, imperfections: ['pressure', 'starved', 'dust', 'bands'], impAmount: [35, 55] },
      { nameKey: 'variant.screenGrain', params: { fill: ['fm'], levels: ['cont'], fmDot: [180, 320] }, universal: { detail: [70, 90], registration: [20, 45] }, imperfections: ['pressure', 'dust', 'bands'], impAmount: [25, 45] },
    ],
  },
  // Pop screenprint: flat colours cut from a simplified photo, a black key on top,
  // passes visibly off register.
  'pop-screenprint': {
    engine: 'stencil',
    impression: 'screenprint',
    params: { fill: 'solid', levels: '2', lpi: 35, angle: 22, fmDot: 200, gain: 20, filmGrain: 10, masterDpi: 600, mesh: 90, maxDensity: 100 },
    universal: { contrast: 25, ink: 110, detail: 45, pressure: 50, roughness: 30, grain: 20, registration: 55 },
    inkMode: 'many',
    inks: ['#ffe800', '#ff48b0', '#1d1d1b'],
    inkOpacity: [85, 80, 90],
    paper: { id: 'white', texture: 35, light: 20 },
    essentials: ['levels', 'detail', 'registration', 'contrast', 'ink'],
    advanced: SCREEN_ADVANCED,
    imperfections: { amount: 30, enabled: ['pressure', 'dust', 'bands'] },
    variants: [
      { nameKey: 'variant.popFlat', params: { fill: ['solid'], levels: ['2'], filmGrain: [0, 15] }, universal: { detail: [35, 55], registration: [40, 65], contrast: [15, 35] }, imperfections: ['pressure', 'dust', 'bands'], impAmount: [20, 40] },
      { nameKey: 'variant.popLevels', params: { fill: ['solid'], levels: ['3', '4'], filmGrain: [0, 15] }, universal: { detail: [40, 65], registration: [25, 50] }, imperfections: ['pressure', 'dust', 'bands'], impAmount: [20, 40] },
      { nameKey: 'variant.popOffRegister', params: { fill: ['solid'], levels: ['2'] }, universal: { detail: [35, 55], registration: [80, 100], roughness: [30, 55] }, imperfections: ['pressure', 'starved', 'dust', 'bands'], impAmount: [35, 55] },
      { nameKey: 'variant.popGrainKey', params: { fill: ['solid'], levels: ['2'], filmGrain: [45, 80] }, universal: { detail: [50, 75], registration: [35, 60] }, imperfections: ['pressure', 'dust', 'bands'], impAmount: [25, 45] },
    ],
  },
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
  // Four-colour offset: process inks, each screened at its classic angle
  // (C 15° · M 75° · Y 0° · K 45°) so the dots form rosettes instead of moiré.
  'offset-cmyk': {
    engine: 'screen',
    impression: 'offset',
    params: { shape: 'round', lpi: 150, angle: 45, moire: 0, gain: 12, softness: 5, fmDot: 90 },
    universal: { contrast: 5, ink: 100, detail: 60, pressure: 50, roughness: 6, grain: 12, registration: 8 },
    inkMode: 'many',
    inks: ['#00a3e0', '#e5007e', '#ffed00', '#1d1d1b'],
    inkOpacity: [0, 0, 0, 0],
    paper: { id: 'white', texture: 25, light: 10 },
    essentials: ['lpi', 'detail', 'ink', 'registration', 'contrast'],
    advanced: ['shape', 'angle', 'moire', 'gain', 'softness', 'pressure', 'roughness', 'grain', 'fmDot'],
    imperfections: { amount: 15, enabled: ['dust'] },
    variants: [
      { nameKey: 'variant.cmykMagazine', params: { shape: ['round', 'ellipse'], lpi: [150, 175], gain: [8, 15] }, universal: { registration: [0, 10] }, imperfections: ['dust'], impAmount: [5, 15] },
      { nameKey: 'variant.cmykComic', params: { shape: ['round'], lpi: [45, 65], gain: [25, 45] }, universal: { registration: [35, 65], roughness: [20, 40] }, imperfections: ['pressure', 'dust'], impAmount: [25, 45] },
      { nameKey: 'variant.cmykMoire', params: { moire: [45, 80], lpi: [60, 90] }, universal: { registration: [10, 30] }, imperfections: ['dust'], impAmount: [10, 25] },
      { nameKey: 'variant.cmykFm', params: { shape: ['fm'], fmDot: [60, 110] }, universal: { registration: [0, 15] }, imperfections: ['dust'], impAmount: [5, 15] },
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
