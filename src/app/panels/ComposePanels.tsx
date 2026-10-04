import { useEffect, useState, type CSSProperties } from 'react'
import { t, tf } from '../../i18n'
import { Advanced, IconButton, Label } from '../../ui/kit'
import { RangeControl, Switch } from '../../ui/controls'
import { IconEye, IconEyeOff, IconLock } from '../../ui/icons-taller'
import type { BlendMode, Layer } from '../../model/layer'
import { clampScale, fitToSheet, normaliseAngle, resetCrop, visibleSize } from '../../model/layerOps'
import { getAsset } from '../../io/assets/assetStore'

// COMPONER panels: Mover, Recortar, Capas. They edit the selected layer; every
// slider drag is one undo step (`gesture`), every tap on a chip is one step.

export interface LayerEdit {
  /** Apply a change to the selected layer. Same `key` within 1 s = one undo step. */
  change: (fn: (l: Layer) => Layer, key?: string) => void
  /** Pass to sliders: the whole drag becomes one undo step. */
  gesture: { onPointerDown: () => void; onPointerUp: () => void }
}

type Sheet = { widthMm: number; heightMm: number }

function NoSelection({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p className="sheet-note">{t('move.pick')}</p>
      <fieldset className="panel-fieldset off" disabled>{children}</fieldset>
    </>
  )
}

export function MovePanel({ layer, sheet, edit }: { layer: Layer | null; sheet: Sheet; edit: LayerEdit }) {
  const maxW = Math.round(Math.max(sheet.widthMm, sheet.heightMm) * 2)
  const width = layer ? visibleSize(layer).w : 100
  const rotation = layer ? Math.round(layer.transform.rotation) : 0
  const controls = (
    <>
      <Label>{t('move.size')}</Label>
      <RangeControl
        label={t('move.width')}
        display={`${Math.round(width)} mm`}
        value={Math.min(maxW, Math.round(width))}
        min={5}
        max={maxW}
        gesture={edit.gesture}
        onChange={(w) => edit.change((l) => {
          const srcW = l.natural.w * (1 - l.crop.l - l.crop.r)
          return { ...l, transform: { ...l.transform, scale: clampScale(l, w / srcW, sheet) } }
        }, 'move-width')}
      />
      <RangeControl
        label={t('move.rotation')}
        display={`${rotation}°`}
        value={rotation}
        min={-180}
        max={180}
        gesture={edit.gesture}
        onChange={(r) => edit.change((l) => ({ ...l, transform: { ...l.transform, rotation: normaliseAngle(r) } }), 'move-rotation')}
      />
      <Label>{t('move.place')}</Label>
      <div className="chips" role="group" aria-label={t('move.place')}>
        <button type="button" onClick={() => edit.change((l) => fitToSheet(l, sheet, 'contain'))}>{t('move.fit')}</button>
        <button type="button" onClick={() => edit.change((l) => fitToSheet(l, sheet, 'cover'))}>{t('move.cover')}</button>
        <button type="button" onClick={() => edit.change((l) => ({ ...l, transform: { ...l.transform, x: sheet.widthMm / 2, y: sheet.heightMm / 2 } }))}>{t('move.center')}</button>
        <button
          type="button"
          className={layer?.transform.flipX ? 'on' : ''}
          aria-pressed={!!layer?.transform.flipX}
          onClick={() => edit.change((l) => ({ ...l, transform: { ...l.transform, flipX: !l.transform.flipX } }))}
        >
          {t('move.flip')}
        </button>
      </div>
      <p className="sheet-note">{t('move.placeNote')}</p>
    </>
  )
  return <div className="panel-body">{layer ? controls : <NoSelection>{controls}</NoSelection>}</div>
}

export function CropPanel({ layer, edit }: { layer: Layer | null; edit: LayerEdit }) {
  const cropped = !!layer && (layer.crop.l > 0 || layer.crop.t > 0 || layer.crop.r > 0 || layer.crop.b > 0)
  return (
    <div className="panel-body">
      <p className="sheet-note">{layer ? t('crop.note') : t('move.pick')}</p>
      <button type="button" className="wide-btn" disabled={!cropped} onClick={() => edit.change(resetCrop)}>{t('crop.reset')}</button>
    </div>
  )
}

/** A small preview of a layer's source (the browser decodes it; the URL is released on unmount). */
function LayerThumb({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const a = getAsset(assetId)
    if (!a) return
    const u = URL.createObjectURL(a.render)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [assetId])
  return <span className="layer-thumb" aria-hidden="true">{url && <img src={url} alt="" draggable={false} />}</span>
}

const BLENDS: BlendMode[] = ['normal', 'multiply', 'screen', 'darken', 'lighten']

export function LayersPanel({ layers, selectedId, inks, onSelect, onToggleVisible, edit }: {
  layers: Layer[]
  selectedId: string | null
  inks: string[]
  onSelect: (id: string) => void
  onToggleVisible: (id: string) => void
  edit: LayerEdit
}) {
  const selected = layers.find((l) => l.id === selectedId) ?? null
  const inkIndex = (target: string) => (target === 'auto' ? -1 : Number(target.replace('ink-', '')) - 1)
  return (
    <div className="panel-body">
      <Label>{t('layers.title')}</Label>
      {!layers.length && <p className="sheet-note">{t('layers.empty')}</p>}
      <div className="pick-list">
        {[...layers].reverse().map((l) => {
          const ink = inkIndex(l.inkTarget)
          return (
            <div key={l.id} className={`pick-card layer-row ${l.id === selectedId ? 'on' : ''} ${l.visible ? '' : 'hidden-layer'}`}>
              <button type="button" className="layer-pick" aria-pressed={l.id === selectedId} onClick={() => onSelect(l.id)}>
                <LayerThumb assetId={l.assetId} />
                <span className="layer-text">
                  <strong>{l.name}</strong>
                  <small>
                    {ink >= 0 && inks[ink] ? <span className="ink-dot inline" style={{ '--swatch': inks[ink] } as CSSProperties} /> : null}
                    {ink >= 0 ? tf('layers.inkName', { n: ink + 1 }) : t('layers.inkAuto')} · {tf('layers.size', { w: l.natural.w, h: l.natural.h })}
                  </small>
                </span>
                {l.locked && <span className="layer-lock" aria-hidden="true"><IconLock size={15} /></span>}
              </button>
              <IconButton label={l.visible ? t('layers.hide') : t('layers.show')} active={false} onClick={() => onToggleVisible(l.id)}>
                {l.visible ? <IconEye size={19} /> : <IconEyeOff size={19} />}
              </IconButton>
            </div>
          )
        })}
      </div>

      {selected && (
        <>
          <Label>{t('layers.ink')}</Label>
          <div className="chips ink-chips" role="group" aria-label={t('layers.ink')}>
            <button type="button" className={selected.inkTarget === 'auto' ? 'on' : ''} aria-pressed={selected.inkTarget === 'auto'} onClick={() => edit.change((l) => ({ ...l, inkTarget: 'auto' }))}>
              {t('layers.inkAuto')}
            </button>
            {inks.map((hex, i) => {
              const id = `ink-${i + 1}`
              return (
                <button type="button" key={id} className={selected.inkTarget === id ? 'on' : ''} aria-pressed={selected.inkTarget === id} aria-label={tf('layers.inkName', { n: i + 1 })} onClick={() => edit.change((l) => ({ ...l, inkTarget: id }))}>
                  <span className="ink-dot" style={{ '--swatch': hex } as CSSProperties} aria-hidden="true" />
                  {i + 1}
                </button>
              )
            })}
          </div>
          <p className="sheet-note">{t('layers.inkNote')}</p>
          <RangeControl
            label={t('layers.opacity')}
            display={`${Math.round(selected.opacity * 100)}%`}
            value={Math.round(selected.opacity * 100)}
            min={0}
            max={100}
            gesture={edit.gesture}
            onChange={(v) => edit.change((l) => ({ ...l, opacity: v / 100 }), 'layer-opacity')}
          />
          <Advanced>
            <Label>{t('layers.blend')}</Label>
            <div className="chips" role="group" aria-label={t('layers.blend')}>
              {BLENDS.map((b) => (
                <button type="button" key={b} className={selected.blend === b ? 'on' : ''} aria-pressed={selected.blend === b} onClick={() => edit.change((l) => ({ ...l, blend: b }))}>
                  {t(`blend.${b}`)}
                </button>
              ))}
            </div>
            <Switch label={t('layers.lock')} hint={t('layers.lockHint')} checked={selected.locked} onChange={(on) => edit.change((l) => ({ ...l, locked: on }))} />
          </Advanced>
        </>
      )}
    </div>
  )
}
