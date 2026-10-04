import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { t } from '../i18n'
import { IconButton } from '../ui/kit'
import { IconHelp, IconTrash } from '../ui/icons'
import { IconArrowDown, IconArrowUp, IconCompare, IconCrop, IconDuplicate } from '../ui/icons-taller'
import { DEFAULT_DPI, type SheetSize } from '../model/sheet'
import type { Layer } from '../model/layer'
import { hitTest } from '../model/layerOps'
import { alphaMask, getAsset } from '../io/assets/assetStore'
import { RenderHost } from '../render/renderHost'
import type { PrintScene, Scene, SceneColors, Viewport } from '../render/scene'
import { FIT_VIEW, actualSizeZoom, maxZoom, sheetRect, zoomAt, type View } from '../render/view'
import { useCanvasGestures, type LayerGesture } from './canvas/useCanvasGestures'
import { SelectionOverlay, type HandleGesture } from './canvas/SelectionOverlay'
import type { Exporter } from './ExportSheet'

// The canvas card: the protagonist. The sheet is drawn by the renderer (worker when
// possible) and always fitted; it re-fits by itself when the content or the sheet
// size change (01-principios.md §2). Zoom and pan are view only: never undo steps.
// In COMPONER the selected layer gets its outline, handles and the floating bar.

export type FloatAction = 'duplicate' | 'crop' | 'up' | 'down' | 'delete'

const MAX_DPR = 2
const hosts = new WeakMap<HTMLCanvasElement, { host: RenderHost; pending?: number }>()

function readColors(): SceneColors {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return { card: v('--card', '#eeece5'), checkA: v('--control', '#f4f4f4'), checkB: v('--white', '#ffffff') }
}

export function CanvasCard({ exporterRef, sheet, layers, print, notice, dropActive, canPaste, onChoose, onPaste, onHelp, onNotice, composing, tool, selectedId, onSelect, onLayerGesture, onFloat, onScreenLod }: {
  /** Filled by the card: renders the current scene to a PNG (Exportar / Compartir). */
  exporterRef: MutableRefObject<Exporter | null>
  sheet: SheetSize
  layers: Layer[]
  /** COMPONER: layers can be picked, moved, scaled, rotated and cropped on the canvas. */
  composing: boolean
  tool: 'transform' | 'crop'
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** One undo step per gesture: begin → any number of updates → end. */
  onLayerGesture: { begin: () => void; update: (id: string, patch: Partial<Pick<Layer, 'transform' | 'crop'>>) => void; end: () => void }
  onFloat: (a: FloatAction) => void
  /** True while the preview has to smooth the screen (cells under ~5 device px). */
  onScreenLod: (smoothed: boolean) => void
  /** Inks, paper and toggles. Paper off = only the ink, over transparency (checkerboard). */
  print: Omit<PrintScene, 'compare'>
  notice: string
  dropActive: boolean
  canPaste: boolean
  onChoose: () => void
  onPaste: () => void
  onHelp: () => void
  onNotice: (text: string) => void
}) {
  const cardRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hostRef = useRef<RenderHost | null>(null)
  const [card, setCard] = useState({ w: 0, h: 0 })
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, MAX_DPR))
  const [view, setView] = useState<View>(FIT_VIEW)
  const [forceInline, setForceInline] = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
  const colors = useMemo(readColors, [])
  const hasImage = layers.length > 0
  // Comparar: while held (button or the \ key) the sheet shows the original.
  const [compare, setCompare] = useState(false)
  useEffect(() => {
    if (!hasImage) return
    const typing = (e: KeyboardEvent) => !!(e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')
    const down = (e: KeyboardEvent) => { if (e.key === '\\' && !typing(e)) setCompare(true) }
    const up = (e: KeyboardEvent) => { if (e.key === '\\') setCompare(false) }
    const blur = () => setCompare(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [hasImage])

  // Measure the card.
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setCard({ w: r.width, h: r.height })
      setDpr(Math.min(window.devicePixelRatio || 1, MAX_DPR))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    // Browser zoom or moving the window to another screen changes the pixel density
    // without always resizing the card.
    window.addEventListener('resize', update)
    return () => { ro.disconnect(); window.removeEventListener('resize', update) }
  }, [])

  // Re-fit when the sheet changes or the first image arrives (not on every edit: you may be zoomed in to compose).
  useEffect(() => setView(FIT_VIEW), [hasImage, sheet.id])
  // Masks arrive asynchronously; re-render once one is ready so taps use it. They are
  // prepared as soon as a layer exists, so even the first tap sees through transparency.
  const [, setMaskTick] = useState(0)
  useEffect(() => {
    if (!composing) return
    for (const l of layers) alphaMask(l.assetId, () => setMaskTick((n) => n + 1))
  }, [layers, composing])

  const viewport: Viewport = useMemo(() => ({ cssW: Math.max(1, card.w), cssH: Math.max(1, card.h), dpr }), [card.w, card.h, dpr])

  // Start the renderer once per canvas element. A canvas handed to the worker can't be
  // handed over again, so the host outlives React's dev double-mount (StrictMode):
  // disposal waits a tick and is cancelled if the same canvas mounts again.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let entry = hosts.get(canvas)
    if (entry) {
      window.clearTimeout(entry.pending)
    } else {
      entry = {
        host: new RenderHost(canvas, viewport, forceInline, {
          onFallback: () => { setForceInline(true); setCanvasKey((k) => k + 1) },
          onError: (m) => { if (m.code === 'no-webgl2') onNotice(t('notice.noWebgl')); else if (m.code === 'decode') onNotice(t('notice.decode')) },
        }),
      }
      hosts.set(canvas, entry)
    }
    hostRef.current = entry.host
    const current = entry
    return () => {
      current.pending = window.setTimeout(() => { current.host.dispose(); hosts.delete(canvas) }, 0)
      hostRef.current = null
    }
    // viewport/onNotice are read once at start; later changes go through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasKey, forceInline])

  useEffect(() => { hostRef.current?.setViewport(viewport) }, [viewport, canvasKey])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    for (const l of layers) {
      const a = getAsset(l.assetId)
      if (a) host.ensureAsset(a.id, a.render, a.natural)
    }
    const scene: Scene = {
      sheet: { widthMm: sheet.widthMm, heightMm: sheet.heightMm },
      colors,
      view,
      layers: layers.map(({ id, assetId, natural, visible, opacity, blend, transform, crop, inkTarget }) => ({ id, assetId, natural, visible, opacity, blend, transform, crop, inkTarget })),
      print: { ...print, compare: compare && hasImage },
    }
    host.setScene(scene)
    // Exports use the same scene (minus the view and Comparar), at the size they ask for.
    exporterRef.current = (o, onProgress) =>
      hostRef.current?.exportPng({ ...o, scene: { ...scene, print: { ...scene.print, compare: false } } }, onProgress) ?? null
  }, [layers, sheet, print, compare, hasImage, colors, view, canvasKey, exporterRef])

  const cardSize = { w: card.w, h: card.h }
  const max = maxZoom(cardSize, sheet, DEFAULT_DPI, dpr)
  const layerGesture: LayerGesture = {
    begin: onLayerGesture.begin,
    update: (id, transform) => onLayerGesture.update(id, { transform }),
    end: onLayerGesture.end,
  }
  const selected = composing ? layers.find((l) => l.id === selectedId) ?? null : null
  useCanvasGestures(cardRef, {
    card: cardSize,
    sheet,
    view,
    maxZoom: max,
    setView,
    layersActive: composing,
    layers,
    selectedId,
    hitTest: (x, y) => hitTest(layers, { x, y }, (id) => alphaMask(id, () => setMaskTick((n) => n + 1))),
    onSelect,
    layerGesture,
    onDoubleTap: (x, y) => {
      if (!hasImage) return
      if (view.zoom > 1.001) { setView(FIT_VIEW); onNotice(t('notice.zoomFit')); return }
      const target = Math.min(max, actualSizeZoom(cardSize, sheet, DEFAULT_DPI, dpr))
      setView(zoomAt(view, cardSize, sheet, target / view.zoom, x, y, max))
      onNotice(t('notice.zoom100'))
    },
  })

  const rect = sheetRect(cardSize, sheet, view)
  const compact = rect.w < 260 || rect.h < 300
  const sc = print.screen
  const cellDevicePx = sc ? (sc.fm ? sc.fmDotMm : 25.4 / sc.lpi) * rect.pxPerMm * dpr : Infinity
  const smoothed = hasImage && cellDevicePx < 5
  useEffect(() => onScreenLod(smoothed), [smoothed, onScreenLod])
  const handleGesture: HandleGesture | null = selected && {
    begin: onLayerGesture.begin,
    update: (patch) => onLayerGesture.update(selected.id, patch),
    end: onLayerGesture.end,
  }
  const index = selected ? layers.indexOf(selected) : -1

  return (
    <section className={`card ${dropActive ? 'drop-target' : ''}`} ref={cardRef} aria-label={t('card.label')}>
      <canvas key={canvasKey} ref={canvasRef} className="view-canvas" aria-hidden="true" />

      <button
        type="button"
        className={`card-btn left ${compare && hasImage ? 'on' : ''}`}
        aria-label={t('card.compare')}
        title={t('card.compare')}
        aria-pressed={compare && hasImage}
        disabled={!hasImage}
        onPointerDown={(e) => { setCompare(true); try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ } }}
        onPointerUp={() => setCompare(false)}
        onPointerCancel={() => setCompare(false)}
        onLostPointerCapture={() => setCompare(false)}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setCompare(true) }}
        onKeyUp={() => setCompare(false)}
      >
        <IconCompare size={18} />
      </button>
      <button type="button" className="card-btn right" aria-label={t('card.help')} title={t('card.help')} onClick={onHelp}>
        <IconHelp size={22} />
      </button>

      {!hasImage && card.w > 0 && (
        <div className="empty-wrap" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
          <div className={`empty ${compact ? 'compact' : ''}`}>
            <strong className="empty-title">{t('empty.title')}</strong>
            {!compact && <p className="empty-body">{t('empty.body')}</p>}
            <button type="button" className="wide-btn dark empty-btn" onClick={onChoose}>{t('empty.choose')}</button>
            {canPaste
              ? <button type="button" className="text-link" onClick={onPaste}>{t('empty.pasteButton')}</button>
              : <p className="empty-hint">{t('empty.paste')}</p>}
          </div>
        </div>
      )}

      {selected && handleGesture && card.w > 0 && (
        <SelectionOverlay layer={selected} rect={rect} mode={tool} sheet={sheet} gesture={handleGesture} />
      )}

      {selected && (
        <div className="float-bar" role="toolbar" aria-label={t('compose.selection')}>
          <IconButton label={t('compose.duplicate')} onClick={() => onFloat('duplicate')}><IconDuplicate size={19} /></IconButton>
          <IconButton label={t('compose.crop')} active={tool === 'crop'} onClick={() => onFloat('crop')}><IconCrop size={18} /></IconButton>
          <IconButton label={t('compose.up')} disabled={index === layers.length - 1} onClick={() => onFloat('up')}><IconArrowUp size={18} /></IconButton>
          <IconButton label={t('compose.down')} disabled={index === 0} onClick={() => onFloat('down')}><IconArrowDown size={18} /></IconButton>
          <IconButton label={t('compose.delete')} onClick={() => onFloat('delete')}><IconTrash size={18} /></IconButton>
        </div>
      )}

      {dropActive && <div className="drop-hint label">{t('card.drop')}</div>}
      <div className="notice" role="status" aria-live="polite">{notice}</div>
    </section>
  )
}
