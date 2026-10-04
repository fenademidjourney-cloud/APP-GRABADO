import { describe, expect, it } from 'vitest'
import { pdfName, separationPdf } from './pdf'

describe('separation PDF', () => {
  it('escapes names', () => {
    expect(pdfName('Rosa flúor')).toBe('/Rosa#20fl#C3#BAor')
    expect(pdfName('A/B')).toBe('/A#2FB')
  })

  it('writes one /Separation per ink, overprint on, and a valid xref', async () => {
    const film = new Blob([new Uint8Array([1, 2, 3])])
    const pdf = separationPdf({ widthMm: 210, heightMm: 297, widthPx: 2, heightPx: 2, title: 'Prueba', inks: [
      { name: 'Negro', rgb: [0.1, 0.1, 0.1], film },
      { name: 'Negro', rgb: [0.1, 0.1, 0.1], film },
    ] })
    const bytes = new Uint8Array(await pdf.arrayBuffer())
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text.startsWith('%PDF-1.6')).toBe(true)
    expect(text).toContain('/Separation /Negro ')
    expect(text).toContain('/Separation /Negro#202 ')    // duplicate names get a number
    expect(text).toContain('/OP true /op true /OPM 1')
    expect(text).toMatch(/\/MediaBox \[0 0 595\.276 841\.89\]/)
    // Every xref offset points at its object.
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1])
    const table = text.slice(startxref).split('\n')
    const count = Number(table[1].split(' ')[1])
    for (let i = 1; i < count; i++) {
      const off = Number(table[2 + i].slice(0, 10))
      expect(text.slice(off, off + `${i} 0 obj`.length)).toBe(`${i} 0 obj`)
    }
  })
})
