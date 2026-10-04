// The dice (Variante · 05-interaccion.md "Sugerir"): every tap must look clearly
// different. It picks a style of the technique other than the last one, draws its
// values inside their ranges and takes a new seed, so the grain, the dust and the
// registration change too. What the user set by hand stays: inks, paper, layers,
// the clean-mode switches. The whole change is one undo step (the caller commits it).

import type { Doc, Universal } from '../model/doc'
import { ENGINE_PARAMS, engineOf, variantsOf, type Range } from './defs'
import { streamRng } from '../util/seed'
import { IMPERFECTIONS } from '../print/imperfections'
import type { Params } from '../engines/types'

const pickRange = (r: () => number, [lo, hi]: Range, step = 1) => {
  const v = lo + (hi - lo) * r()
  return Math.min(hi, Math.max(lo, Math.round(v / step) * step))
}

/** The doc after a tap on the dice with `seed` as the new seed (deterministic for a seed). */
export function rollVariant(d: Doc, seed: number): { doc: Doc; index: number } {
  const styles = variantsOf(d.technique)
  const r = streamRng(seed, 'variant')
  // Never the same style twice in a row.
  let index = Math.floor(r() * styles.length)
  if (styles.length > 1 && index === d.variant) index = (index + 1 + Math.floor(r() * (styles.length - 1))) % styles.length
  const style = styles[index]
  const universal: Universal = { ...d.universal }
  for (const [k, range] of Object.entries(style.universal ?? {}) as Array<[keyof Universal, Range]>) universal[k] = pickRange(r, range)
  const params: Params = { ...d.params }
  const defs = ENGINE_PARAMS[engineOf(d.technique)]
  for (const [id, spec] of Object.entries(style.params ?? {})) {
    const def = defs.find((p) => p.id === id)
    if (!def) continue
    if (def.type === 'number' && typeof spec[0] === 'number') params[id] = pickRange(r, spec as Range, def.step ?? 1)
    else if (def.type === 'enum') {
      const options = (spec as string[]).filter((o) => def.options.some((x) => x.value === o))
      if (options.length) params[id] = options[Math.floor(r() * options.length)]
    }
  }
  const imperfections = {
    // Canonical order (as the sanitiser keeps it), whatever order the style lists them in.
    enabled: style.imperfections ? IMPERFECTIONS.filter((id) => style.imperfections!.includes(id)) : d.imperfections.enabled,
    amount: style.impAmount ? pickRange(r, style.impAmount) : d.imperfections.amount,
  }
  return { doc: { ...d, universal, params, imperfections, seed, variant: index }, index }
}
