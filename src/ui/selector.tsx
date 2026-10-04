import type { ReactNode } from 'react'
import { IconChevron } from './icons'

/** The kit's tool-row dropdown (04-componentes.md · Selector): black badge, name + subtitle, rotating chevron. */
export function Selector({ badge, name, sub, open, label, disabled, onClick }: {
  badge: ReactNode
  name: string
  sub: string
  open: boolean
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={`selector ${open ? 'open' : ''}`} aria-expanded={open} aria-label={`${label}: ${name}`} title={label} disabled={disabled} onClick={onClick}>
      <span className="selector-badge" aria-hidden="true">{badge}</span>
      <span className="selector-name"><strong>{name}</strong><small>{sub}</small></span>
      <span className="selector-chevron" aria-hidden="true"><IconChevron size={13} /></span>
    </button>
  )
}
