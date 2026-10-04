import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { t, type TextKey } from '../../i18n'
import { Advanced, Label } from '../../ui/kit'
import { RangeControl, Segmented, Switch } from '../../ui/controls'
import { ProcessGlyph } from '../../ui/process-glyphs'
import { CATALOG, NAV_FAMILIES, type TechniqueEntry } from '../../presets/catalog'
import { INK_LIBRARY, type CleanToggles, type Doc, type InkMode, type PaperSettings, type Universal } from '../../model/doc'
import { PAPERS } from '../../model/paper'
import { ENGINE_PARAMS, PRESETS } from '../../presets/defs'
import type { ParamValue, Params } from '../../engines/types'
import { ParamControl } from '../../ui/ParamControl'
import { SHEET_SIZES } from '../../model/sheet'
import { IMPERFECTIONS, type ImperfectionId, type ImperfectionSettings } from '../../print/imperfections'
import { SEED_MAX } from '../../util/seed'

// Panel contents for the bottom sheet. Order inside every panel (04-componentes.md):
// quick row · essential sections with their Label · Advanced at the end, folded.

/** Controls that need an image sit at 30 % until there is one (they don't disappear). */
function NeedsImage({ ready, note, children }: { ready: boolean; note?: string; children: ReactNode }) {
  return (
    <>
      {!ready && <p className="sheet-note">{note ?? t('panel.needsImage')}</p>}
      <fieldset className={`panel-fieldset ${ready ? '' : 'off'}`} disabled={!ready}>{children}</fieldset>
    </>
  )
}

export interface SliderGesture { onPointerDown: () => void; onPointerUp: () => void }

type UniversalKey = keyof Universal

const UNIVERSAL_DEFS: Record<UniversalKey, { label: TextKey; hint: TextKey; min: number; max: number; signed?: boolean }> = {
  contrast: { label: 'effect.contrast', hint: 'effect.contrastHint', min: -100, max: 100, signed: true },
  ink: { label: 'effect.ink', hint: 'effect.inkHint', min: 0, max: 150 },
  detail: { label: 'effect.detail', hint: 'effect.detailHint', min: 0, max: 100 },
  pressure: { label: 'effect.pressure', hint: 'effect.pressureHint', min: 0, max: 100 },
  roughness: { label: 'effect.roughness', hint: 'effect.roughnessHint', min: 0, max: 100 },
  grain: { label: 'effect.grain', hint: 'effect.grainHint', min: 0, max: 100 },
  registration: { label: 'effect.registration', hint: 'effect.registrationHint', min: 0, max: 100 },
}

/** Controls that don't apply to the current settings (e.g. lpi with a stochastic screen). */
function inapplicable(engine: string, params: Params): string[] {
  if (engine !== 'screen') return []
  return params.shape === 'fm' ? ['lpi', 'angle', 'moire', 'detail'] : ['fmDot']
}

export function EffectPanel({ hasImage, technique, techniqueOn, inkCount, universal, params, onUniversal, onParam, gesture, zoomHint }: {
  hasImage: boolean
  technique: string
  techniqueOn: boolean
  inkCount: number
  universal: Universal
  params: Params
  onUniversal: (k: UniversalKey, v: number) => void
  onParam: (id: string, v: ParamValue, key?: string) => void
  gesture: SliderGesture
  /** The preview shows the screen smoothed (cells smaller than a few pixels). */
  zoomHint: boolean
}) {
  const def = PRESETS[technique]
  const engine = def && techniqueOn ? def.engine : 'none'
  const defs = ENGINE_PARAMS[engine]
  // With one ink there is nothing to register against.
  const off = [...inapplicable(engine, params), ...(inkCount < 2 ? ['registration'] : [])]

  const control = (id: string) => {
    const wrap = (node: ReactNode) => off.includes(id)
      ? <fieldset key={id} className="panel-fieldset off" disabled>{node}</fieldset>
      : <div key={id}>{node}</div>
    if (id in UNIVERSAL_DEFS) {
      const u = UNIVERSAL_DEFS[id as UniversalKey]
      const v = universal[id as UniversalKey]
      return wrap(
        <RangeControl
          label={t(u.label)}
          display={u.signed && v > 0 ? `+${v}%` : `${v}%`}
          value={v}
          min={u.min}
          max={u.max}
          gesture={gesture}
          hint={t(u.hint)}
          onChange={(n) => onUniversal(id as UniversalKey, n)}
        />,
      )
    }
    const p = defs.find((d) => d.id === id)
    return p ? wrap(<ParamControl def={p} value={params[id] ?? p.default} onChange={(v, key) => onParam(id, v, key)} gesture={gesture} />) : null
  }

  if (engine === 'none') {
    return (
      <div className="panel-body">
        <NeedsImage ready={hasImage}>
          {control('contrast')}
          {control('ink')}
          {control('pressure')}
          {/* Detail and scale belong to each technique's engine: until it exists they stay at 30 %. */}
          <p className="sheet-note">{t(def && !techniqueOn ? 'effect.techniqueOff' : 'effect.noEngine')}</p>
          <fieldset className="panel-fieldset off" disabled>
            <RangeControl label={t('effect.detail')} display="60%" value={60} min={0} max={100} onChange={() => {}} />
            <RangeControl label={t('effect.scale')} display="85 lpi" value={85} min={20} max={200} onChange={() => {}} />
          </fieldset>
          <Advanced>
            {control('grain')}
            {control('registration')}
          </Advanced>
        </NeedsImage>
      </div>
    )
  }

  return (
    <div className="panel-body">
      <NeedsImage ready={hasImage}>
        {def.essentials.map(control)}
        {zoomHint && <p className="sheet-note">{t('effect.zoomHint')}</p>}
        <Advanced>{def.advanced.map(control)}</Advanced>
      </NeedsImage>
    </div>
  )
}

function Check({ dark }: { dark?: boolean }) {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke={dark ? 'var(--black)' : 'var(--white)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.4L5.8 10L11 4.2" />
    </svg>
  )
}

export function InksPanel({ doc, onInkMode, onActiveInk, onInkColor }: {
  doc: Doc
  onInkMode: (m: InkMode) => void
  onActiveInk: (i: number) => void
  onInkColor: (hex: string, gesture?: boolean) => void
}) {
  const active = doc.inks[doc.activeInk]
  const isLibrary = INK_LIBRARY.some((c) => c.hex === active)
  const note = doc.inkMode === 'one' ? t('inks.oneNote') : doc.inkMode === 'two' ? t('inks.twoNote') : t('inks.manyNote')
  return (
    <div className="panel-body">
      <Label>{t('inks.title')}</Label>
      <Segmented
        value={doc.inkMode}
        onChange={onInkMode}
        options={[{ value: 'one', label: t('inks.one') }, { value: 'two', label: t('inks.two') }, { value: 'many', label: t('inks.many') }]}
      />
      <p className="sheet-note">{note}</p>
      {doc.inks.length > 1 && (
        <div className="chips ink-chips" role="group" aria-label={t('inks.title')}>
          {doc.inks.map((hex, i) => (
            <button type="button" key={i} className={i === doc.activeInk ? 'on' : ''} aria-pressed={i === doc.activeInk} onClick={() => onActiveInk(i)}>
              <span className="ink-dot" style={{ '--swatch': hex } as CSSProperties} aria-hidden="true" />
              {i + 1}
            </button>
          ))}
        </div>
      )}
      <Label>{t('inks.library')}</Label>
      <div className="swatches">
        {INK_LIBRARY.map((c) => (
          <button
            type="button"
            key={c.id}
            className={`swatch ${c.light ? 'swatch-light' : ''} ${c.hex === active ? 'on' : ''}`}
            style={{ '--swatch': c.hex } as CSSProperties}
            aria-label={c.name}
            title={c.name}
            aria-pressed={c.hex === active}
            onClick={() => onInkColor(c.hex)}
          >
            {c.hex === active && <Check dark={c.light} />}
          </button>
        ))}
        <label className={`swatch swatch-custom ${!isLibrary ? 'on' : ''}`} style={!isLibrary ? ({ '--swatch': active } as CSSProperties) : undefined} title={t('inks.custom')}>
          <input type="color" aria-label={t('inks.custom')} value={active} onChange={(e) => onInkColor(e.target.value, true)} />
          {!isLibrary && <Check />}
        </label>
      </div>
    </div>
  )
}

export function MaterialPanel({ toggles, onToggle, paper, onPaper, imperfections, onImperfections, gesture }: {
  toggles: CleanToggles
  onToggle: (k: keyof CleanToggles, on: boolean) => void
  paper: PaperSettings
  onPaper: (p: Partial<PaperSettings>, key?: string) => void
  imperfections: ImperfectionSettings
  onImperfections: (p: Partial<ImperfectionSettings>, key?: string) => void
  gesture: SliderGesture
}) {
  const toggleImp = (id: ImperfectionId) => {
    const on = imperfections.enabled.includes(id)
    onImperfections({ enabled: IMPERFECTIONS.filter((x) => (x === id ? !on : imperfections.enabled.includes(x))) })
  }
  return (
    <div className="panel-body">
      <Switch label={t('material.paper')} hint={t('material.paperHint')} checked={toggles.paper} onChange={(on) => onToggle('paper', on)} />
      <fieldset className={`panel-fieldset ${toggles.paper ? '' : 'off'}`} disabled={!toggles.paper}>
        <Label>{t('material.paperType')}</Label>
        <div className="pick-grid">
          {PAPERS.map((p) => (
            <button type="button" key={p.id} className={`paper-card ${p.id === paper.id ? 'on' : ''}`} aria-pressed={p.id === paper.id} onClick={() => onPaper({ id: p.id })}>
              <span className="paper-tile" style={{ '--paper': p.color } as CSSProperties} aria-hidden="true" />
              <span className="paper-name">{p.name}</span>
            </button>
          ))}
        </div>
        <RangeControl label={t('material.texture')} display={`${paper.texture}%`} value={paper.texture} min={0} max={100} gesture={gesture} onChange={(v) => onPaper({ texture: v }, 'paper-texture')} />
      </fieldset>
      <Switch label={t('material.imperfections')} hint={t('material.imperfectionsHint')} checked={toggles.imperfections} onChange={(on) => onToggle('imperfections', on)} />
      <fieldset className={`panel-fieldset ${toggles.imperfections ? '' : 'off'}`} disabled={!toggles.imperfections}>
        <div className="chips" role="group" aria-label={t('material.imperfections')}>
          {IMPERFECTIONS.map((id) => {
            const on = imperfections.enabled.includes(id)
            return <button type="button" key={id} className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggleImp(id)}>{t(`imp.${id}`)}</button>
          })}
        </div>
        <p className="sheet-note">{t('material.impNote')}</p>
        <RangeControl label={t('material.amount')} display={`${imperfections.amount}%`} value={imperfections.amount} min={0} max={100} gesture={gesture} onChange={(v) => onImperfections({ amount: v }, 'imp-amount')} />
      </fieldset>
      <Advanced>
        <fieldset className={`panel-fieldset ${toggles.paper ? '' : 'off'}`} disabled={!toggles.paper}>
          <RangeControl label={t('material.light')} display={`${paper.light}%`} value={paper.light} min={0} max={100} gesture={gesture} hint={t('material.lightHint')} onChange={(v) => onPaper({ light: v }, 'paper-light')} />
        </fieldset>
      </Advanced>
    </div>
  )
}

/** The seed: typed as a number, or a fresh one with NUEVA. A typed value applies on Enter or when leaving the field. */
function SeedControl({ seed, onSeed, onNewSeed }: { seed: number; onSeed: (s: number) => void; onNewSeed: () => void }) {
  const [text, setText] = useState(String(seed))
  useEffect(() => setText(String(seed)), [seed])
  const apply = () => {
    const n = Number(text.trim())
    if (Number.isInteger(n) && n >= 0 && n <= SEED_MAX) { if (n !== seed) onSeed(n) }
    else setText(String(seed))
  }
  return (
    <>
      <Label>{t('advanced.seed')}</Label>
      <div className="seed-row">
        <input
          className="field seed-field"
          type="text"
          inputMode="numeric"
          aria-label={t('advanced.seedField')}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={apply}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
        <div className="chips"><button type="button" aria-label={t('advanced.seedNewLabel')} onClick={onNewSeed}>{t('advanced.seedNew')}</button></div>
      </div>
      <p className="sheet-note">{t('advanced.seedNote')}</p>
    </>
  )
}

export function SheetSizes({ sheetId, onSheet }: { sheetId: string; onSheet: (id: string) => void }) {
  return (
    <div className="chips" role="group" aria-label={t('advanced.sheet')}>
      {SHEET_SIZES.map((s) => (
        <button type="button" key={s.id} className={s.id === sheetId ? 'on' : ''} aria-pressed={s.id === sheetId} onClick={() => onSheet(s.id)}>{s.label}</button>
      ))}
    </div>
  )
}

export function PrintAdvancedPanel({ doc, onToggle, onSheet, onSeed, onNewSeed }: {
  doc: Doc
  onToggle: (k: keyof CleanToggles, on: boolean) => void
  onSheet: (id: string) => void
  onSeed: (s: number) => void
  onNewSeed: () => void
}) {
  const sw = (k: keyof CleanToggles, key: TextKey, hint: TextKey) => <Switch key={k} label={t(key)} hint={t(hint)} checked={doc.toggles[k]} onChange={(on) => onToggle(k, on)} />
  return (
    <div className="panel-body">
      <Label>{t('advanced.clean')}</Label>
      <p className="sheet-note">{t('advanced.cleanNote')}</p>
      {sw('technique', 'advanced.technique', 'advanced.techniqueHint')}
      {sw('inkTexture', 'advanced.inkTexture', 'advanced.inkTextureHint')}
      {sw('imperfections', 'material.imperfections', 'advanced.imperfectionsHint')}
      {sw('paper', 'material.paper', 'material.paperHint')}
      {sw('color', 'advanced.color', 'advanced.colorHint')}
      {sw('registration', 'advanced.registration', 'advanced.registrationHint')}
      <SeedControl seed={doc.seed} onSeed={onSeed} onNewSeed={onNewSeed} />
      <Advanced>
        <Label>{t('advanced.sheet')}</Label>
        <SheetSizes sheetId={doc.sheetId} onSheet={onSheet} />
      </Advanced>
    </div>
  )
}

export function ComposeAdvancedPanel({ sheetId, onSheet }: { sheetId: string; onSheet: (id: string) => void }) {
  return (
    <div className="panel-body">
      <Label>{t('advanced.sheet')}</Label>
      <SheetSizes sheetId={sheetId} onSheet={onSheet} />
    </div>
  )
}

function TechniqueCard({ entry, on, onPick }: { entry: TechniqueEntry; on: boolean; onPick: () => void }) {
  return (
    <button type="button" className={`pick-card technique-card ${on ? 'on' : ''}`} aria-pressed={on} onClick={onPick}>
      <span className="technique-thumb" aria-hidden="true"><ProcessGlyph process={entry.process} size={30} /></span>
      <strong>{entry.name}</strong>
      <small>{entry.originalName}</small>
    </button>
  )
}

export function TechniqueList({ current, onPick }: { current: string; onPick: (id: string) => void }) {
  return (
    <div className="panel-body">
      <span className="label sheet-title">{t('technique.list')}</span>
      {NAV_FAMILIES.map((fam) => (
        <section key={fam}>
          <Label>{t(`family.${fam}`)}</Label>
          <div className="pick-tray">
            {CATALOG.filter((e) => e.mvp && e.nav === fam).map((e) => (
              <TechniqueCard key={e.id} entry={e} on={e.id === current} onPick={() => onPick(e.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
