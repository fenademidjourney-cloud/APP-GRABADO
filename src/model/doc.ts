// The document: everything that is saved and can be undone. It grows phase by
// phase towards the full Project of docs/PLANNING.md §E–F; saved data always goes
// through sanitize.ts.

import { DEFAULT_TECHNIQUE } from '../presets/catalog'
import { DEFAULT_SHEET } from './sheet'
import type { Layer } from './layer'
import { DEFAULT_PAPER } from './paper'
import type { Params } from '../engines/types'

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
 * pressure = dot gain, roughness = ragged dot edges).
 */
export interface Universal {
  contrast: number   // −100..100 · tone curve before printing
  ink: number        // 0..150 · density of the ink film (100 = nominal)
  detail: number     // 0..100
  pressure: number   // 0..100 · 50 = the preset's own
  roughness: number  // 0..100
}

export interface PaperSettings {
  id: string         // model/paper.ts
  texture: number    // 0..100 · how much fibre and pulp show
}

export interface Doc {
  technique: string
  sheetId: string
  inkMode: InkMode
  inks: string[]          // hex sRGB, print order
  activeInk: number
  toggles: CleanToggles
  universal: Universal
  params: Params          // the technique engine's parameters (engines/*/params.ts)
  paper: PaperSettings
  layers: Layer[]         // bottom to top
}

/** Spot inks inspired by printing / stencil-duplicator inks. Generic names, approximate on screen. */
export const INK_LIBRARY: Array<{ id: string; name: string; hex: string; light?: boolean }> = [
  { id: 'black', name: 'Negro', hex: '#1d1d1b' },
  { id: 'fluor-pink', name: 'Rosa flúor', hex: '#ff48b0' },
  { id: 'bright-red', name: 'Rojo vivo', hex: '#f15060' },
  { id: 'orange', name: 'Naranja', hex: '#ff6c2f' },
  { id: 'yellow', name: 'Amarillo', hex: '#ffe800', light: true },
  { id: 'teal', name: 'Verde azulado', hex: '#00838a' },
  { id: 'medium-blue', name: 'Azul medio', hex: '#3255a4' },
  { id: 'federal-blue', name: 'Azul federal', hex: '#2e3f8f' },
  { id: 'violet', name: 'Violeta', hex: '#765ba7' },
  { id: 'burgundy', name: 'Burdeos', hex: '#914e72' },
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

export const DEFAULT_DOC: Doc = {
  technique: DEFAULT_TECHNIQUE,
  sheetId: DEFAULT_SHEET.id,
  inkMode: 'two',
  inks: DEFAULT_INKS.two,
  activeInk: 0,
  toggles: { technique: true, inkTexture: true, imperfections: true, paper: true, color: true, registration: true },
  universal: { contrast: 0, ink: 100, detail: 50, pressure: 50, roughness: 20 },
  params: {},
  paper: { id: DEFAULT_PAPER.id, texture: 60 },
  layers: [],
}
