// A streaming PNG encoder (docs/PLANNING.md §I). Rows go in as they are rendered,
// band by band, and are deflated on the fly with the platform's CompressionStream:
// the full image never has to exist in memory, and no canvas is involved (iOS caps
// canvases at ~16.7 MP). The file carries its DPI (pHYs) and is tagged sRGB.

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** Collected IDAT payload is flushed in chunks of about this size. */
const IDAT_TARGET = 256 * 1024

export class PngStreamWriter {
  private parts: BlobPart[] = []
  private writer: WritableStreamDefaultWriter<Uint8Array>
  private reading: Promise<void>
  private pending: Uint8Array[] = []
  private pendingBytes = 0
  private rowsWritten = 0
  private prevRow: Uint8Array

  /**
   * @param channels 1 = grey (separation films), 3 = RGB (opaque), 4 = RGBA with straight (non-premultiplied) alpha
   */
  constructor(readonly width: number, readonly height: number, readonly channels: 1 | 3 | 4, dpi: number) {
    const ihdr = new Uint8Array(13)
    const v = new DataView(ihdr.buffer)
    v.setUint32(0, width)
    v.setUint32(4, height)
    ihdr[8] = 8                       // bit depth
    ihdr[9] = channels === 4 ? 6 : channels === 3 ? 2 : 0  // colour type: RGBA / RGB / grey
    const phys = new Uint8Array(9)
    const pv = new DataView(phys.buffer)
    const ppm = Math.round(dpi / 0.0254)
    pv.setUint32(0, ppm)
    pv.setUint32(4, ppm)
    phys[8] = 1                       // unit: metre
    this.parts.push(SIGNATURE, chunk('IHDR', ihdr), chunk('sRGB', new Uint8Array([0])), chunk('pHYs', phys))
    this.prevRow = new Uint8Array(width * channels)
    const stream = new CompressionStream('deflate')
    this.writer = stream.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>
    const reader = stream.readable.getReader()
    this.reading = (async () => {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        this.pending.push(value)
        this.pendingBytes += value.length
        if (this.pendingBytes >= IDAT_TARGET) this.flushIdat()
      }
      this.flushIdat()
    })()
  }

  private flushIdat() {
    if (!this.pendingBytes) return
    const data = new Uint8Array(this.pendingBytes)
    let o = 0
    for (const p of this.pending) { data.set(p, o); o += p.length }
    this.parts.push(chunk('IDAT', data))
    this.pending = []
    this.pendingBytes = 0
  }

  /**
   * Append `count` rows, tightly packed (width × channels bytes each), top to bottom.
   * Each row gets PNG filter "Up" or "Sub", whichever is cheaper to compress.
   */
  async writeRows(rows: Uint8Array, count: number): Promise<void> {
    const stride = this.width * this.channels
    const bpp = this.channels
    const out = new Uint8Array(count * (stride + 1))
    for (let r = 0; r < count; r++) {
      const row = rows.subarray(r * stride, (r + 1) * stride)
      const prev = this.prevRow
      // Pick the filter with the smaller sum of absolute residuals (the usual heuristic).
      let sumSub = 0
      let sumUp = 0
      for (let i = 0; i < stride; i++) {
        const sub = (row[i] - (i >= bpp ? row[i - bpp] : 0)) & 0xff
        const up = (row[i] - prev[i]) & 0xff
        sumSub += sub < 128 ? sub : 256 - sub
        sumUp += up < 128 ? up : 256 - up
      }
      const base = r * (stride + 1)
      if (sumUp < sumSub) {
        out[base] = 2
        for (let i = 0; i < stride; i++) out[base + 1 + i] = (row[i] - prev[i]) & 0xff
      } else {
        out[base] = 1
        for (let i = 0; i < stride; i++) out[base + 1 + i] = (row[i] - (i >= bpp ? row[i - bpp] : 0)) & 0xff
      }
      this.prevRow = row.slice()
    }
    this.rowsWritten += count
    await this.writer.write(out)
  }

  async finish(): Promise<Blob> {
    if (this.rowsWritten !== this.height) throw new Error(`png: ${this.rowsWritten} of ${this.height} rows`)
    await this.writer.close()
    await this.reading
    this.parts.push(chunk('IEND', new Uint8Array(0)))
    return new Blob(this.parts, { type: 'image/png' })
  }

  /** Stop early (cancelled export): releases the compressor. */
  abort() {
    this.writer.abort().catch(() => {})
  }
}
