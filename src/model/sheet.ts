// Sheet (pliego) sizes, in millimetres. The document is always physical: every
// effect is defined in mm, and pixels only appear when rendering (docs/PLANNING.md §D).

export interface SheetSize {
  id: string
  label: string
  widthMm: number
  heightMm: number
}

export const SHEET_SIZES: SheetSize[] = [
  { id: 'a4', label: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'a3', label: 'A3', widthMm: 297, heightMm: 420 },
  { id: 'letter', label: 'CARTA', widthMm: 215.9, heightMm: 279.4 },
  { id: 'square', label: '20 × 20', widthMm: 200, heightMm: 200 },
  { id: 'poster', label: '50 × 70', widthMm: 500, heightMm: 700 },
]

export const DEFAULT_SHEET = SHEET_SIZES[0]

/** Default export resolution. It also defines the "100 %" view: one export pixel per device pixel. */
export const DEFAULT_DPI = 300

/** Placeholder paper tone until the substrate system exists (Phase 03). */
export const DEFAULT_PAPER_COLOR = '#f6f3ea'
