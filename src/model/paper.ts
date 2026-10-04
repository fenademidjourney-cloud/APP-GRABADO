// Procedural papers (substrate v1, docs/PLANNING.md §G). Each one is a tone plus how
// much fibre and pulp it shows; real scanned papers replace or extend these in
// Phase 11. Names are what a printmaker would call them.

export interface PaperDef {
  id: string
  name: string
  color: string     // sRGB
  fibre: number     // 0..1: how visible the fibres are at full texture
  flocs: number     // 0..1: pulp clouds (low-frequency mottling)
  /** 0..1: how deep the paper's relief is (hard sized paper ≈ 0.3, soft cotton ≈ 0.9). Ink only reaches the valleys with pressure. */
  relief: number
  /** 0..1: how much ink wicks along the fibres (newsprint and washi drink; coated paper doesn't). */
  absorb: number
}

export const PAPERS: PaperDef[] = [
  { id: 'white', name: 'Blanco', color: '#f7f6f1', fibre: 0.35, flocs: 0.3, relief: 0.35, absorb: 0.3 },
  { id: 'cream', name: 'Crema', color: '#f4eedf', fibre: 0.5, flocs: 0.45, relief: 0.5, absorb: 0.4 },
  { id: 'ivory', name: 'Marfil', color: '#ece2c8', fibre: 0.6, flocs: 0.6, relief: 0.6, absorb: 0.45 },
  { id: 'newsprint', name: 'Prensa', color: '#e4e0d4', fibre: 0.75, flocs: 0.5, relief: 0.55, absorb: 0.85 },
  { id: 'cotton', name: 'Algodón', color: '#f6f3ea', fibre: 0.9, flocs: 0.35, relief: 0.95, absorb: 0.6 },
  { id: 'kraft', name: 'Kraft', color: '#c6a47a', fibre: 0.85, flocs: 0.7, relief: 0.75, absorb: 0.55 },
  { id: 'grey', name: 'Gris', color: '#c9c8c3', fibre: 0.55, flocs: 0.45, relief: 0.5, absorb: 0.4 },
  { id: 'blue', name: 'Azul', color: '#8ea5c2', fibre: 0.6, flocs: 0.5, relief: 0.55, absorb: 0.45 },
  { id: 'pink', name: 'Rosa', color: '#f2c9c4', fibre: 0.5, flocs: 0.4, relief: 0.5, absorb: 0.4 },
  { id: 'black', name: 'Negro', color: '#2a2928', fibre: 0.5, flocs: 0.4, relief: 0.5, absorb: 0.4 },
]

export const DEFAULT_PAPER = PAPERS[1]

export function paperById(id: string): PaperDef {
  return PAPERS.find((p) => p.id === id) ?? DEFAULT_PAPER
}
