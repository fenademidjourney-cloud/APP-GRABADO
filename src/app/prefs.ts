// Interface preferences (not the document): sheet height, last mode, open panels.
// Saved under a prefixed key (file:// shares storage between files) and sanitised
// with a whitelist on load, never spread from storage.

import type { ExportScale, LengthUnit } from '../io/export/size'

export type Mode = 'compose' | 'print'
export type PrintTab = 'effect' | 'inks' | 'material' | 'advanced'
export type ComposeTab = 'move' | 'crop' | 'layers' | 'advanced'

export interface Prefs {
  sheetH: number
  mode: Mode
  printTab: PrintTab
  composeTab: ComposeTab
  exportScale: ExportScale
  exportDpi: number        // used when exportScale is 'custom'
  unit: LengthUnit         // how physical sizes are shown
}

const KEY = 'taller-de-grabado:prefs'

export const DEFAULT_PREFS: Prefs = { sheetH: 236, mode: 'print', printTab: 'effect', composeTab: 'layers', exportScale: '2x', exportDpi: 450, unit: 'cm' }

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    const h = Number(raw.sheetH)
    return {
      sheetH: Number.isFinite(h) && h > 0 ? Math.max(150, Math.min(900, h)) : DEFAULT_PREFS.sheetH,
      mode: pick(raw.mode, ['compose', 'print'] as const, DEFAULT_PREFS.mode),
      printTab: pick(raw.printTab, ['effect', 'inks', 'material', 'advanced'] as const, DEFAULT_PREFS.printTab),
      composeTab: pick(raw.composeTab, ['move', 'crop', 'layers', 'advanced'] as const, DEFAULT_PREFS.composeTab),
      exportScale: pick(raw.exportScale, ['1x', '2x', '4x', 'custom'] as const, DEFAULT_PREFS.exportScale),
      exportDpi: Number.isFinite(Number(raw.exportDpi)) ? Math.max(36, Math.min(2400, Number(raw.exportDpi))) : DEFAULT_PREFS.exportDpi,
      unit: pick(raw.unit, ['mm', 'cm', 'in'] as const, DEFAULT_PREFS.unit),
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage may be unavailable (private mode, file:// restrictions) */
  }
}
