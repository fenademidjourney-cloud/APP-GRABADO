// The technique catalogue as the interface sees it: names, families and which ones
// ship in the MVP. The full PresetDef (engine, parameters, inks, paper…) arrives with
// each engine's phase (docs/PLANNING.md §E); this list only drives navigation.
// Names and descriptions are educational texts: status 'borrador' until reviewed.

export type NavFamily = 'classic' | 'editorial' | 'pop' | 'contemporary'
export type ProcessFamily = 'relief' | 'intaglio' | 'planographic' | 'stencil' | 'photomechanical' | 'digital'

export interface TechniqueEntry {
  id: string
  name: string          // Spanish name shown first
  originalName: string  // historical / international name
  nav: NavFamily
  process: ProcessFamily
  mvp: boolean
}

export const NAV_FAMILIES: NavFamily[] = ['classic', 'editorial', 'pop', 'contemporary']

export const CATALOG: TechniqueEntry[] = [
  { id: 'woodcut', name: 'Xilografía', originalName: 'Woodcut', nav: 'classic', process: 'relief', mvp: true },
  { id: 'linocut', name: 'Linograbado', originalName: 'Linocut', nav: 'classic', process: 'relief', mvp: true },
  { id: 'copperplate-engraving', name: 'Grabado a buril', originalName: 'Copperplate Engraving', nav: 'classic', process: 'intaglio', mvp: true },
  { id: 'etching', name: 'Aguafuerte', originalName: 'Etching', nav: 'classic', process: 'intaglio', mvp: true },
  { id: 'movable-type', name: 'Tipos móviles', originalName: 'Movable Type', nav: 'classic', process: 'relief', mvp: true },
  { id: 'letterpress', name: 'Letterpress', originalName: 'Letterpress', nav: 'classic', process: 'relief', mvp: true },
  { id: 'stone-lithography', name: 'Litografía en piedra', originalName: 'Stone Lithography', nav: 'classic', process: 'planographic', mvp: true },
  { id: 'drypoint', name: 'Punta seca', originalName: 'Drypoint', nav: 'classic', process: 'intaglio', mvp: false },
  { id: 'aquatint', name: 'Aguatinta', originalName: 'Aquatint', nav: 'classic', process: 'intaglio', mvp: false },
  { id: 'mezzotint', name: 'Mezzotinta', originalName: 'Mezzotint', nav: 'classic', process: 'intaglio', mvp: false },
  { id: 'wood-engraving', name: 'Grabado en madera de pie', originalName: 'Wood Engraving', nav: 'classic', process: 'relief', mvp: false },

  { id: 'newspaper-halftone', name: 'Trama de diario', originalName: 'Newspaper Halftone', nav: 'editorial', process: 'photomechanical', mvp: true },
  { id: 'editorial-halftone', name: 'Trama editorial', originalName: 'Editorial Halftone', nav: 'editorial', process: 'photomechanical', mvp: true },
  { id: 'photomechanical-halftone', name: 'Trama fotomecánica', originalName: 'Photomechanical Halftone', nav: 'editorial', process: 'photomechanical', mvp: false },
  { id: 'high-contrast', name: 'Alto contraste', originalName: 'High-contrast Reproduction', nav: 'editorial', process: 'photomechanical', mvp: false },
  { id: 'offset-cmyk', name: 'Offset CMYK', originalName: 'Offset-inspired Halftone', nav: 'editorial', process: 'planographic', mvp: true },

  { id: 'screenprint', name: 'Serigrafía', originalName: 'Screenprint', nav: 'pop', process: 'stencil', mvp: true },
  { id: 'pop-screenprint', name: 'Serigrafía pop', originalName: 'Pop Screenprint', nav: 'pop', process: 'stencil', mvp: true },
  { id: 'ben-day', name: 'Puntos Ben-Day', originalName: 'Ben-Day Dots', nav: 'pop', process: 'photomechanical', mvp: false },
  { id: 'photo-screenprint', name: 'Serigrafía fotográfica', originalName: 'Photographic Screenprint', nav: 'pop', process: 'stencil', mvp: false },

  { id: 'risograph', name: 'Risografía', originalName: 'Two-color Risograph', nav: 'contemporary', process: 'stencil', mvp: true },
  { id: 'risograph-grain', name: 'Risografía grano', originalName: 'Risograph Grain', nav: 'contemporary', process: 'stencil', mvp: true },
  { id: 'risograph-zine', name: 'Risografía fanzine', originalName: 'Risograph Zine', nav: 'contemporary', process: 'stencil', mvp: false },
  { id: 'digital-stencil', name: 'Estencil digital', originalName: 'Digital Stencil', nav: 'contemporary', process: 'stencil', mvp: false },
  { id: 'dither', name: 'Tramado de 1 bit', originalName: '1-bit Dither', nav: 'contemporary', process: 'digital', mvp: false },
]

export const DEFAULT_TECHNIQUE = 'risograph'

export function techniqueById(id: string): TechniqueEntry {
  return CATALOG.find((e) => e.id === id) ?? CATALOG.find((e) => e.id === DEFAULT_TECHNIQUE)!
}
