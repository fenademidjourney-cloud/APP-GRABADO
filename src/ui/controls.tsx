import type { CSSProperties, ReactNode } from 'react'

// Controles de los paneles: deslizador con etiqueta y valor, chip "Aleatorio",
// interruptor, segmentado, fila rápida. Estilos en base.css.
//
// En ARMA TU MATRIZ el deslizador además agrupa todo el arrastre en UN paso de
// deshacer (onPointerDown abre el gesto, onPointerUp lo cierra). Si la app nueva
// tiene historial, pasá esos handlers por `gesture`.

export function Control({ label, value, extra, children }: { label: string; value: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="control">
      <div className="control-head"><span>{label}</span>{extra}<strong>{value}</strong></div>
      {children}
    </div>
  )
}

/** Deslizador: etiqueta a la izquierda, valor a la derecha, pista fina con el tramo lleno. */
export function RangeControl({ label, display, value, min, max, step = 1, hint, extra, gesture, onChange }: {
  label: string
  display: string
  value: number
  min: number
  max: number
  step?: number
  hint?: string
  /** Algo chico junto a la etiqueta, p. ej. <ChipToggle> "Aleatorio". */
  extra?: ReactNode
  gesture?: { onPointerDown?: () => void; onPointerUp?: () => void }
  onChange: (value: number) => void
}) {
  return (
    <Control label={label} value={display} extra={extra}>
      <input
        style={{ '--p': `${((value - min) / Math.max(1e-9, max - min)) * 100}%` } as CSSProperties}
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        {...gesture}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <small>{hint}</small>}
    </Control>
  )
}

/** Chip conmutador chico (p. ej. "Aleatorio": cada uso toma un valor entre 0 y el elegido). */
export function ChipToggle({ on, label, title, onChange }: { on: boolean; label: string; title?: string; onChange: (on: boolean) => void }) {
  return (
    <button type="button" className={`chip-toggle ${on ? 'on' : ''}`} aria-pressed={on} title={title} onClick={() => onChange(!on)}>
      <span className="dot" aria-hidden="true" />{label}
    </button>
  )
}

/** Interruptor con título en mayúsculas y una línea de ayuda debajo. */
export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="switch">
      <span>{label}{hint && <small>{hint}</small>}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

/** Opciones excluyentes en una fila. */
export function Segmented<V extends string>({ options, value, onChange, className = '' }: {
  options: Array<{ value: V; label: ReactNode; title?: string }>
  value: V
  onChange: (value: V) => void
  className?: string
}) {
  return (
    <div className={`segmented ${className}`.trim()} role="group">
      {options.map((option) => (
        <button type="button" key={option.value} className={value === option.value ? 'active' : ''} aria-pressed={value === option.value} title={option.title} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Un grupo de botones cuadrados de ícono para la fila rápida (tres columnas iguales). */
export function QuickGroup<V extends string>({ label, options, value, disabled, onChange }: {
  label: string
  options: Array<{ value: V; icon: ReactNode; title: string }>
  value: V
  disabled?: boolean
  onChange: (value: V) => void
}) {
  return (
    <div className="quick-group" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.value} className={`qbtn ${value === o.value && !disabled ? 'on' : ''}`} disabled={disabled} aria-pressed={value === o.value} title={o.title} aria-label={o.title} onClick={() => onChange(o.value)}>
          {o.icon}
        </button>
      ))}
    </div>
  )
}

/** Interruptor compacto de la fila rápida: palabra corta + switch. */
export function QuickToggle({ label, title, checked, onChange }: { label: string; title: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className={`qtoggle ${checked ? 'on' : ''}`} title={title}>
      <span>{label}</span>
      <input type="checkbox" role="switch" aria-label={title} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
