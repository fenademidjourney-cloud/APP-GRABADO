// Engines vs presets (docs/PLANNING.md §E, §37): an engine is an algorithm with
// declared parameters; a preset is only a starting set of values for one engine.
// The interface is generated from ParamDef, so a new preset needs no UI code.

import type { TextKey } from '../i18n'

export type EngineId = 'none' | 'screen' | 'stencil' | 'relief'

export type ParamValue = number | string
export type Params = Record<string, ParamValue>

export interface NumberParam {
  id: string
  type: 'number'
  labelKey: TextKey
  hintKey?: TextKey
  min: number
  max: number
  step?: number
  default: number
  /** How the value reads next to the label (always with its unit: 01-principios / 06-voz). */
  display: (v: number) => string
}

export interface EnumParam {
  id: string
  type: 'enum'
  labelKey: TextKey
  hintKey?: TextKey
  options: Array<{ value: string; labelKey: TextKey }>
  default: string
}

export type ParamDef = NumberParam | EnumParam

export function defaultsOf(defs: ParamDef[]): Params {
  return Object.fromEntries(defs.map((d) => [d.id, d.default]))
}

/** Whitelist + clamp: unknown keys are dropped, invalid values fall back. */
export function sanitizeParams(defs: ParamDef[], raw: unknown): Params {
  const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const out: Params = {}
  for (const d of defs) {
    const v = src[d.id]
    if (d.type === 'number') out[d.id] = typeof v === 'number' && Number.isFinite(v) ? Math.max(d.min, Math.min(d.max, v)) : d.default
    else out[d.id] = typeof v === 'string' && d.options.some((o) => o.value === v) ? v : d.default
  }
  return out
}
