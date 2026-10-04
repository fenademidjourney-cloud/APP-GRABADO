// Messages between the main thread and the renderer. The scene is small, plain JSON:
// it is sent whole on every change and the renderer redraws from it (caching what
// didn't change). Source images travel separately, once per asset, as Blobs.

import type { Layer } from '../model/layer'
import type { View } from './view'
import type { ScreenUniforms } from '../engines/screen/params'

export interface SceneColors {
  card: string      // the canvas card (token --card)
  checkA: string    // transparency checkerboard (tokens --control / --white)
  checkB: string
}

/** What the print pipeline needs (Phase 03: continuous ink, no technique yet). */
export interface PrintScene {
  inks: string[]          // sRGB hex, print order
  inkDensity: number      // ink film, 1 = nominal
  contrast: number        // −1..1
  paperOn: boolean
  colorOn: boolean        // off: marks keep the picture's colours
  compare: boolean        // show the original (Comparar)
  paper: { color: string; fibre: number; flocs: number; texture: number }
  /** The technique engine; absent (or Técnica off) = continuous ink. */
  screen?: ScreenUniforms
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
