// Impression models (docs/PLANNING.md §C.3 · 2): how the ink gets from the plate to
// the paper. v1 is one shader with three weights per family; later phases give
// each family its own terms (squash, plate tone, screen mesh…).
//   contact    how much the paper's relief matters: a hard block only touches the
//              crests (relief); damp paper pressed into the grooves (intaglio) and a
//              rubber blanket (offset) follow the valleys
//   depletion  how fast large masses run out of ink
//   bleed      how far the ink wicks along the fibres (fluid riso and screen inks
//              more than stiff relief ink)
//   bandsAcross  'bands' imperfection: riso drums leave bands across the feed (they
//              vary down the sheet); a squeegee leaves streaks along its stroke (they
//              vary across it)

import { PRESETS } from '../presets/defs'
import { techniqueById, type ProcessFamily } from '../presets/catalog'

export type ImpressionModel = 'relief' | 'intaglio' | 'planographic' | 'riso' | 'screenprint' | 'offset'

export interface ImpressionWeights { contact: number; depletion: number; bleed: number; bandsAcross: boolean }

export const IMPRESSION: Record<ImpressionModel, ImpressionWeights> = {
  relief: { contact: 1, depletion: 1, bleed: 0.6, bandsAcross: false },
  intaglio: { contact: 0.2, depletion: 0.3, bleed: 0.5, bandsAcross: false },
  planographic: { contact: 0.45, depletion: 0.6, bleed: 0.6, bandsAcross: false },
  // Soy ink pushed through a master: absorbed into the paper, starved in masses.
  riso: { contact: 0.55, depletion: 1, bleed: 1, bandsAcross: false },
  // A thick film laid through the mesh: it bridges the paper's valleys.
  screenprint: { contact: 0.25, depletion: 0.4, bleed: 0.5, bandsAcross: true },
  offset: { contact: 0.3, depletion: 0.5, bleed: 0.8, bandsAcross: false },
}

const BY_PROCESS: Record<ProcessFamily, ImpressionModel> = {
  relief: 'relief',
  intaglio: 'intaglio',
  planographic: 'planographic',
  stencil: 'riso',
  photomechanical: 'offset',
  digital: 'offset',
}

export function impressionModelOf(technique: string): ImpressionModel {
  return PRESETS[technique]?.impression ?? BY_PROCESS[techniqueById(technique).process]
}

export function impressionOf(technique: string): ImpressionWeights {
  return IMPRESSION[impressionModelOf(technique)]
}
