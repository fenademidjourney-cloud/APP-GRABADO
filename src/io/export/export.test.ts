import { describe, expect, it } from 'vitest'
import { inflateSync } from 'node:zlib'
import { PngStreamWriter, crc32 } from './pngStream'
import { exportDpi, exportLimits, exportPixels, formatLength, maxDpiFor } from './size'

/** Minimal PNG reader for the tests: chunks, CRC check, and the unfiltered pixels. */
async function readPng(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(bytes.buffer)
  const chunks: Array<{ type: string; data: Uint8Array }> = []
  let o = 8
  while (o < bytes.length) {
    const len = view.getUint32(o)
    const type = String.fromCharCode(...bytes.subarray(o + 4, o + 8))
    const data = bytes.subarray(o + 8, o + 8 + len)
    expect(view.getUint32(o + 8 + len)).toBe(crc32(bytes.subarray(o + 4, o + 8 + len)))
    chunks.push({ type, data })
    o += 12 + len
  }
  const ihdr = new DataView(chunks[0].data.buffer, chunks[0].data.byteOffset)
  const width = ihdr.getUint32(0)
  const height = ihdr.getUint32(4)
  const channels = chunks[0].data[9] === 6 ? 4 : 3
  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => Buffer.from(c.data)))
  const raw = inflateSync(idat)
  const stride = width * channels
  const px = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i]
      const left = i >= channels ? px[y * stride + i - channels] : 0
      const up = y > 0 ? px[(y - 1) * stride + i] : 0
      px[y * stride + i] = (x + (f === 1 ? left : f === 2 ? up : 0)) & 0xff
    }
  }
  return { chunks, width, height, channels, px }
}

describe('streaming PNG', () => {
  it('uses the standard CRC-32 (known values)', () => {
    // Every PNG ends with an empty IEND chunk whose CRC is always AE 42 60 82.
    expect(crc32(new TextEncoder().encode('IEND'))).toBe(0xae426082)
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('writes a valid RGBA file band by band, with DPI', async () => {
    const w = 37
    const h = 23
    const src = new Uint8Array(w * h * 4).map((_, i) => (i * 7 + (i >> 5)) & 0xff)
    const png = new PngStreamWriter(w, h, 4, 300)
    await png.writeRows(src.subarray(0, w * 10 * 4), 10)
    await png.writeRows(src.subarray(w * 10 * 4), h - 10)
    const out = await readPng(await png.finish())
    expect(out.chunks.map((c) => c.type)).toEqual(['IHDR', 'sRGB', 'pHYs', 'IDAT', 'IEND'])
    expect([out.width, out.height, out.channels]).toEqual([w, h, 4])
    expect(Array.from(out.px)).toEqual(Array.from(src))
    const phys = new DataView(out.chunks[2].data.buffer, out.chunks[2].data.byteOffset)
    expect(phys.getUint32(0)).toBe(Math.round(300 / 0.0254)) // 11811 px/m
  })

  it('writes RGB and refuses to finish with rows missing', async () => {
    const png = new PngStreamWriter(4, 2, 3, 150)
    await png.writeRows(new Uint8Array(4 * 3).fill(200), 1)
    await expect(png.finish()).rejects.toThrow()
  })
})

describe('export size', () => {
  const a4 = { widthMm: 210, heightMm: 297 }
  it('maps scales to dpi and pixels', () => {
    expect(exportDpi('2x', 0)).toBe(300)
    expect(exportPixels(a4, 300)).toEqual({ w: 2480, h: 3508 })
    expect(exportDpi('custom', 99999)).toBe(2400)
  })
  it('keeps exports within the device limits', () => {
    const phone = exportLimits(true)
    const dpi = maxDpiFor(a4, phone)
    const px = exportPixels(a4, dpi)
    expect(Math.max(px.w, px.h)).toBeLessThanOrEqual(phone.maxSide)
    expect(px.w * px.h).toBeLessThanOrEqual(phone.maxPixels)
  })
  it('formats physical lengths', () => {
    expect(formatLength(210, 'cm')).toBe('21')
    expect(formatLength(297, 'cm')).toBe('29,7')
    expect(formatLength(210, 'in')).toBe('8,27')
  })
})
