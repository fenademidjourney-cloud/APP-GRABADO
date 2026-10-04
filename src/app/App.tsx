import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t, tf, type TextKey } from '../i18n'
import { IconButton, Pill, Sheet } from '../ui/kit'
import { IconDice, IconGear, IconPalette } from '../ui/icons'
import { IconBurin, IconCrop, IconLayers, IconMove, IconPaper, IconPlus } from '../ui/icons-taller'
import { Selector } from '../ui/selector'
import { ProcessGlyph } from '../ui/process-glyphs'
import { techniqueById } from '../presets/catalog'
import { SHEET_SIZES, DEFAULT_SHEET } from '../model/sheet'
import { DEFAULT_DOC, inksFor, moveInk, opacitiesFor, INK_LIBRARY, type CleanToggles, type Doc, type InkMode, type PaperSettings, type Universal } from '../model/doc'
import { createLayer, type Layer } from '../model/layer'
import { paperById } from '../model/paper'
import { applyPreset } from '../presets/apply'
import { engineOf, variantsOf } from '../presets/defs'
import { rollVariant } from '../presets/variant'
import { imperfectionMask, type ImperfectionSettings } from '../print/imperfections'
import { registrationOffsets } from '../print/registration'
import { IMPRESSION, impressionModelOf } from '../print/impression'
import { newSeed } from '../util/seed'
import { resolveScreen } from '../engines/screen/params'
import { resolveStencil } from '../engines/stencil/params'
import { resolveRelief } from '../engines/relief/params'
import { resolveLine } from '../engines/line/params'
import type { PrintScene as PS } from '../render/scene'
import type { ParamValue } from '../engines/types'
import type { PrintScene } from '../render/scene'
import { duplicateLayer, reorder, updateLayer } from '../model/layerOps'
import { ImportError, importBlob, type ImportErrorCode, type ImportedAsset } from '../io/import/decode'
import { clipboardButtonAvailable, fetchImageUrl, gatherFromTransfer, readClipboardImages, transferMayHoldImage, type Candidate } from '../io/import/gather'
import { putAsset } from '../io/assets/assetStore'
import { beginGesture, canRedo, canUndo, commit, createHistory, endGesture, redo, undo, type History } from './store/history'
import { AUTOSAVE_MS, restoreDoc, saveDoc } from './store/autosave'
import { loadPrefs, savePrefs, type ComposeTab, type Mode, type PrintTab } from './prefs'
import { useNotice } from './useNotice'
import { Header } from './Header'
import { CanvasCard, type FloatAction } from './CanvasCard'
import { ComposeAdvancedPanel, EffectPanel, InksPanel, MaterialPanel, PrintAdvancedPanel, TechniqueList } from './panels/Panels'
import { CropPanel, LayersPanel, MovePanel, type LayerEdit } from './panels/ComposePanels'
import { DiagSheet, GuideSheet } from './Overlays'
import { ExportSheet, canShareFiles, isCoarsePointer, type ExportKind, type Exporter } from './ExportSheet'

// The screen: header · canvas card · tool row · bottom sheet (03-anatomia-y-layout.md).
// Images enter by file picker, drag & drop, paste (Ctrl/Cmd + V) or the PEGAR
// button; each one becomes a layer, and a whole import is one undo step.

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/avif,image/heic,image/heif,.heic,.heif,.tif,.tiff'

const IMPORT_NOTICE: Record<ImportErrorCode, TextKey> = {
  'not-image': 'notice.notImage',
  heic: 'notice.heic',
  tiff: 'notice.tiff',
  decode: 'notice.decode',
  remote: 'notice.remote',
  'clipboard-empty': 'notice.clipboardEmpty',
}

export default function App() {
  const [prefs, setPrefs] = useState(loadPrefs)
  const [hist, setHist] = useState<History<Doc>>(() => createHistory(applyPreset(DEFAULT_DOC, DEFAULT_DOC.technique)))
  const [techniqueOpen, setTechniqueOpen] = useState(false)
  const [overlay, setOverlay] = useState<'none' | 'guide' | 'diag' | 'export' | 'share'>(() => (location.hash === '#diag' ? 'diag' : 'none'))
  const exporterRef = useRef<Exporter | null>(null)
  const [notice, showNotice] = useNotice()
  const [dropActive, setDropActive] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const storageWarned = useRef(false)
  const doc = hist.present
  const docRef = useRef(doc)
  docRef.current = doc
  const hasImage = doc.layers.length > 0
  // Selection is interface state, not document: it is never an undo step. If undo
  // removes the selected layer, nothing is selected.
  const [selectedRaw, setSelected] = useState<string | null>(null)
  const selectedId = doc.layers.some((l) => l.id === selectedRaw) ? selectedRaw : null
  const selectedLayer = doc.layers.find((l) => l.id === selectedId) ?? null
  const [restored, setRestored] = useState(false)

  useEffect(() => savePrefs(prefs), [prefs])

  const setDoc = useCallback((fn: (d: Doc) => Doc, key?: string) => setHist((h) => commit(h, fn(h.present), key)), [])
  const doUndo = useCallback(() => setHist(undo), [])
  const doRedo = useCallback(() => setHist(redo), [])

  // Restore the last session (not an undo step), then autosave every change half a
  // second after the last one. Nothing is saved before the restore finishes, so an
  // empty start can never overwrite the saved work.
  useEffect(() => {
    let alive = true
    restoreDoc().then((r) => {
      if (!alive) return
      if (r) setHist(createHistory(r.doc))
      if (r?.missing) window.setTimeout(() => showNotice(r.missing === 1 ? t('notice.missingOne') : tf('notice.missing', { n: r.missing })), 300)
      setRestored(true)
    })
    return () => { alive = false }
  }, [showNotice])

  useEffect(() => {
    if (!restored || hist.gesture) return
    const id = window.setTimeout(() => saveDoc(doc), AUTOSAVE_MS)
    return () => window.clearTimeout(id)
  }, [doc, restored, hist.gesture])

  /** Edits on one layer. During a gesture every update replaces the present (history.ts). */
  const editLayer = useCallback((id: string, fn: (l: Layer) => Layer, key?: string) =>
    setDoc((d) => ({ ...d, layers: updateLayer(d.layers, id, fn) }), key), [setDoc])
  const gestureBegin = useCallback(() => setHist(beginGesture), [])
  const gestureEnd = useCallback(() => setHist(endGesture), [])
  const layerEdit: LayerEdit = {
    change: (fn, key) => { if (selectedId) editLayer(selectedId, fn, key) },
    gesture: { onPointerDown: gestureBegin, onPointerUp: gestureEnd },
  }

  const floatAction = useCallback((a: FloatAction) => {
    const id = selectedId
    if (!id) return
    if (a === 'crop') {
      setPrefs((p) => ({ ...p, composeTab: p.composeTab === 'crop' ? 'move' : 'crop' }))
    } else if (a === 'up' || a === 'down') {
      setDoc((d) => ({ ...d, layers: reorder(d.layers, id, a === 'up' ? 1 : -1) }))
    } else if (a === 'duplicate') {
      const src = docRef.current.layers.find((l) => l.id === id)
      if (!src) return
      const copy = duplicateLayer(src)
      setDoc((d) => {
        const i = d.layers.findIndex((l) => l.id === id)
        return { ...d, layers: [...d.layers.slice(0, i + 1), copy, ...d.layers.slice(i + 1)] }
      })
      setSelected(copy.id)
      showNotice(t('notice.duplicated'))
    } else if (a === 'delete') {
      setDoc((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }))
      showNotice(t('notice.deleted'))
    }
  }, [selectedId, setDoc, showNotice])

  useEffect(() => {
    const typing = (e: KeyboardEvent) => !!(e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        if (typing(e)) return
        e.preventDefault()
        if (e.shiftKey) doRedo()
        else doUndo()
        return
      }
      if (prefs.mode !== 'compose' || !selectedId || typing(e)) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); floatAction('delete') }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); floatAction('duplicate') }
      else if (mod && e.key === ']') { e.preventDefault(); floatAction('up') }
      else if (mod && e.key === '[') { e.preventDefault(); floatAction('down') }
      else if (e.key === 'Escape') setSelected(null)
      else if (e.altKey && e.key.startsWith('Arrow')) {
        // Alt + arrows nudge the layer (05-interaccion.md): 1 mm, 10 mm with Shift.
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        editLayer(selectedId, (l) => ({ ...l, transform: { ...l.transform, x: l.transform.x + dx, y: l.transform.y + dy } }), 'nudge')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doUndo, doRedo, prefs.mode, selectedId, floatAction, editLayer])

  useEffect(() => {
    const onHash = () => setOverlay(location.hash === '#diag' ? 'diag' : 'none')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const sheet = useMemo(() => SHEET_SIZES.find((s) => s.id === doc.sheetId) ?? DEFAULT_SHEET, [doc.sheetId])
  const technique = techniqueById(doc.technique)
  // What the renderer needs to print: a new object only when one of these changes.
  const print: Omit<PrintScene, 'compare'> = useMemo(() => {
    const paper = paperById(doc.paper.id)
    const u = doc.universal
    const modelId = impressionModelOf(doc.technique)
    const model = IMPRESSION[modelId]
    const engine = doc.toggles.technique ? engineOf(doc.technique) : 'none'
    const stencil = engine === 'stencil' ? resolveStencil(doc.params, u, doc.inks.length, modelId === 'screenprint' ? 'mesh' : 'master') : null
    const relief = engine === 'relief' ? resolveRelief(doc.params, u) : undefined
    let lines: PS['lines']
    if (engine === 'line') {
      lines = resolveLine(doc.params, u, doc.seed)
    } else if (relief && relief.gouges > 0) {
      // Woodcut v2: gouge cuts, white, following the forms, entering and leaving tapered.
      lines = {
        build: {
          spacingMm: 1.1, angleDeg: Number(doc.params.grainAngle) || 0, follow: 0.8, layers: 1, swell: 1, taper: 0.9,
          tremorMm: (u.roughness / 100) * 0.06, detail: u.detail / 100, mode: 'gouge',
          gougeLow: relief.gougeLow, gougeHigh: relief.threshold, seed: doc.seed,
        },
      }
    }
    return {
      inks: doc.inks,
      inkOpacity: doc.inkOpacity.map((o) => o / 100),
      inkDensity: u.ink / 100,
      contrast: u.contrast / 100,
      paperOn: doc.toggles.paper,
      colorOn: doc.toggles.color,
      seed: doc.seed,
      registration: registrationOffsets(doc.seed, doc.toggles.registration ? u.registration : 0, doc.inks.length),
      impression: {
        on: doc.toggles.inkTexture,
        pressure: u.pressure / 100,
        grain: u.grain / 100,
        // Ink wicks along the fibres: more with absorbent paper, a full film and pressure.
        bleedMm: doc.toggles.paper ? 0.12 * model.bleed * paper.absorb * Math.min(1.5, u.ink / 100) * (0.5 + u.pressure / 100) : 0,
        // A deep impression drives the plate into the valleys of the paper.
        contact: model.contact * (engine === 'relief' ? 1 - 0.8 * (Number(doc.params.deboss) || 0) / 100 : 1),
        depletion: model.depletion,
        bandsAcross: model.bandsAcross,
        intaglio: modelId === 'intaglio',
      },
      imperfections: {
        amount: doc.toggles.imperfections ? doc.imperfections.amount / 100 : 0,
        mask: imperfectionMask(doc.imperfections.enabled),
      },
      paper: { color: paper.color, fibre: paper.fibre, flocs: paper.flocs, texture: doc.paper.texture / 100, relief: paper.relief, light: doc.paper.light / 100 },
      screen: engine === 'screen' ? resolveScreen(doc.params, u, doc.inks.length) : stencil?.screen,
      stencil: stencil?.stencil,
      relief,
      lines,
    }
  }, [doc.inks, doc.universal, doc.toggles, doc.paper, doc.technique, doc.params, doc.seed, doc.imperfections])
  const [screenLod, setScreenLod] = useState(false)

  const setMode = (mode: Mode) => { setTechniqueOpen(false); setPrefs((p) => ({ ...p, mode })) }
  const setPrintTab = (printTab: PrintTab) => { setTechniqueOpen(false); setPrefs((p) => ({ ...p, printTab })) }
  const setComposeTab = (composeTab: ComposeTab) => setPrefs((p) => ({ ...p, composeTab }))
  const chooseImage = () => fileInput.current?.click()

  /** Decode, keep and place a batch of candidates: one undo step for the whole batch. */
  const importCandidates = useCallback(async (items: Candidate[], fallbackName: string) => {
    const done: ImportedAsset[] = []
    let firstError: ImportErrorCode | null = null
    for (const item of items) {
      try {
        const asset = await importBlob(item.blob, item.name, fallbackName)
        const persisted = await putAsset(asset)
        if (!persisted && !storageWarned.current) {
          storageWarned.current = true
          window.setTimeout(() => showNotice(t('notice.noStorage')), 1500)
        }
        done.push(asset)
      } catch (e) {
        firstError ??= e instanceof ImportError ? e.code : 'decode'
      }
    }
    if (done.length) {
      const current = docRef.current
      const wasEmpty = current.layers.length === 0
      const sheet = SHEET_SIZES.find((s) => s.id === current.sheetId) ?? DEFAULT_SHEET
      const added = done.map((a, i) => createLayer(a.id, a.name, a.natural, sheet, current.layers.length + i))
      setDoc((d) => ({ ...d, layers: [...d.layers, ...added] }))
      setSelected(added[added.length - 1].id)
      // The first image goes straight to printing (docs/PLANNING.md §J.1).
      if (wasEmpty) { setTechniqueOpen(false); setPrefs((p) => ({ ...p, mode: 'print' })) }
      showNotice(done.length === 1 ? t('notice.added') : tf('notice.addedMany', { n: done.length }))
    } else if (firstError) {
      showNotice(t(IMPORT_NOTICE[firstError]))
    }
  }, [setDoc, showNotice])

  const importTransfer = useCallback(async (dt: DataTransfer, fallbackName: string) => {
    // Read everything synchronously: the DataTransfer empties after the event returns.
    const { files, urls, rejected } = gatherFromTransfer(dt)
    if (files.length) return importCandidates(files, fallbackName)
    if (rejected && !urls.length) return showNotice(t('notice.notImage'))
    const fetched: Candidate[] = []
    for (const u of urls) {
      try { fetched.push(await fetchImageUrl(u)) } catch { /* reported below if nothing worked */ }
    }
    if (fetched.length) return importCandidates(fetched, fallbackName)
    if (urls.length) showNotice(t('notice.remote'))
  }, [importCandidates, showNotice])

  const pasteFromClipboard = async () => {
    try {
      await importCandidates(await readClipboardImages(), t('layers.pasted'))
    } catch (e) {
      showNotice(t(e instanceof ImportError ? IMPORT_NOTICE[e.code] : 'notice.clipboardDenied'))
    }
  }

  // Paste anywhere (Ctrl/Cmd + V), except while typing in a field.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input[type="text"], textarea, [contenteditable]')) return
      if (!e.clipboardData) return
      e.preventDefault()
      importTransfer(e.clipboardData, t('layers.pasted'))
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [importTransfer])

  // Drop anywhere on the app; the card shows where it lands.
  useEffect(() => {
    let depth = 0
    const enter = (e: DragEvent) => {
      if (!transferMayHoldImage(e.dataTransfer)) return
      e.preventDefault()
      depth++
      setDropActive(true)
    }
    const over = (e: DragEvent) => {
      if (!transferMayHoldImage(e.dataTransfer)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (!depth) setDropActive(false)
    }
    const drop = (e: DragEvent) => {
      depth = 0
      setDropActive(false)
      if (!e.dataTransfer || !transferMayHoldImage(e.dataTransfer)) return
      e.preventDefault()
      importTransfer(e.dataTransfer, t('layers.dropped'))
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [importTransfer])

  const onToggle = (k: keyof CleanToggles, on: boolean) => setDoc((d) => ({ ...d, toggles: { ...d.toggles, [k]: on } }))
  const onSheet = (sheetId: string) => setDoc((d) => ({ ...d, sheetId }))
  const onUniversal = (k: keyof Universal, v: number) => setDoc((d) => ({ ...d, universal: { ...d.universal, [k]: v } }), `universal-${k}`)
  const onPaper = (p: Partial<PaperSettings>, key?: string) => setDoc((d) => ({ ...d, paper: { ...d.paper, ...p } }), key)
  const onImperfections = (p: Partial<ImperfectionSettings>, key?: string) => setDoc((d) => ({ ...d, imperfections: { ...d.imperfections, ...p } }), key)
  const onSeed = (seed: number) => setDoc((d) => ({ ...d, seed }))
  const onNewSeed = () => { setDoc((d) => ({ ...d, seed: newSeed(d.seed) })); showNotice(t('notice.seed')) }
  // Variante (the dice): another style of the technique and a new seed, in one undo step.
  const onVariant = () => {
    const current = docRef.current
    const { doc: next, index } = rollVariant(current, newSeed(current.seed))
    setDoc(() => next)
    showNotice(tf('notice.variant', { name: t(variantsOf(current.technique)[index].nameKey) }))
  }
  const sliderGesture = { onPointerDown: gestureBegin, onPointerUp: gestureEnd }
  const onParam = (id: string, v: ParamValue, key?: string) => setDoc((d) => ({ ...d, params: { ...d.params, [id]: v } }), key)
  const onInkMode = (inkMode: InkMode) => setDoc((d) => {
    const inks = inksFor(inkMode, d.inks)
    return { ...d, inkMode, inks, inkOpacity: opacitiesFor(inks.length, d.inkOpacity), activeInk: Math.min(d.activeInk, inks.length - 1) }
  })
  const onInkOpacity = (v: number) => setDoc((d) => ({ ...d, inkOpacity: d.inkOpacity.map((o, i) => (i === d.activeInk ? v : o)) }), `ink-opacity-${doc.activeInk}`)
  const onMoveInk = (dir: -1 | 1) => setDoc((d) => moveInk(d, d.activeInk, dir))
  const onActiveInk = (activeInk: number) => setDoc((d) => ({ ...d, activeInk }), 'active-ink')
  // The colour picker fires continuously while dragging: coalesce it into one step by key.
  const onInkColor = (hex: string, gesture?: boolean) =>
    setDoc((d) => ({ ...d, inks: d.inks.map((c, i) => (i === d.activeInk ? hex : c)) }), gesture ? `ink-color-${doc.activeInk}` : undefined)

  // Export: a PNG named after the technique and its size, saved with a plain download link
  // (works on file:// too); sharing hands the same file to the system share sheet.
  const fileName = (blob: Blob, w: number, h: number, kind: ExportKind = 'png') => kind === 'separations'
    ? new File([blob], `taller-de-grabado-${doc.technique}-${w}x${h}-separaciones.zip`, { type: 'application/zip' })
    : new File([blob], `taller-de-grabado-${doc.technique}-${w}x${h}.png`, { type: 'image/png' })
  const lastSize = useRef({ w: 0, h: 0 })
  const startExport = (o: { dpi: number; widthPx: number; heightPx: number; kind: ExportKind }, onProgress: (p: number) => void) => {
    lastSize.current = { w: o.widthPx, h: o.heightPx }
    // Films are named after their pass and colour: "tinta-1-rosa-fluor.png".
    const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const names = {
      inks: doc.inks.map((hex, i) => `${tf('sep.ink', { n: i + 1 })}-${slug(INK_LIBRARY.find((c) => c.hex === hex)?.name ?? hex.slice(1))}.png`),
      print: `${t('sep.print')}.png`,
    }
    return exporterRef.current?.(
      { ...o, names, transparent: !doc.toggles.paper, tileSize: isCoarsePointer() ? 1024 : 2048 },
      (done, total) => onProgress(done / total),
    ) ?? null
  }
  const download = (blob: Blob, kind: ExportKind = 'png') => {
    const file = fileName(blob, lastSize.current.w, lastSize.current.h, kind)
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setOverlay('none')
    showNotice(t(kind === 'separations' ? 'notice.exportedZip' : 'notice.exported'))
  }
  const share = async (blob: Blob) => {
    const file = fileName(blob, lastSize.current.w, lastSize.current.h)
    try {
      await navigator.share({ files: [file] })
      setOverlay('none')
      showNotice(t('notice.shared'))
    } catch (e) {
      // Closing the share sheet is not an error; anything else falls back to a download.
      if ((e as DOMException)?.name !== 'AbortError') download(blob)
    }
  }

  const closeOverlay = () => {
    if (location.hash === '#diag') history.replaceState(null, '', location.pathname + location.search)
    setOverlay('none')
  }

  let panel
  if (prefs.mode === 'print') {
    if (techniqueOpen) panel = <TechniqueList current={doc.technique} onPick={(id) => { setDoc((d) => applyPreset(d, id)); setTechniqueOpen(false) }} />
    else if (prefs.printTab === 'effect') panel = (
      <EffectPanel
        hasImage={hasImage}
        technique={doc.technique}
        techniqueOn={doc.toggles.technique}
        inkCount={doc.inks.length}
        universal={doc.universal}
        params={doc.params}
        onUniversal={onUniversal}
        onParam={onParam}
        gesture={sliderGesture}
        zoomHint={screenLod}
      />
    )
    else if (prefs.printTab === 'inks') panel = <InksPanel doc={doc} onInkMode={onInkMode} onActiveInk={onActiveInk} onInkColor={onInkColor} onInkOpacity={onInkOpacity} onMoveInk={onMoveInk} gesture={sliderGesture} />
    else if (prefs.printTab === 'material') panel = <MaterialPanel toggles={doc.toggles} onToggle={onToggle} paper={doc.paper} onPaper={onPaper} imperfections={doc.imperfections} onImperfections={onImperfections} gesture={sliderGesture} />
    else panel = <PrintAdvancedPanel doc={doc} onToggle={onToggle} onSheet={onSheet} onSeed={onSeed} onNewSeed={onNewSeed} />
  } else {
    if (prefs.composeTab === 'advanced') panel = <ComposeAdvancedPanel sheetId={doc.sheetId} onSheet={onSheet} />
    else if (prefs.composeTab === 'move') panel = <MovePanel layer={selectedLayer} sheet={sheet} edit={layerEdit} />
    else if (prefs.composeTab === 'crop') panel = <CropPanel layer={selectedLayer} edit={layerEdit} />
    else panel = (
      <LayersPanel
        layers={doc.layers}
        selectedId={selectedId}
        inks={doc.inks}
        onSelect={setSelected}
        onToggleVisible={(id) => editLayer(id, (l) => ({ ...l, visible: !l.visible }))}
        edit={layerEdit}
      />
    )
  }

  return (
    <div className="app-shell">
      <Header
        mode={prefs.mode}
        onMode={setMode}
        canUndo={canUndo(hist)}
        canRedo={canRedo(hist)}
        canExport={hasImage}
        onUndo={doUndo}
        onRedo={doRedo}
        onExport={() => setOverlay('export')}
        onShare={() => setOverlay(canShareFiles() ? 'share' : 'export')}
      />

      <main className="mode">
        <div className="mode-main">
          <CanvasCard
            exporterRef={exporterRef}
            sheet={sheet}
            layers={doc.layers}
            print={print}
            notice={notice}
            dropActive={dropActive}
            canPaste={clipboardButtonAvailable()}
            onChoose={chooseImage}
            onPaste={pasteFromClipboard}
            onHelp={() => setOverlay('guide')}
            onNotice={showNotice}
            composing={prefs.mode === 'compose'}
            tool={prefs.composeTab === 'crop' ? 'crop' : 'transform'}
            selectedId={selectedId}
            onSelect={setSelected}
            onLayerGesture={{
              begin: gestureBegin,
              update: (id, patch) => editLayer(id, (l) => ({ ...l, ...patch })),
              end: gestureEnd,
            }}
            onFloat={floatAction}
            onScreenLod={setScreenLod}
          />
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              e.target.value = ''
              if (files.length) importCandidates(files.map((f) => ({ blob: f, name: f.name })), t('layers.dropped'))
            }}
          />
        </div>

        <div className="mode-side">
          {prefs.mode === 'print' ? (
            <div className="toolrow">
              <Pill label={t('print.panels')}>
                <IconButton label={t('print.effect')} active={!techniqueOpen && prefs.printTab === 'effect'} onClick={() => setPrintTab('effect')}><IconBurin size={20} /></IconButton>
                <IconButton label={t('print.inks')} active={!techniqueOpen && prefs.printTab === 'inks'} onClick={() => setPrintTab('inks')}><IconPalette size={20} /></IconButton>
                <IconButton label={t('print.material')} active={!techniqueOpen && prefs.printTab === 'material'} onClick={() => setPrintTab('material')}><IconPaper size={20} /></IconButton>
                <IconButton label={t('print.advanced')} active={!techniqueOpen && prefs.printTab === 'advanced'} onClick={() => setPrintTab('advanced')}><IconGear size={20} /></IconButton>
              </Pill>
              <Selector
                badge={<ProcessGlyph process={technique.process} />}
                name={technique.name}
                sub={t(`process.${technique.process}`)}
                open={techniqueOpen}
                label={t('print.technique')}
                onClick={() => setTechniqueOpen((o) => !o)}
              />
              <IconButton className="solo" label={t('print.variant')} disabled={!hasImage} onClick={onVariant}><IconDice size={20} /></IconButton>
            </div>
          ) : (
            <div className="toolrow">
              <Pill label={t('compose.panels')}>
                <IconButton label={t('compose.move')} active={prefs.composeTab === 'move'} disabled={!hasImage} onClick={() => setComposeTab('move')}><IconMove size={20} /></IconButton>
                <IconButton label={t('compose.crop')} active={prefs.composeTab === 'crop'} disabled={!hasImage} onClick={() => setComposeTab('crop')}><IconCrop size={19} /></IconButton>
                <IconButton label={t('compose.layers')} active={prefs.composeTab === 'layers'} onClick={() => setComposeTab('layers')}><IconLayers size={20} /></IconButton>
                <IconButton label={t('compose.advanced')} active={prefs.composeTab === 'advanced'} onClick={() => setComposeTab('advanced')}><IconGear size={20} /></IconButton>
              </Pill>
              <Selector
                badge={<IconLayers size={20} />}
                name={selectedLayer?.name ?? (hasImage ? doc.layers[doc.layers.length - 1].name : t('compose.noLayer'))}
                sub={!hasImage ? t('compose.noLayerSub') : doc.layers.length === 1 ? t('compose.layerCountOne') : tf('compose.layerCount', { n: doc.layers.length })}
                open={false}
                label={t('compose.layer')}
                disabled={!hasImage}
                onClick={() => setComposeTab('layers')}
              />
              <IconButton className="solo" label={t('compose.add')} onClick={chooseImage}><IconPlus size={20} /></IconButton>
            </div>
          )}

          <Sheet height={prefs.sheetH} onHeight={(sheetH) => setPrefs((p) => ({ ...p, sheetH }))} label={t('card.label')}>
            {panel}
          </Sheet>
        </div>
      </main>

      {overlay === 'guide' && <GuideSheet onClose={closeOverlay} />}
      {overlay === 'diag' && <DiagSheet onClose={closeOverlay} />}
      {(overlay === 'export' || overlay === 'share') && (
        <ExportSheet
          mode={overlay === 'share' ? 'share' : 'download'}
          sheet={sheet}
          paperOn={doc.toggles.paper}
          scale={prefs.exportScale}
          customDpi={prefs.exportDpi}
          unit={prefs.unit}
          onPaper={(on) => onToggle('paper', on)}
          onScale={(exportScale) => setPrefs((p) => ({ ...p, exportScale }))}
          onCustomDpi={(exportDpi) => setPrefs((p) => ({ ...p, exportDpi }))}
          onUnit={(unit) => setPrefs((p) => ({ ...p, unit }))}
          start={startExport}
          onFinished={download}
          onFailed={(cancelled) => showNotice(t(cancelled ? 'notice.exportCancelled' : 'notice.exportFailed'))}
          onShare={share}
          onClose={closeOverlay}
        />
      )}
    </div>
  )
}

