// Procedural papers (substrate v1, docs/PLANNING.md §G). Each one is a tone plus how
// much fibre and pulp it shows; real scanned papers replace or extend these in
// Phase 11. Names are what a printmaker would call them.

export interface PaperDef {
  id: string
  name: string
  color: string     // sRGB
  fibre: number     // 0..1: how visible the fibres are at full texture
  flocs: number     // 0..1: pulp clouds (low-frequency mottling)
}

export const PAPERS: PaperDef[] = [
  { id: 'white', name: 'Blanco', color: '#f7f6f1', fibre: 0.35, flocs: 0.3 },
  { id: 'cream', name: 'Crema', color: '#f4eedf', fibre: 0.5, flocs: 0.45 },
  { id: 'ivory', name: 'Marfil', color: '#ece2c8', fibre: 0.6, flocs: 0.6 },
  { id: 'newsprint', name: 'Prensa', color: '#e4e0d4', fibre: 0.75, flocs: 0.5 },
  { id: 'cotton', name: 'Algodón', color: '#f6f3ea', fibre: 0.9, flocs: 0.35 },
  { id: 'kraft', name: 'Kraft', color: '#c6a47a', fibre: 0.85, flocs: 0.7 },
  { id: 'grey', name: 'Gris', color: '#c9c8c3', fibre: 0.55, flocs: 0.45 },
  { id: 'blue', name: 'Azul', color: '#8ea5c2', fibre: 0.6, flocs: 0.5 },
  { id: 'pink', name: 'Rosa', color: '#f2c9c4', fibre: 0.5, flocs: 0.4 },
  { id: 'black', name: 'Negro', color: '#2a2928', fibre: 0.5, flocs: 0.4 },
]

export const DEFAULT_PAPER = PAPERS[1]

export function paperById(id: string): PaperDef {
  return PAPERS.find((p) => p.id === id) ?? DEFAULT_PAPER
}
