// Saved data is never trusted: every field is rebuilt from a whitelist, with the
// default when missing or invalid (05-interaccion.md · Persistencia). Unknown
// fields are dropped; a technique or sheet that no longer exists falls back.

import { CATALOG } from '../presets/catalog'
import { DEFAULT_DOC, inksFor, type CleanToggles, type Doc, type InkMode } from './doc'
import type { BlendMode, Layer } from './layer'
import { SHEET_SIZES } from './sheet'
import { PAPERS } from './paper'
import { ENGINE_PARAMS, engineOf } from '../presets/defs'
import { sanitizeParams } from '../engines/types'
import { sanitizeImperfections } from '../print/imperfections'
import { sanitizeSeed } from '../util/seed'

type Raw = Record<string, unknown>

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const str = (v: unknown, fallback: string, maxLen = 200) => (typeof v === 'string' && v.length <= maxLen ? v : fallback)
function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}
const HEX = /^#[0-9a-f]{6}$/i

const BLENDS: readonly BlendMode[] = ['normal', 'multiply', 'screen', 'darken', 'lighten']

export function sanitizeLayer(v: unknown, inkCount: number): Layer | null {
  if (!isObj(v)) return null
  const assetId = str(v.assetId, '')
  const id = str(v.id, '')
  const n = isObj(v.natural) ? v.natural : {}
  const w = num(n.w, 0, 0, 1e6)
  const h = num(n.h, 0, 0, 1e6)
  if (!assetId || !id || w < 1 || h < 1) return null
  const t = isObj(v.transform) ? v.transform : {}
  const c = isObj(v.crop) ? v.crop : {}
  const crop = { l: num(c.l, 0, 0, 0.99), t: num(c.t, 0, 0, 0.99), r: num(c.r, 0, 0, 0.99), b: num(c.b, 0, 0, 0.99) }
  if (crop.l + crop.r > 0.99) crop.r = 0
  if (crop.t + crop.b > 0.99) crop.b = 0
  const tone = isObj(v.tone) ? v.tone : {}
  const target = str(v.inkTarget, 'auto')
  const m = /^ink-(\d+)$/.exec(target)
  return {
    id,
    assetId,
    name: str(v.name, 'Imagen', 120),
    natural: { w, h },
    visible: bool(v.visible, true),
    locked: bool(v.locked, false),
    opacity: num(v.opacity, 1, 0, 1),
    blend: pick(v.blend, BLENDS, 'normal'),
    transform: {
      x: num(t.x, 0, -1e5, 1e5),
      y: num(t.y, 0, -1e5, 1e5),
      scale: num(t.scale, 1, 1e-6, 1e4),
      rotation: num(t.rotation, 0, -180, 180),
      flipX: bool(t.flipX, false),
    },
    crop,
    inkTarget: m && Number(m[1]) >= 1 && Number(m[1]) <= inkCount ? target : 'auto',
    tone: { invert: bool(tone.invert, false) },
  }
}

export function sanitizeDoc(v: unknown): Doc {
  if (!isObj(v)) return DEFAULT_DOC
  const d = DEFAULT_DOC
  const inkMode = pick<InkMode>(v.inkMode, ['one', 'two', 'many'], d.inkMode)
  const rawInks = Array.isArray(v.inks) ? v.inks.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, 8) : []
  // Right number of inks for the mode; missing ones take the mode's defaults.
  const inks = inksFor(inkMode, rawInks)
  const tg = isObj(v.toggles) ? v.toggles : {}
  const toggles = Object.fromEntries(
    (Object.keys(d.toggles) as (keyof CleanToggles)[]).map((k) => [k, bool(tg[k], d.toggles[k])]),
  ) as unknown as CleanToggles
  const u = isObj(v.universal) ? v.universal : {}
  const pa = isObj(v.paper) ? v.paper : {}
  const layers = (Array.isArray(v.layers) ? v.layers : []).map((l) => sanitizeLayer(l, inks.length)).filter((l): l is Layer => !!l)
  const seen = new Set<string>()
  const technique = pick(v.technique, CATALOG.filter((e) => e.mvp).map((e) => e.id), d.technique)
  return {
    technique,
    sheetId: pick(v.sheetId, SHEET_SIZES.map((s) => s.id), d.sheetId),
    inkMode,
    inks,
    activeInk: Math.round(num(v.activeInk, 0, 0, inks.length - 1)),
    toggles,
    universal: {
      contrast: num(u.contrast, d.universal.contrast, -100, 100),
      ink: num(u.ink, d.universal.ink, 0, 150),
      detail: num(u.detail, d.universal.detail, 0, 100),
      pressure: num(u.pressure, d.universal.pressure, 0, 100),
      roughness: num(u.roughness, d.universal.roughness, 0, 100),
      grain: num(u.grain, d.universal.grain, 0, 100),
      registration: num(u.registration, d.universal.registration, 0, 100),
    },
    params: sanitizeParams(ENGINE_PARAMS[engineOf(technique)], v.params),
    paper: {
      id: pick(pa.id, PAPERS.map((p) => p.id), d.paper.id),
      texture: num(pa.texture, d.paper.texture, 0, 100),
      light: num(pa.light, d.paper.light, 0, 100),
    },
    imperfections: sanitizeImperfections(v.imperfections, d.imperfections),
    seed: sanitizeSeed(v.seed, d.seed),
    variant: Math.round(num(v.variant, -1, -1, 63)),
    layers: layers.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true))),
  }
}
