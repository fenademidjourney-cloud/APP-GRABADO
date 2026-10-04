// Icons added for TALLER DE GRABADO, drawn with the kit's rules (02-fundamentos.md):
// square box, 1.5 px stroke, round caps and joins, no fill, currentColor.
// The kit's own icons stay untouched in icons.tsx.

import type { ReactNode } from 'react'

type P = { size?: number }

function Svg({ size = 20, children }: P & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

/** Before / after: a circle split in half, the right half hatched. */
export const IconCompare = (p: P) => (
  <Svg {...p}><circle cx="10" cy="10" r="8.25" /><path d="M10 1.75V18.25M12.5 4.6H15.4M12.5 8H17.7M12.5 11.5H17.9M12.5 15H15.6" /></Svg>
)

/** Effect: a burin cutting a groove, with the curl of metal it lifts. */
export const IconBurin = (p: P) => (
  <Svg {...p}><path d="M3.2 2.6C4.6 1.6 6.6 2 7.6 3.4L12.6 9.2L10.2 11.4L4.2 6.8C2.8 5.8 2.2 3.8 3.2 2.6Z" /><path d="M12.6 9.2L15.4 14.6L10.2 11.4" /><path d="M13.2 17.6H18.2M15.6 14.8C17.4 14.6 18.4 15.6 18 17" /></Svg>
)

/** Material: a sheet with a deckled bottom edge. */
export const IconPaper = (p: P) => (
  <Svg {...p}><path d="M4 2.75H16V16.2C15 17.4 14 16.4 13 17.2C12 18 11 16.8 10 17.4C9 18 8 16.8 7 17.4C6 18 5 17 4 17.6V2.75Z" /><path d="M7 7H13M7 10.5H11" /></Svg>
)

/** Layers: three stacked sheets seen at an angle. */
export const IconLayers = (p: P) => (
  <Svg {...p}><path d="M10 2.5L18 6.5L10 10.5L2 6.5L10 2.5Z" /><path d="M2 10L10 14L18 10" /><path d="M2 13.5L10 17.5L18 13.5" /></Svg>
)

export const IconPlus = (p: P) => (
  <Svg {...p}><path d="M10 3.5V16.5M3.5 10H16.5" /></Svg>
)

/** Move: four arrows from the centre. */
export const IconMove = (p: P) => (
  <Svg {...p}><path d="M10 2V18M2 10H18M7.5 4.5L10 2L12.5 4.5M7.5 15.5L10 18L12.5 15.5M4.5 7.5L2 10L4.5 12.5M15.5 7.5L18 10L15.5 12.5" /></Svg>
)

export const IconCrop = (p: P) => (
  <Svg {...p}><path d="M5.5 1.75V14.5H18.25M1.75 5.5H14.5V18.25" /></Svg>
)

export const IconEye = (p: P) => (
  <Svg {...p}><path d="M1.75 10C3.6 6.4 6.6 4.5 10 4.5C13.4 4.5 16.4 6.4 18.25 10C16.4 13.6 13.4 15.5 10 15.5C6.6 15.5 3.6 13.6 1.75 10Z" /><circle cx="10" cy="10" r="2.6" /></Svg>
)

export const IconEyeOff = (p: P) => (
  <Svg {...p}><path d="M4.2 6.2C3.2 7.2 2.4 8.5 1.75 10C3.6 13.6 6.6 15.5 10 15.5C11.6 15.5 13.1 15.1 14.4 14.3M8 4.7C8.6 4.6 9.3 4.5 10 4.5C13.4 4.5 16.4 6.4 18.25 10C17.8 10.9 17.3 11.7 16.7 12.4M2.5 2.5L17.5 17.5" /></Svg>
)

export const IconDuplicate = (p: P) => (
  <Svg {...p}><rect x="6.5" y="6.5" width="11.25" height="11.25" rx="2" /><path d="M13.5 3.8C13.3 2.7 12.4 2.25 11.3 2.25H4.25C3.15 2.25 2.25 3.15 2.25 4.25V11.3C2.25 12.4 2.7 13.3 3.8 13.5" /></Svg>
)

export const IconArrowUp = (p: P) => (
  <Svg {...p}><path d="M10 16.5V3.5M4.5 9L10 3.5L15.5 9" /></Svg>
)

export const IconArrowDown = (p: P) => (
  <Svg {...p}><path d="M10 3.5V16.5M4.5 11L10 16.5L15.5 11" /></Svg>
)

export const IconLock = (p: P) => (
  <Svg {...p}><rect x="3.75" y="8.75" width="12.5" height="9" rx="2" /><path d="M6.5 8.75V6C6.5 4.1 8.1 2.5 10 2.5C11.9 2.5 13.5 4.1 13.5 6V8.75" /></Svg>
)
