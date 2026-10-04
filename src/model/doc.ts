// The document: everything that is saved and can be undone. It grows phase by
// phase towards the full Project of docs/PLANNING.md §E–F; saved data always goes
// through sanitize.ts.

import { DEFAULT_TECHNIQUE } from '../presets/catalog'
import { DEFAULT_SHEET } from './sheet'
import type { Layer } from './layer'
import { DEFAULT_PAPER } from './paper'
import type { Params } from '../engines/types'
import { DEFAULT_IMPERFECTIONS, type ImperfectionSettings } from '../print/imperfections'

export type InkMode = 'one' | 'two' | 'many'

export interface CleanToggles {
  technique: boolean
  inkTexture: boolean
  imperfections: boolean
  paper: boolean
  color: boolean
  registration: boolean
}

/** Inks the renderer handles at once (two plate textures × 3 channels). */
export const MAX_INKS = 6

/**
 * The universal controls (docs/PLANNING.md §E.2). Values in %; each engine maps them
 * to its own physical parameters (screen: detail = tone per pixel vs per cell,
 * pressure = dot gain, roughness = ragged dot edges). Pressure, grain and
 * registration also drive the impression model, with or without an engine.
 */
export interface Universal {
  contrast: number      // −100..100 · tone curve before printing
  ink: number           // 0..150 · density of the ink film (100 = nominal)
  detail: number        // 0..100
  pressure: number      // 0..100 · 50 = the preset's own · paper contact, gain
  roughness: number     // 0..100
  grain: number         // 0..100 · mottle of the ink film
  registration: number  // 0..100 · how far each pass drifts (print/registration.ts)
}

export interface PaperSettings {
  id: string         // model/paper.ts
  texture: number    // 0..100 · how much fibre and pulp show
  light: number      // 0..100 · raking light over the paper's relief
}

export interface Doc {
  technique: string
  sheetId: string
  inkMode: InkMode
  inks: string[]          // hex sRGB, print order
  /** Per ink, 0..100: 0 = transparent (overprints), 100 = covers what's under it. Same length as inks. */
  inkOpacity: number[]
  activeInk: number
  toggles: CleanToggles
  universal: Universal
  params: Params          // the technique engine's parameters (engines/*/params.ts)
  paper: PaperSettings
  imperfections: ImperfectionSettings
  /** Everything random in the print comes from this seed (util/seed.ts): same seed, same print. */
  seed: number
  /** The last style the dice (Variante) chose, so the next tap picks another; −1 = none. */
  variant: number
  layers: Layer[]         // bottom to top
}

/** Spot inks inspired by printing / stencil-duplicator inks. Generic names, approximate on screen. */
export const INK_LIBRARY: Array<{ id: string; name: string; hex: string; light?: boolean; fluor?: boolean }> = [
  { id: 'black', name: 'Negro', hex: '#1d1d1b' },
  { id: 'fluor-pink', name: 'Rosa flúor', hex: '#ff48b0', fluor: true },
  { id: 'bright-red', name: 'Rojo vivo', hex: '#f15060' },
  { id: 'orange', name: 'Naranja', hex: '#ff6c2f' },
  { id: 'yellow', name: 'Amarillo', hex: '#ffe800', light: true },
  { id: 'teal', name: 'Verde azulado', hex: '#00838a' },
  { id: 'medium-blue', name: 'Azul medio', hex: '#3255a4' },
  { id: 'federal-blue', name: 'Azul federal', hex: '#2e3f8f' },
  { id: 'violet', name: 'Violeta', hex: '#765ba7' },
  { id: 'burgundy', name: 'Burdeos', hex: '#914e72' },
  { id: 'process-cyan', name: 'Cian de proceso', hex: '#00a3e0' },
  { id: 'process-magenta', name: 'Magenta de proceso', hex: '#e5007e' },
  { id: 'process-yellow', name: 'Amarillo de proceso', hex: '#ffed00', light: true },
]

const DEFAULT_INKS: Record<InkMode, string[]> = {
  one: ['#1d1d1b'],
  two: ['#ff48b0', '#3255a4'],
  many: ['#ffe800', '#ff48b0', '#3255a4'],
}

export function inksFor(mode: InkMode, current: string[]): string[] {
  const n = mode === 'one' ? 1 : mode === 'two' ? 2 : Math.min(MAX_INKS, Math.max(3, current.length))
  return Array.from({ length: n }, (_, i) => current[i] ?? DEFAULT_INKS[mode][i] ?? DEFAULT_INKS.many[i % 3])
}

/** Opacities for `n` inks: the current ones kept, new inks transparent. */
export function opacitiesFor(n: number, current: number[]): number[] {
  return Array.from({ length: n }, (_, i) => current[i] ?? 0)
}

/**
 * Move ink `i` one pass earlier (−1) or later (+1). Its colour, opacity and the layers
 * sent to it travel with it, so the print only changes in what overlaps what.
 */
export function moveInk(d: Doc, i: number, dir: -1 | 1): Doc {
  const j = i + dir
  if (i < 0 || j < 0 || i >= d.inks.length || j >= d.inks.length) return d
  const swap = <T,>(a: T[]) => a.map((v, k) => (k === i ? a[j] : k === j ? a[i] : v))
  const ti = `ink-${i + 1}`
  const tj = `ink-${j + 1}`
  return {
    ...d,
    inks: swap(d.inks),
    inkOpacity: swap(d.inkOpacity),
    activeInk: d.activeInk === i ? j : d.activeInk === j ? i : d.activeInk,
    layers: d.layers.map((l) => (l.inkTarget === ti ? { ...l, inkTarget: tj } : l.inkTarget === tj ? { ...l, inkTarget: ti } : l)),
  }
}

export const DEFAULT_DOC: Doc = {
  technique: DEFAULT_TECHNIQUE,
  sheetId: DEFAULT_SHEET.id,
  inkMode: 'two',
  inks: DEFAULT_INKS.two,
  inkOpacity: [0, 0],
  activeInk: 0,
  toggles: { technique: true, inkTexture: true, imperfections: true, paper: true, color: true, registration: true },
  universal: { contrast: 0, ink: 100, detail: 50, pressure: 50, roughness: 20, grain: 40, registration: 25 },
  params: {},
  paper: { id: DEFAULT_PAPER.id, texture: 60, light: 30 },
  imperfections: DEFAULT_IMPERFECTIONS,
  seed: 1,
  variant: -1,
  layers: [],
}
