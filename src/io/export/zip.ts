// A minimal ZIP writer (docs/PLANNING.md §I · separaciones): entries are stored, not
// deflated — they are PNGs, already compressed. Local headers, central directory and
// end record, CRC-32 shared with the PNG encoder. Names are UTF-8 (flag bit 11).

import { crc32 } from './pngStream'

export interface ZipEntry { name: string; data: Uint8Array }

/** 1 January 2026, 00:00 in DOS format: a fixed date keeps the archive reproducible. */
const DOS_TIME = 0
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1

export function zip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder()
  const parts: BlobPart[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const e of entries) {
    const name = enc.encode(e.name)
    const crc = crc32(e.data)
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)          // version needed
    lv.setUint16(6, 0x0800, true)      // UTF-8 names
    lv.setUint16(8, 0, true)           // stored
    lv.setUint16(10, DOS_TIME, true)
    lv.setUint16(12, DOS_DATE, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, e.data.length, true)
    lv.setUint32(22, e.data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    parts.push(local, e.data as Uint8Array<ArrayBuffer>)

    const cd = new Uint8Array(46 + name.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)          // made by
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, DOS_TIME, true)
    cv.setUint16(14, DOS_DATE, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, e.data.length, true)
    cv.setUint32(24, e.data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    cd.set(name, 46)
    central.push(cd)
    offset += local.length + e.data.length
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)
  return new Blob([...parts, ...(central as Uint8Array<ArrayBuffer>[]), end], { type: 'application/zip' })
}
