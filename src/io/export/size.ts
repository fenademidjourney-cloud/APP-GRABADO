// Export size: the document is physical (mm), so the pixel size is the sheet at a
// resolution. 1× / 2× / 4× are 150, 300 and 600 dpi; "a medida" sets the dpi.

export type ExportScale = '1x' | '2x' | '4x' | 'custom'
export type LengthUnit = 'mm' | 'cm' | 'in'

export const SCALE_DPI: Record<Exclude<ExportScale, 'custom'>, number> = { '1x': 150, '2x': 300, '4x': 600 }
export const MIN_DPI = 36
export const MAX_DPI = 2400

export function exportDpi(scale: ExportScale, customDpi: number): number {
  return scale === 'custom' ? Math.max(MIN_DPI, Math.min(MAX_DPI, Math.round(customDpi))) : SCALE_DPI[scale]
}

export function exportPixels(sheet: { widthMm: number; heightMm: number }, dpi: number): { w: number; h: number } {
  return { w: Math.max(1, Math.round((sheet.widthMm / 25.4) * dpi)), h: Math.max(1, Math.round((sheet.heightMm / 25.4) * dpi)) }
}

/**
 * Largest export the device can make comfortably. Phones have far less memory per tab
 * (iOS ~1–1.5 GB); the streaming encoder keeps memory to one band of tiles, but the
 * time and the GPU still grow with the pixel count.
 */
export function exportLimits(coarsePointer: boolean): { maxSide: number; maxPixels: number } {
  return coarsePointer ? { maxSide: 10000, maxPixels: 60e6 } : { maxSide: 20000, maxPixels: 240e6 }
}

/** Highest dpi that stays within the limits for this sheet. */
export function maxDpiFor(sheet: { widthMm: number; heightMm: number }, limits: { maxSide: number; maxPixels: number }): number {
  const bySide = (limits.maxSide * 25.4) / Math.max(sheet.widthMm, sheet.heightMm)
  const byArea = Math.sqrt(limits.maxPixels / ((sheet.widthMm / 25.4) * (sheet.heightMm / 25.4)))
  return Math.floor(Math.min(bySide, byArea))
}

export function formatLength(mm: number, unit: LengthUnit): string {
  const v = unit === 'mm' ? mm : unit === 'cm' ? mm / 10 : mm / 25.4
  const digits = unit === 'mm' ? 0 : unit === 'cm' ? 1 : 2
  return v.toFixed(digits).replace('.', ',').replace(/,0+$/, '')
}
