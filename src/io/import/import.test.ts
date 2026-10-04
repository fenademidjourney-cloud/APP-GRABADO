import { describe, expect, it } from 'vitest'
import { fnv1a64, hashBytes } from './hash'
import { formatFromHints, looksLikeImage, sniffBytes } from './sniff'
import { baseName } from './decode'

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? Array.from(x, (c) => c.charCodeAt(0)) : [x])))

describe('sniff', () => {
  it('recognises formats from their first bytes', () => {
    expect(sniffBytes(bytes(0x89, 'PNG', 13, 10, 26, 10))).toBe('png')
    expect(sniffBytes(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg')
    expect(sniffBytes(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('webp')
    expect(sniffBytes(bytes(0, 0, 0, 24, 'ftypheic', 0, 0, 0, 0))).toBe('heic')
    expect(sniffBytes(bytes(0, 0, 0, 24, 'ftypavif', 0, 0, 0, 0))).toBe('avif')
    expect(sniffBytes(bytes('II', 0x2a, 0))).toBe('tiff')
    expect(sniffBytes(bytes('  <?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('svg')
    expect(sniffBytes(bytes('hello'))).toBe('unknown')
  })

  it('falls back to type and extension hints', () => {
    expect(formatFromHints('', 'foto.HEIC')).toBe('heic')
    expect(formatFromHints('image/svg+xml', 'x')).toBe('svg')
    expect(looksLikeImage('application/pdf', 'doc.pdf')).toBe(false)
    expect(looksLikeImage('', 'pasted')).toBe(true)
  })
})

describe('hash', () => {
  it('is stable and content-based', async () => {
    const a = await hashBytes(bytes('abc'))
    expect(a).toBe('sha256-ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(fnv1a64(bytes('abc'))).toBe(fnv1a64(bytes('abc')))
    expect(fnv1a64(bytes('abc'))).not.toBe(fnv1a64(bytes('abd')))
  })
})

describe('names', () => {
  it('drops the extension and falls back when empty', () => {
    expect(baseName('retrato final.jpeg', 'Imagen')).toBe('retrato final')
    expect(baseName('', 'Imagen pegada')).toBe('Imagen pegada')
  })
})
