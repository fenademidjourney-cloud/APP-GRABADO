// What kind of file is this? Pasted and dropped files often arrive without a MIME
// type, so the first bytes decide; the declared type and the extension are hints.

export type SourceFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'avif' | 'bmp' | 'svg' | 'heic' | 'tiff' | 'unknown'

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len))

export function sniffBytes(b: Uint8Array): SourceFormat {
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp'
  if (b.length >= 6 && ascii(b, 0, 4) === 'GIF8') return 'gif'
  if (b.length >= 2 && ascii(b, 0, 2) === 'BM') return 'bmp'
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a))) return 'tiff'
  if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4)
    if (brand === 'avif' || brand === 'avis') return 'avif'
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'heic'
  }
  const head = new TextDecoder().decode(b.subarray(0, Math.min(b.length, 512))).trimStart().toLowerCase()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg')) || head.includes('<svg')) return 'svg'
  return 'unknown'
}

export function formatFromHints(type: string, name: string): SourceFormat {
  const t = type.toLowerCase()
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (t === 'image/svg+xml' || ext === 'svg') return 'svg'
  if (t.includes('heic') || t.includes('heif') || ext === 'heic' || ext === 'heif') return 'heic'
  if (t === 'image/tiff' || ext === 'tif' || ext === 'tiff') return 'tiff'
  if (t === 'image/png' || ext === 'png') return 'png'
  if (t === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (t === 'image/webp' || ext === 'webp') return 'webp'
  return 'unknown'
}

/** Is this worth trying to import? (Rejects text, PDFs, videos… early.) */
export function looksLikeImage(type: string, name: string): boolean {
  return type === '' || type.startsWith('image/') || formatFromHints(type, name) !== 'unknown'
}
