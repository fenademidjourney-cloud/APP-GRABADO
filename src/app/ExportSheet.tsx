import { useEffect, useRef, useState } from 'react'
import { t, tf } from '../i18n'
import { Label } from '../ui/kit'
import { RangeControl, Segmented } from '../ui/controls'
import { exportDpi, exportLimits, exportPixels, formatLength, maxDpiFor, MIN_DPI, type ExportScale, type LengthUnit } from '../io/export/size'
import type { ExportHandle } from '../render/renderHost'

// Exportar (header): an overlay sheet with the few decisions an export needs —
// background, size, units — and one black button (04-componentes.md: at most one
// dark button per panel). The PNG is rendered tile by tile at the final resolution,
// never upscaled from the preview.

export type ExportKind = 'png' | 'separations' | 'pdf'

export type Exporter = (o: { widthPx: number; heightPx: number; dpi: number; transparent: boolean; tileSize: number; kind: ExportKind; names?: { inks: string[]; print: string; inkNames?: string[]; title?: string } }, onProgress: (done: number, total: number) => void) => ExportHandle | null

export function isCoarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
}

/** Can this browser share image files (navigator.share)? Otherwise "Compartir" downloads. */
export function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([new Uint8Array(1)], 'x.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

export function ExportSheet({ mode, sheet, paperOn, scale, customDpi, unit, onPaper, onScale, onCustomDpi, onUnit, start, onFinished, onFailed, onShare, onClose }: {
  /** download: the PNG is saved when ready · share: a second tap shares it (browsers need a fresh tap). */
  mode: 'download' | 'share'
  sheet: { widthMm: number; heightMm: number }
  paperOn: boolean
  scale: ExportScale
  customDpi: number
  unit: LengthUnit
  onPaper: (on: boolean) => void
  onScale: (s: ExportScale) => void
  onCustomDpi: (dpi: number) => void
  onUnit: (u: LengthUnit) => void
  start: (o: { dpi: number; widthPx: number; heightPx: number; kind: ExportKind }, onProgress: (p: number) => void) => ExportHandle | null
  onFinished: (blob: Blob, kind: ExportKind) => void
  onFailed: (cancelled: boolean) => void
  onShare: (blob: Blob) => void
  onClose: () => void
}) {
  const coarse = isCoarsePointer()
  const maxDpi = maxDpiFor(sheet, exportLimits(coarse))
  const dpi = Math.min(maxDpi, exportDpi(scale, customDpi))
  const px = exportPixels(sheet, dpi)
  const [progress, setProgress] = useState<number | null>(null)
  const [ready, setReady] = useState<Blob | null>(null)
  // Sharing is for the print only; separations are a file for the printer.
  const [kind, setKind] = useState<ExportKind>('png')
  const running = useRef<{ cancel: () => void } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !running.current) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const go = () => {
    const job = start({ dpi, widthPx: px.w, heightPx: px.h, kind }, (p) => setProgress(p))
    if (!job) return
    running.current = job
    setProgress(0)
    job.promise
      .then((blob) => { if (mode === 'share') setReady(blob); else onFinished(blob, kind) })
      .catch((e: { cancelled?: boolean }) => onFailed(!!e?.cancelled))
      .finally(() => { running.current = null; setProgress(null) })
  }

  const scales: Array<{ value: ExportScale; label: string }> = [
    { value: '1x', label: '1×' },
    { value: '2x', label: '2×' },
    { value: '4x', label: '4×' },
    { value: 'custom', label: t('export.custom') },
  ]

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !running.current) onClose() }}>
      <div className="overlay-sheet" role="dialog" aria-modal="true" aria-label={t('export.title')}>
        <h2 className="overlay-title">{t('export.title')}</h2>
        <fieldset className="panel-fieldset" disabled={progress !== null || !!ready}>
          {mode === 'download' && (
            <>
              <Label>{t('export.format')}</Label>
              <Segmented
                value={kind}
                onChange={setKind}
                options={[{ value: 'png', label: t('export.formatPng') }, { value: 'separations', label: t('export.formatSeps') }, { value: 'pdf', label: t('export.formatPdf') }]}
              />
              <p className="sheet-note">{t(kind === 'separations' ? 'export.sepsNote' : kind === 'pdf' ? 'export.pdfNote' : 'export.pngNote')}</p>
            </>
          )}
          {kind !== 'pdf' && <><Label>{t('export.background')}</Label>
          <Segmented
            value={paperOn ? 'paper' : 'transparent'}
            onChange={(v) => onPaper(v === 'paper')}
            options={[{ value: 'paper', label: t('export.withPaper') }, { value: 'transparent', label: t('export.transparent') }]}
          />
          <p className="sheet-note">{paperOn ? t('export.bgNoteWith') : t('export.bgNoteTransparent')}</p></>}

          <Label>{t('export.size')}</Label>
          <div className="chips" role="group" aria-label={t('export.size')}>
            {scales.map((s) => {
              const tooBig = s.value !== 'custom' && exportDpi(s.value, 0) > maxDpi
              return (
                <button type="button" key={s.value} className={scale === s.value ? 'on' : ''} aria-pressed={scale === s.value} disabled={tooBig} onClick={() => onScale(s.value)}>
                  {s.label}
                </button>
              )
            })}
          </div>
          {scale === 'custom' && (
            <RangeControl
              label={t('export.resolution')}
              display={`${dpi} dpi`}
              value={dpi}
              min={MIN_DPI}
              max={maxDpi}
              onChange={onCustomDpi}
            />
          )}
          <p className="sheet-note export-summary">
            {tf('export.summary', {
              w: px.w, h: px.h,
              pw: formatLength(sheet.widthMm, unit), ph: formatLength(sheet.heightMm, unit),
              unit: t(`unitShort.${unit}`), dpi,
            })}
          </p>
          {exportDpi(scale, customDpi) > maxDpi && <p className="sheet-note">{tf('export.limit', { dpi: maxDpi })}</p>}

          <Label>{t('export.units')}</Label>
          <Segmented
            value={unit}
            onChange={onUnit}
            options={[{ value: 'mm', label: t('unit.mm') }, { value: 'cm', label: t('unit.cm') }, { value: 'in', label: t('unit.in') }]}
          />
        </fieldset>

        {ready ? (
          <button type="button" className="wide-btn dark" onClick={() => onShare(ready)}>{t('export.share')}</button>
        ) : progress === null ? (
          <button type="button" className="wide-btn dark" onClick={go}>{mode === 'share' ? t('export.prepareShare') : kind === 'separations' ? t('export.goSeps') : kind === 'pdf' ? t('export.goPdf') : t('export.go')}</button>
        ) : (
          <div className="export-progress" role="status" aria-live="polite">
            <span className="ring" style={{ '--p': `${Math.round(progress * 100)}%` } as React.CSSProperties} aria-hidden="true" />
            <span className="label">{tf('export.working', { p: Math.round(progress * 100) })}</span>
            <button type="button" className="text-link" onClick={() => running.current?.cancel()}>{t('export.cancel')}</button>
          </div>
        )}
        <p className="sheet-note">{t('export.later')}</p>
      </div>
    </div>
  )
}
