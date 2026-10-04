import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

// The interface kit of the museum's design: icon buttons in pills, the bottom
// sheet, and the "Avanzado" disclosure. Styles live in styles.css.

export function IconButton({ label, active, onClick, children, disabled, className = '' }: {
  label: string
  active?: boolean
  onClick?: () => void
  children: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      className={`ibtn ${active ? 'on' : ''} ${className}`.trim()}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** A light grey rounded group of controls (the Figma's 171 × 33 pills). */
export function Pill({ children, className = '', label, white }: { children: ReactNode; className?: string; label?: string; white?: boolean }) {
  return <div className={`pill ${white ? 'pill-white' : ''} ${className}`.trim()} role="group" aria-label={label}>{children}</div>
}

/**
 * The bottom sheet: rounded top, a handle that resizes it, content that scrolls.
 * `height` is only used on phones; on a wide screen the sheet fills its column.
 */
export function Sheet({ children, height, onHeight, label, className = '' }: {
  children: ReactNode
  height: number
  onHeight: (h: number) => void
  label: string
  className?: string
}) {
  const start = useRef<{ y: number; h: number } | null>(null)
  const onDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    start.current = { y: e.clientY, h: height }
    const id = e.pointerId
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id || !start.current) return
      const max = Math.round(window.innerHeight * 0.7)
      onHeight(Math.max(150, Math.min(max, start.current.h + (start.current.y - ev.clientY))))
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return
      start.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  return (
    <section className={`sheet ${className}`.trim()} aria-label={label} style={{ '--sheet-h': `${height}px` } as CSSProperties}>
      <div className="sheet-handle" onPointerDown={onDown} aria-hidden="true"><span /></div>
      <div className="sheet-body">{children}</div>
    </section>
  )
}

/** The adult layer: fine settings one tap away, folded by default. */
export function Advanced({ children, label = 'Avanzado' }: { children: ReactNode; label?: string }) {
  return (
    <details className="advanced">
      <summary><span>{label}</span></summary>
      <div className="advanced-body">{children}</div>
    </details>
  )
}

/** A small uppercase label, the Figma's ETIQUETA style. */
export function Label({ children, as = 'h3' }: { children: ReactNode; as?: 'h3' | 'span' }) {
  const Tag = as
  return <Tag className="label">{children}</Tag>
}
