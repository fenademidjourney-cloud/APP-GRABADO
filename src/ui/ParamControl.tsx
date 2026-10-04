import { t } from '../i18n'
import { RangeControl } from './controls'
import { Label } from './kit'
import type { ParamDef, ParamValue } from '../engines/types'

// One control generated from a ParamDef (docs/PLANNING.md §E.1): numbers become the
// kit's slider, choices become chips. New presets and engines need no UI code.

export function ParamControl({ def, value, onChange, gesture }: {
  def: ParamDef
  value: ParamValue
  onChange: (v: ParamValue, key?: string) => void
  gesture?: { onPointerDown: () => void; onPointerUp: () => void }
}) {
  if (def.type === 'number') {
    const v = typeof value === 'number' ? value : def.default
    return (
      <RangeControl
        label={t(def.labelKey)}
        display={def.display(v)}
        value={v}
        min={def.min}
        max={def.max}
        step={def.step}
        hint={def.hintKey ? t(def.hintKey) : undefined}
        gesture={gesture}
        onChange={(n) => onChange(n, `param-${def.id}`)}
      />
    )
  }
  return (
    <>
      <Label>{t(def.labelKey)}</Label>
      <div className="chips" role="group" aria-label={t(def.labelKey)}>
        {def.options.map((o) => (
          <button type="button" key={o.value} className={value === o.value ? 'on' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {t(o.labelKey)}
          </button>
        ))}
      </div>
      {def.hintKey && <p className="sheet-note">{t(def.hintKey)}</p>}
    </>
  )
}
