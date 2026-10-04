// Choosing a technique (05-interaccion.md: choosing replaces, in one undo step): the
// preset's engine parameters, universal values, inks and paper become the starting
// point. Everything stays editable afterwards; layers are never touched.

import type { Doc } from '../model/doc'
import { PRESETS, presetParams } from './defs'

export function applyPreset(d: Doc, technique: string): Doc {
  const def = PRESETS[technique]
  if (!def) return { ...d, technique, params: {} }
  const inks = def.inks ?? d.inks
  return {
    ...d,
    technique,
    params: presetParams(technique),
    universal: { ...d.universal, ...def.universal },
    inkMode: def.inkMode ?? d.inkMode,
    inks,
    activeInk: Math.min(d.activeInk, inks.length - 1),
    paper: def.paper ?? d.paper,
  }
}
