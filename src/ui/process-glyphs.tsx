import type { ProcessFamily } from '../presets/catalog'

// Small marks for each process family, drawn white on the selector's black badge
// and on technique cards. They stand in until live thumbnails of the user's own
// image replace them (docs/PLANNING.md §J.1).

export function ProcessGlyph({ process, size = 22 }: { process: ProcessFamily; size?: number }) {
  const common = { viewBox: '0 0 22 22', width: size, height: size, 'aria-hidden': true, focusable: false } as const
  switch (process) {
    case 'relief': // a block with gouge cuts
      return (
        <svg {...common} fill="currentColor"><path d="M2 3h18v16H2z" /><path d="M5 7.5c3-.8 6 .8 12-.5M4.5 11.5c4-1 8 .6 13 0M6 15.5c3-.5 5 .3 9 0" style={{ stroke: 'var(--black)' }} strokeWidth="1.4" strokeLinecap="round" fill="none" /></svg>
      )
    case 'intaglio': // cross-hatching
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"><path d="M2 8l6-6M2 14L14 2M2 20L20 2M8 20l12-12M14 20l6-6" /><path d="M8 2l12 12M2 2l18 18M2 8l12 12" opacity=".55" /></svg>
      )
    case 'planographic': // crayon grain on stone
      return (
        <svg {...common} fill="currentColor">
          {[[4, 5, 1.1], [8, 3.5, .8], [13, 5, 1.3], [17.5, 4, .7], [3.5, 10, .8], [7.5, 9, 1.4], [11.5, 10.5, .9], [16, 9, 1.2], [5, 15, 1.3], [9.5, 14.5, .7], [14, 15.5, 1.4], [18, 14, .8], [3.5, 19, .7], [8, 18.5, 1.1], [12.5, 19.5, .8], [17.5, 18.5, 1.2], [10.5, 7, .6], [14.5, 12, .6]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
        </svg>
      )
    case 'stencil': // two overprinted inks
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8.5" cy="11" r="6" /><circle cx="13.5" cy="11" r="6" /><path d="M11 6.6a6 6 0 0 1 0 8.8a6 6 0 0 1 0-8.8z" fill="currentColor" /></svg>
      )
    case 'photomechanical': // halftone dots growing along a ramp
      return (
        <svg {...common} fill="currentColor">
          {[0, 1, 2, 3].flatMap((row) => [0, 1, 2, 3].map((col) => <circle key={`${row}-${col}`} cx={3.5 + col * 5} cy={3.5 + row * 5} r={0.6 + (col + row) * 0.32} />))}
        </svg>
      )
    case 'digital': // 1-bit pixels
      return (
        <svg {...common} fill="currentColor">
          {[[2, 2], [8, 2], [14, 2], [5, 5], [11, 5], [17, 5], [2, 8], [14, 8], [8, 11], [17, 11], [2, 14], [11, 14], [5, 17], [14, 17]].map(([x, y], i) => <rect key={i} x={x} y={y} width="3" height="3" />)}
        </svg>
      )
  }
}
