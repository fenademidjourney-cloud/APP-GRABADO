import { describe, expect, it } from 'vitest'
import { packProject, unpackProject, unzip, ProjectError } from './project'
import { DEFAULT_DOC } from '../model/doc'
import { applyPreset } from '../presets/apply'
import { sanitizeDoc } from '../model/sanitize'

const layer = sanitizeDoc({ layers: [{ id: 'L1', assetId: 'sha256-abc', name: 'foto', natural: { w: 10, h: 20 } }] }).layers[0]

describe('project files (.imprenta)', () => {
  it('round-trips the document and the original bytes', async () => {
    const doc = { ...applyPreset(DEFAULT_DOC, 'etching'), seed: 1234, layers: [layer] }
    const original = new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], { type: 'image/png' })
    const svg = new Blob(['<svg/>'], { type: 'image/svg+xml' })
    const raster = new Blob([new Uint8Array([9, 9])], { type: 'image/png' })
    const blob = await packProject(doc, [
      { id: 'sha256-abc', name: 'foto', format: 'png', blob: original, render: original, natural: { w: 10, h: 20 } },
      { id: 'sha256-unused', name: 'x', format: 'svg', blob: svg, render: raster, natural: { w: 1, h: 1 } },
    ])
    const back = await unpackProject(blob)
    expect(back.doc).toEqual(doc)
    expect(back.missing).toBe(0)
    expect(back.assets).toHaveLength(1) // unused assets are not saved
    expect(new Uint8Array(await back.assets[0].blob.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71, 1, 2, 3]))
  })

  it('keeps the SVG raster beside the original', async () => {
    const svgLayer = { ...layer, assetId: 'sha256-svg' }
    const blob = await packProject({ ...DEFAULT_DOC, layers: [svgLayer] }, [
      { id: 'sha256-svg', name: 'logo', format: 'svg', blob: new Blob(['<svg/>']), render: new Blob([new Uint8Array([7])]), natural: { w: 4, h: 4 } },
    ])
    const files = await unzip(blob)
    expect([...files.keys()]).toEqual(['project.json', 'assets/sha256-svg', 'assets/sha256-svg.render'])
    const back = await unpackProject(blob)
    expect(new Uint8Array(await back.assets[0].render.arrayBuffer())).toEqual(new Uint8Array([7]))
  })

  it('drops layers whose image is missing and rejects other files', async () => {
    const blob = await packProject({ ...DEFAULT_DOC, layers: [layer] }, [])
    expect((await unpackProject(blob)).missing).toBe(1)
    await expect(unpackProject(new Blob(['hola']))).rejects.toBeInstanceOf(ProjectError)
  })
})
