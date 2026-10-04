// Imperfections v1 (docs/PLANNING.md §G.3). Each one is a function of the physical
// state, evaluated in the shader in mm of the sheet, never an overlay:
//   pressure  uneven pressure: a low-frequency field (side-to-side gradient of a press
//             plus soft patches) that thins the ink and loosens the paper contact
//   starved   missing ink: blotchy voids where the plate held little ink, mostly in
//             large masses (they run out first)
//   dust      dust on the plate: white specks, and hickeys (a dot of ink with a
//             white halo) on presses
//   wear      worn plate: edges and fine streaks that stop printing
//   stains    on the paper: foxing and stains with a darker rim (coffee-ring effect)
// Each preset brings its own set; they switch on and off together (Material ·
// IMPERFECCIONES) and each one has its chip.

export const IMPERFECTIONS = ['pressure', 'starved', 'dust', 'wear', 'stains'] as const
export type ImperfectionId = (typeof IMPERFECTIONS)[number]

export interface ImperfectionSettings {
  amount: number              // 0..100
  enabled: ImperfectionId[]
}

/** The bit each imperfection takes in the shader's mask (render/shaders.ts · IMP_*). */
export const IMPERFECTION_BIT: Record<ImperfectionId, number> = {
  pressure: 1,
  starved: 2,
  dust: 4,
  wear: 8,
  stains: 16,
}

export const DEFAULT_IMPERFECTIONS: ImperfectionSettings = { amount: 35, enabled: ['pressure', 'starved', 'dust'] }

export function imperfectionMask(enabled: readonly ImperfectionId[]): number {
  return enabled.reduce((m, id) => m | IMPERFECTION_BIT[id], 0)
}

export function sanitizeImperfections(v: unknown, fallback: ImperfectionSettings): ImperfectionSettings {
  const o = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  const amount = typeof o.amount === 'number' && Number.isFinite(o.amount) ? Math.max(0, Math.min(100, o.amount)) : fallback.amount
  // Keep the canonical order and drop unknown or repeated ids.
  const raw = Array.isArray(o.enabled) ? o.enabled : fallback.enabled
  const enabled = IMPERFECTIONS.filter((id) => raw.includes(id))
  return { amount, enabled }
}
