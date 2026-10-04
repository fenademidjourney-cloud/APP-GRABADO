import { describe, expect, it } from 'vitest'
import { resolveStencil, MAX_SIMPLIFY_MM } from './params'
import { presetParams, PRESETS } from '../../presets/defs'
import { applyPreset } from '../../presets/apply'
import { DEFAULT_DOC, moveInk } from '../../model/doc'
import { sanitizeDoc } from '../../model/sanitize'
import { zip } from '../../io/export/zip'
import { crc32 } from '../../io/export/pngStream'

const u = { detail: 100, pressure: 50, roughness: 20 }

describe('stencil engine', () => {
  it('riso builds on the master grid, screenprint on the mesh', () => {
    const riso = resolveStencil(presetParams('risograph'), u, 2, 'master')
    expect(riso.stencil.gridMm).toBeCloseTo(25.4 / 600)
    expect(riso.stencil.gridAngle).toBe(0)
    expect(riso.screen?.lpi).toBe(65)
    const screen = resolveStencil(presetParams('screenprint'), u, 2, 'mesh')
    expect(screen.stencil.gridMm).toBeCloseTo(10 / 90)
    expect(screen.stencil.gridAngle).not.toBe(0)
  })

  it('solid fill sends no screen; levels and detail map to posterize and smoothing', () => {
    const pop = resolveStencil(presetParams('pop-screenprint'), { ...u, detail: 0 }, 3, 'mesh')
    expect(pop.screen).toBeUndefined()
    expect(pop.stencil.fill).toBe(0)
    expect(pop.stencil.levels).toBe(2)
    expect(pop.stencil.simplifyMm).toBeCloseTo(MAX_SIMPLIFY_MM)
    expect(resolveStencil(presetParams('risograph-grain'), u, 2, 'master').screen?.fm).toBe(true)
  })

  it('every stencil preset applies to a valid document', () => {
    for (const id of ['risograph', 'risograph-grain', 'screenprint', 'pop-screenprint']) {
      const d = applyPreset(DEFAULT_DOC, id)
      expect(PRESETS[id].essentials.length).toBeLessThanOrEqual(5)
      expect(d.inkOpacity).toHaveLength(d.inks.length)
      expect(sanitizeDoc(d)).toEqual(d)
    }
  })
})

describe('ink order', () => {
  it('moves colour, opacity and the layers sent to the ink together', () => {
    const layer = (id: string, inkTarget: string) => ({ ...sanitizeDoc({ layers: [{ id, assetId: 'a', natural: { w: 1, h: 1 } }] }).layers[0], inkTarget })
    const d = { ...DEFAULT_DOC, inks: ['#000000', '#ff0000', '#00ff00'], inkOpacity: [10, 20, 30], activeInk: 0, layers: [layer('A', 'ink-1'), layer('B', 'ink-2'), layer('C', 'auto')] }
    const m = moveInk(d, 0, 1)
    expect(m.inks).toEqual(['#ff0000', '#000000', '#00ff00'])
    expect(m.inkOpacity).toEqual([20, 10, 30])
    expect(m.activeInk).toBe(1)
    expect(m.layers.map((l) => l.inkTarget)).toEqual(['ink-2', 'ink-1', 'auto'])
    expect(moveInk(d, 0, -1)).toBe(d)
  })

  it('sanitises opacities to the number of inks', () => {
    expect(sanitizeDoc({ ...DEFAULT_DOC, inkOpacity: [50, 900, 'x', 4] }).inkOpacity).toEqual([50, 100])
    expect(sanitizeDoc({ ...DEFAULT_DOC, inkOpacity: undefined }).inkOpacity).toEqual([0, 0])
  })
})

describe('zip', () => {
  it('stores the entries with their CRC and a central directory', async () => {
    const a = new TextEncoder().encode('hola')
    const b = new Uint8Array([1, 2, 3, 4, 5])
    const bytes = new Uint8Array(await zip([{ name: 'tinta-1.png', data: a }, { name: 'impresión.png', data: b }]).arrayBuffer())
    const v = new DataView(bytes.buffer)
    expect(v.getUint32(0, true)).toBe(0x04034b50)
    expect(v.getUint32(14, true)).toBe(crc32(a))
    const end = bytes.length - 22
    expect(v.getUint32(end, true)).toBe(0x06054b50)
    expect(v.getUint16(end + 10, true)).toBe(2)
    const cdOffset = v.getUint32(end + 16, true)
    expect(v.getUint32(cdOffset, true)).toBe(0x02014b50)
    // Second local header right after the first entry's data.
    expect(v.getUint32(30 + 'tinta-1.png'.length + a.length, true)).toBe(0x04034b50)
  })
})
