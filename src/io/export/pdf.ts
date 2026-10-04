// Print-shop PDF (docs/PLANNING.md §I · PDF de imprenta, Phase 12): one image per ink
// in its own /Separation colour space, named after the ink, painted with overprint
// on (/OP /op /OPM 1) and Multiply blending — so Acrobat's Output Preview lists one
// plate per ink, and any viewer shows the inks mixing as they would on paper.
// A minimal writer: objects, xref, trailer; images deflated as they are rendered.

/** Raw rows (8-bit, `channels` per pixel) compressed with zlib deflate (/FlateDecode). */
export class DeflateRowWriter {
  private parts: Uint8Array[] = []
  private writer: WritableStreamDefaultWriter<Uint8Array>
  private reading: Promise<void>
  private rows = 0

  constructor(readonly width: number, readonly height: number, readonly channels: 1 | 3 | 4 = 1) {
    const stream = new CompressionStream('deflate')
    this.writer = stream.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>
    const reader = stream.readable.getReader()
    this.reading = (async () => {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        this.parts.push(value)
      }
    })()
  }

  async writeRows(rows: Uint8Array, count: number): Promise<void> {
    this.rows += count
    await this.writer.write(rows.slice(0, count * this.width * this.channels))
  }

  async finish(): Promise<Blob> {
    if (this.rows !== this.height) throw new Error(`pdf: ${this.rows} of ${this.height} rows`)
    await this.writer.close()
    await this.reading
    return new Blob(this.parts as Uint8Array<ArrayBuffer>[])
  }

  abort() {
    this.writer.abort().catch(() => {})
  }
}

export interface PdfInk {
  name: string                 // shown as the separation's name
  rgb: [number, number, number] // 0..1, the on-screen look (alternate colour space)
  /** Deflated 8-bit grey film, `widthPx × heightPx`, 255 = paper, 0 = full ink. */
  film: Blob
}

/** A PDF name: bytes outside the printable range (and delimiters) as #xx. */
export function pdfName(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let out = '/'
  for (const b of bytes) {
    const c = String.fromCharCode(b)
    out += b < 33 || b > 126 || '#/()<>[]{}%'.includes(c) ? `#${b.toString(16).padStart(2, '0').toUpperCase()}` : c
  }
  return out
}

/** A PDF text string as UTF-16BE hex with BOM (safe for any title). */
function pdfText(s: string): string {
  let hex = 'FEFF'
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (code > 0xffff) {
      const v = code - 0x10000
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0')
    } else hex += code.toString(16).padStart(4, '0')
  }
  return `<${hex.toUpperCase()}>`
}

const num = (v: number) => (Math.round(v * 1000) / 1000).toString()

export function separationPdf(o: { widthMm: number; heightMm: number; widthPx: number; heightPx: number; title: string; inks: PdfInk[] }): Blob {
  const enc = new TextEncoder()
  const W = (o.widthMm / 25.4) * 72
  const H = (o.heightMm / 25.4) * 72
  const parts: BlobPart[] = []
  const offsets: number[] = []
  let pos = 0
  const push = (p: string | Blob) => {
    if (typeof p === 'string') { const b = enc.encode(p); parts.push(b); pos += b.length } else { parts.push(p); pos += p.size }
  }
  const obj = (id: number, body: string | Array<string | Blob>) => {
    offsets[id] = pos
    push(`${id} 0 obj\n`)
    for (const b of Array.isArray(body) ? body : [body]) push(b)
    push('\nendobj\n')
  }

  // Unique separation names (two inks of the same colour still get two plates).
  const seen = new Map<string, number>()
  const names = o.inks.map((ink) => {
    const n = (seen.get(ink.name) ?? 0) + 1
    seen.set(ink.name, n)
    return n > 1 ? `${ink.name} ${n}` : ink.name
  })

  // 1 catalog · 2 pages · 3 page · 4 contents · 5 graphics state · 6 info · then 3 per ink.
  const inkObj = (i: number) => 7 + i * 3
  const xobjects = o.inks.map((_, i) => `/Im${i + 1} ${inkObj(i)} 0 R`).join(' ')
  const content = o.inks.map((_, i) => `q ${num(W)} 0 0 ${num(H)} 0 0 cm /Im${i + 1} Do Q`).join('\n')

  push('%PDF-1.6\n%\xE2\xE3\xCF\xD3\n')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(W)} ${num(H)}] /TrimBox [0 0 ${num(W)} ${num(H)}] /Resources << /XObject << ${xobjects} >> /ExtGState << /Gs1 5 0 R >> >> /Contents 4 0 R >>`)
  const stream = `/Gs1 gs\n${content}\n`
  obj(4, [`<< /Length ${enc.encode(stream).length} >>\nstream\n`, stream, 'endstream'])
  obj(5, '<< /Type /ExtGState /OP true /op true /OPM 1 /BM /Multiply >>')
  obj(6, `<< /Title ${pdfText(o.title)} /Producer ${pdfText('TALLER DE GRABADO')} >>`)
  o.inks.forEach((ink, i) => {
    const id = inkObj(i)
    obj(id, [
      `<< /Type /XObject /Subtype /Image /Width ${o.widthPx} /Height ${o.heightPx} /ColorSpace ${id + 1} 0 R /BitsPerComponent 8 /Decode [1 0] /Filter /FlateDecode /Length ${ink.film.size} >>\nstream\n`,
      ink.film,
      '\nendstream',
    ])
    obj(id + 1, `[/Separation ${pdfName(names[i])} /DeviceRGB ${id + 2} 0 R]`)
    obj(id + 2, `<< /FunctionType 2 /Domain [0 1] /C0 [1 1 1] /C1 [${ink.rgb.map(num).join(' ')}] /N 1 >>`)
  })

  const count = 7 + o.inks.length * 3
  const xref = pos
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`
  for (let i = 1; i < count; i++) table += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  push(table)
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts, { type: 'application/pdf' })
}
