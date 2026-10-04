// Messages between the main thread and the renderer. The scene is small, plain JSON:
// it is sent whole on every change and the renderer redraws from it (caching what
// didn't change). Source images travel separately, once per asset, as Blobs.

import type { Layer } from '../model/layer'
import type { View } from './view'
import type { ScreenUniforms } from '../engines/screen/params'
import type { InkRegistration } from '../print/registration'
import type { StencilUniforms } from '../engines/stencil/params'
import type { ReliefUniforms } from '../engines/relief/params'
import type { LineUniforms } from '../engines/line/params'
import type { LineBuild } from '../engines/line/flow'
import type { GrainUniforms } from '../engines/grain/params'

export interface SceneColors {
  card: string      // the canvas card (token --card)
  checkA: string    // transparency checkerboard (tokens --control / --white)
  checkB: string
}

/** What the print pipeline needs (docs/PLANNING.md §C.3, §D). */
export interface PrintScene {
  inks: string[]          // sRGB hex, print order
  inkOpacity: number[]    // per ink, 0..1
  inkDensity: number      // ink film, 1 = nominal
  contrast: number        // −1..1
  paperOn: boolean
  colorOn: boolean        // off: marks keep the picture's colours
  compare: boolean        // show the original (Comparar)
  /** Every random field of the print derives from it (util/seed.ts). */
  seed: number
  /** Per ink, in print order; all zero with Registro off. */
  registration: InkRegistration[]
  /** Impression model; `on` false ("Textura de tinta" off) = ideal print. contact and depletion: print/impression.ts. */
  impression: { on: boolean; pressure: number; grain: number; bleedMm: number; contact: number; depletion: number; bandsAcross: boolean; intaglio: boolean }
  /** amount 0..1 (0 with Imperfecciones off) and print/imperfections.ts · IMPERFECTION_BIT mask. */
  imperfections: { amount: number; mask: number }
  paper: { color: string; fibre: number; flocs: number; texture: number; relief: number; light: number }
  /** The technique engine; absent (or Técnica off) = continuous ink. A stencil with AM or FM fill also sends `screen`. */
  screen?: ScreenUniforms
  stencil?: StencilUniforms
  relief?: ReliefUniforms
  /** Line geometry (built once on the CPU) and, for the line engine, how it prints. Relief uses it for gouges. */
  lines?: { build: LineBuild; print?: LineUniforms }
  grain?: GrainUniforms
}

export interface Scene {
  sheet: { widthMm: number; heightMm: number }
  colors: SceneColors
  view: View
  layers: Array<Pick<Layer, 'id' | 'assetId' | 'natural' | 'visible' | 'opacity' | 'blend' | 'transform' | 'crop' | 'inkTarget'>>
  print: PrintScene
}

export interface Viewport { cssW: number; cssH: number; dpr: number }

/** A PNG export: the scene at a size in pixels, tile by tile (docs/PLANNING.md §I). */
export interface ExportJob {
  scene: Scene
  widthPx: number
  heightPx: number
  dpi: number              // written into the file (pHYs)
  transparent: boolean     // only the ink, no paper
  tileSize: number         // smaller on phones
  /** png: the print · separations: a ZIP with one grey film per ink plus the print. */
  kind: 'png' | 'separations'
  /** File names inside the ZIP (separations): one per ink, then the print. */
  names?: { inks: string[]; print: string }
}

export type ToRenderer =
  | { type: 'init'; canvas: OffscreenCanvas; viewport: Viewport }
  | { type: 'viewport'; viewport: Viewport }
  | { type: 'scene'; scene: Scene }
  | { type: 'asset'; id: string; blob: Blob; natural: { w: number; h: number } }
  | { type: 'export'; id: number; job: ExportJob }
  | { type: 'export-cancel'; id: number }

export type FromRenderer =
  | { type: 'ready'; maxTexture: number }
  | { type: 'error'; code: 'no-webgl2' | 'context-lost' | 'decode'; detail?: string; assetId?: string }
  | { type: 'export-progress'; id: number; done: number; total: number }
  | { type: 'export-done'; id: number; blob: Blob }
  | { type: 'export-error'; id: number; cancelled: boolean; detail?: string }
