// Impression models (docs/PLANNING.md §C.3 · 2): how the ink gets from the plate to
// the paper. v1 is one shader with three weights per family; later phases give
// each family its own terms (squash, plate tone, screen mesh…).
//   contact    how much the paper's relief matters: a hard block only touches the
//              crests (relief); damp paper pressed into the grooves (intaglio) and a
//              rubber blanket (offset) follow the valleys
//   depletion  how fast large masses run out of ink
//   bleed      how far the ink wicks along the fibres (fluid riso and screen inks
//              more than stiff relief ink)

import { PRESETS } from '../presets/defs'
import { techniqueById, type ProcessFamily } from '../presets/catalog'

export type ImpressionModel = 'relief' | 'intaglio' | 'planographic' | 'stencil' | 'offset'

export interface ImpressionWeights { contact: number; depletion: number; bleed: number }

export const IMPRESSION: Record<ImpressionModel, ImpressionWeights> = {
  relief: { contact: 1, depletion: 1, bleed: 0.6 },
  intaglio: { contact: 0.2, depletion: 0.3, bleed: 0.5 },
  planographic: { contact: 0.45, depletion: 0.6, bleed: 0.6 },
  stencil: { contact: 0.55, depletion: 1, bleed: 1 },
  offset: { contact: 0.3, depletion: 0.5, bleed: 0.8 },
}

const BY_PROCESS: Record<ProcessFamily, ImpressionModel> = {
  relief: 'relief',
  intaglio: 'intaglio',
  planographic: 'planographic',
  stencil: 'stencil',
  photomechanical: 'offset',
  digital: 'offset',
}

export function impressionOf(technique: string): ImpressionWeights {
  return IMPRESSION[PRESETS[technique]?.impression ?? BY_PROCESS[techniqueById(technique).process]]
}
