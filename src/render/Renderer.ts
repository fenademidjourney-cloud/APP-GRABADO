// Draws the scene. Runs unchanged in the render worker (OffscreenCanvas) or, as a
// fallback, on the main thread (HTMLCanvasElement).
//
// Pipeline (docs/PLANNING.md §D). A "frame" maps the sheet (mm) onto a target of
// W × H pixels; the preview and every export tile are frames, drawn by the same code:
//   1. layer passes → offscreen targets
//        all:    every visible layer in colour (Comparar, "Color" off)
//        auto:   layers set to AUTO (they are separated into the inks)
//        plates: one grey positive per assigned ink, packed in RGB (inks 1–3, 4–6)
//      In the preview these are cached: they only re-run when layers, view or size change.
//   2. composite → separation + Beer–Lambert ink + procedural paper.
// Every stage recomputes from the sources: nothing degrades with edits, and an export
// is the same picture as the preview, only with more pixels.

import { layerQuad } from '../model/layer'
import { inkAbsorbance } from '../print/ink'
import { PngStreamWriter } from '../io/export/pngStream'
import { voidAndCluster } from '../analysis/bluenoise'
import { createProgram, parseHex, type GL, type Program } from './gl/gl'
import { COMPOSITE_FS, LAYER_FS, LAYER_VS, QUAD_VS, SHADOW_FS } from './shaders'
import { sheetRect } from './view'
import type { ExportJob, FromRenderer, PrintScene, Scene, SceneColors, Viewport } from './scene'

/** Longest side of a source texture in the preview. */
const PREVIEW_TEXTURE_MAX = 4096
/** Longest side of a source texture re-decoded for an export (bounded by the GPU too). */
const EXPORT_TEXTURE_MAX = 8192
/** Checkerboard square, CSS px. */
const CHECK_PX = 8
const MAX_INKS = 6

const BLEND_INDEX = { normal: 0, multiply: 1, screen: 2, darken: 3, lighten: 4 } as const
/** Composite output: on screen (checkerboard behind transparency) or straight-alpha RGBA for files. */
const OUTPUT_SCREEN = 0
const OUTPUT_FILE = 1

interface Texture { tex: WebGLTexture; w: number; h: number }
interface Target { fb: WebGLFramebuffer; tex: WebGLTexture }
type Targets = Record<'all' | 'auto' | 'plates0' | 'plates1', Target>
interface AssetSource { blob: Blob; natural: { w: number; h: number } }
type SceneLayer = Scene['layers'][number]
/** The sheet placed on a W × H target: its top-left corner (sx, sy), size and px per mm. */
interface Frame { W: number; H: number; sx: number; sy: number; sw: number; sh: number; k: number }

export class ExportCancelled extends Error {
  constructor() { super('cancelled') }
}

export class Renderer {
  private gl: GL
  private shadowProg!: Program
  private layerProg!: Program
  private compositeProg!: Program
  private unitQuad!: WebGLBuffer
  private layerBuf!: WebGLBuffer
  private blueNoise!: WebGLTexture
  private targets: Targets | null = null
  private targetSize = { w: 0, h: 0 }
  private layersKey = ''
  private textures = new Map<string, Texture>()
  private sources = new Map<string, AssetSource>()
  private decoding = new Set<string>()
  private scene: Scene | null = null
  private viewport: Viewport = { cssW: 1, cssH: 1, dpr: 1 }
  readonly maxTexture: number

  private constructor(private canvas: HTMLCanvasElement | OffscreenCanvas, gl: GL, private emit: (m: FromRenderer) => void, private requestFrame: () => void) {
    this.gl = gl
    this.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    this.setup()
    const c = canvas as EventTarget
    c.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.textures.clear()
      this.targets = null
      this.emit({ type: 'error', code: 'context-lost' })
    })
    c.addEventListener('webglcontextrestored', () => {
      // Everything is rebuilt from the scene and the source blobs: nothing is lost.
      this.setup()
      this.layersKey = ''
      for (const id of this.sources.keys()) this.decode(id)
      this.requestFrame()
    })
  }

  static create(canvas: HTMLCanvasElement | OffscreenCanvas, emit: (m: FromRenderer) => void, requestFrame: () => void): Renderer | null {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false }) as GL | null
    if (!gl) return null
    return new Renderer(canvas, gl, emit, requestFrame)
  }

  private setup() {
    const gl = this.gl
    this.shadowProg = createProgram(gl, QUAD_VS, SHADOW_FS)
    this.layerProg = createProgram(gl, LAYER_VS, LAYER_FS)
    this.compositeProg = createProgram(gl, QUAD_VS, COMPOSITE_FS)
    this.unitQuad = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.unitQuad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), gl.STATIC_DRAW)
    this.layerBuf = gl.createBuffer()!
    // Blue-noise ranks for the stochastic screen: 64 × 64, float so 4096 ranks stay distinct.
    this.blueNoise = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.blueNoise)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 64, 64, 0, gl.RED, gl.FLOAT, voidAndCluster(64, 1))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  }

  setViewport(v: Viewport) {
    this.viewport = v
    const w = Math.max(1, Math.round(v.cssW * v.dpr))
    const h = Math.max(1, Math.round(v.cssH * v.dpr))
    if (this.canvas.width !== w) this.canvas.width = w
    if (this.canvas.height !== h) this.canvas.height = h
    this.requestFrame()
  }

  setScene(scene: Scene) {
    this.scene = scene
    this.requestFrame()
  }

  addAsset(id: string, blob: Blob, natural: { w: number; h: number }) {
    if (this.sources.has(id)) return
    this.sources.set(id, { blob, natural })
    this.decode(id)
  }

  /** Decode a source into a texture whose longest side is at most `maxSide`. */
  private async uploadTexture(src: AssetSource, maxSide: number): Promise<Texture | null> {
    const s = Math.min(1, maxSide / Math.max(src.natural.w, src.natural.h))
    const bitmap = await createImageBitmap(src.blob, {
      premultiplyAlpha: 'premultiply',
      ...(s < 1 ? { resizeWidth: Math.max(1, Math.round(src.natural.w * s)), resizeHeight: Math.max(1, Math.round(src.natural.h * s)), resizeQuality: 'high' as const } : {}),
    })
    const gl = this.gl
    if (gl.isContextLost()) { bitmap.close(); return null }
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const t = { tex, w: bitmap.width, h: bitmap.height }
    bitmap.close()
    return t
  }

  private async decode(id: string) {
    const src = this.sources.get(id)
    if (!src || this.decoding.has(id)) return
    this.decoding.add(id)
    try {
      const t = await this.uploadTexture(src, Math.min(this.maxTexture, PREVIEW_TEXTURE_MAX))
      if (t) {
        this.textures.set(id, t)
        this.requestFrame()
      }
    } catch (e) {
      this.emit({ type: 'error', code: 'decode', assetId: id, detail: String(e) })
    } finally {
      this.decoding.delete(id)
    }
  }

  private makeTarget(w: number, h: number): Target {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { fb, tex }
  }

  private makeTargets(w: number, h: number): Targets {
    return { all: this.makeTarget(w, h), auto: this.makeTarget(w, h), plates0: this.makeTarget(w, h), plates1: this.makeTarget(w, h) }
  }

  private deleteTargets(t: Iterable<Target>) {
    for (const x of t) { this.gl.deleteFramebuffer(x.fb); this.gl.deleteTexture(x.tex) }
  }

  /** Blend state for a layer (premultiplied colours). */
  private setBlend(mode: number) {
    const gl = this.gl
    gl.blendEquation(mode === 3 ? gl.MIN : mode === 4 ? gl.MAX : gl.FUNC_ADD)
    if (mode === 1) gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA)      // c·dst + dst·(1−a)
    else if (mode === 2) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR)       // c + dst·(1−c)
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  /** Draw the layers that pass `filter` into the bound target (already cleared). */
  private drawLayers(f: Frame, layers: SceneLayer[], filter: (l: SceneLayer) => boolean, gray: boolean, texture: (id: string) => Texture | undefined) {
    const gl = this.gl
    const lp = this.layerProg
    gl.useProgram(lp.program)
    gl.uniform2f(lp.uniform('uCanvas'), f.W, f.H)
    gl.uniform1i(lp.uniform('uTex'), 0)
    gl.uniform1i(lp.uniform('uGray'), gray ? 1 : 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.layerBuf)
    const lPos = lp.attrib('aPos')
    const lUv = lp.attrib('aUv')
    gl.enableVertexAttribArray(lPos)
    gl.enableVertexAttribArray(lUv)
    gl.vertexAttribPointer(lPos, 2, gl.FLOAT, false, 16, 0)
    gl.vertexAttribPointer(lUv, 2, gl.FLOAT, false, 16, 8)
    for (const layer of layers) {
      if (!layer.visible || layer.opacity <= 0 || !filter(layer)) continue
      const t = texture(layer.assetId)
      if (!t) continue
      const { corners, uvs } = layerQuad(layer)
      const data = new Float32Array(16)
      for (let i = 0; i < 4; i++) {
        data[i * 4] = f.sx + corners[i][0] * f.k
        data[i * 4 + 1] = f.sy + corners[i][1] * f.k
        data[i * 4 + 2] = uvs[i][0]
        data[i * 4 + 3] = uvs[i][1]
      }
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, t.tex)
      gl.uniform1f(lp.uniform('uOpacity'), layer.opacity)
      const mode = BLEND_INDEX[layer.blend] ?? 0
      gl.uniform1i(lp.uniform('uBlend'), mode)
      this.setBlend(mode)
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    }
    this.setBlend(0)
    gl.disableVertexAttribArray(lPos)
    gl.disableVertexAttribArray(lUv)
  }

  /** Stage 1: the layer passes of one frame. */
  private layerPasses(t: Targets, f: Frame, layers: SceneLayer[], inkCount: number, texture: (id: string) => Texture | undefined) {
    const gl = this.gl
    gl.enable(gl.BLEND)
    gl.enable(gl.SCISSOR_TEST)
    gl.viewport(0, 0, f.W, f.H)
    // Only the sheet is printed: clip to it (and to the target).
    const x0 = Math.max(0, Math.floor(f.sx))
    const x1 = Math.min(f.W, Math.ceil(f.sx + f.sw))
    const y0 = Math.max(0, Math.floor(f.sy))
    const y1 = Math.min(f.H, Math.ceil(f.sy + f.sh))
    gl.scissor(x0, f.H - y1, Math.max(0, x1 - x0), Math.max(0, y1 - y0))
    const inkIndex = (l: SceneLayer) => {
      const m = /^ink-(\d+)$/.exec(l.inkTarget)
      const i = m ? Number(m[1]) - 1 : -1
      return i >= 0 && i < inkCount ? i : -1
    }
    const pass = (target: Target, draw: () => void) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb)
      gl.colorMask(true, true, true, true)
      gl.clearColor(1, 1, 1, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      draw()
    }
    pass(t.all, () => this.drawLayers(f, layers, () => true, false, texture))
    pass(t.auto, () => this.drawLayers(f, layers, (l) => inkIndex(l) < 0, false, texture))
    for (const [tIndex, target] of [t.plates0, t.plates1].entries()) {
      pass(target, () => {
        for (let ch = 0; ch < 3; ch++) {
          const ink = tIndex * 3 + ch
          if (ink >= inkCount) break
          gl.colorMask(ch === 0, ch === 1, ch === 2, false)
          this.drawLayers(f, layers, (l) => inkIndex(l) === ink, true, texture)
        }
        gl.colorMask(true, true, true, true)
      })
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.disable(gl.SCISSOR_TEST)
  }

  private quad(p: Program, f: Frame, x: number, y: number, w: number, h: number) {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.unitQuad)
    const aPos = p.attrib('aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    gl.uniform4f(p.uniform('uRect'), x, y, w, h)
    gl.uniform2f(p.uniform('uCanvas'), f.W, f.H)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    gl.disableVertexAttribArray(aPos)
  }

  /** Stage 2: separation, ink and paper, into the bound framebuffer. */
  private composite(t: Targets, f: Frame, pr: PrintScene, colors: SceneColors, checkPx: number, output: number) {
    const gl = this.gl
    const cp = this.compositeProg
    const inks = pr.inks.slice(0, MAX_INKS)
    gl.disable(gl.BLEND)
    gl.viewport(0, 0, f.W, f.H)
    gl.useProgram(cp.program)
    const bind = (unit: number, name: string, target: Target) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, target.tex)
      gl.uniform1i(cp.uniform(name), unit)
    }
    bind(0, 'uAll', t.all)
    bind(1, 'uAuto', t.auto)
    bind(2, 'uPlates0', t.plates0)
    bind(3, 'uPlates1', t.plates1)
    const absorb = new Float32Array(MAX_INKS * 3)
    const lum = new Float32Array(MAX_INKS)
    inks.forEach((hex, i) => {
      const a = inkAbsorbance(hex)
      absorb.set(a, i * 3)
      lum[i] = 0.2126 * Math.exp(-a[0]) + 0.7152 * Math.exp(-a[1]) + 0.0722 * Math.exp(-a[2])
    })
    gl.uniform3fv(cp.uniform('uInkA'), absorb)
    gl.uniform1fv(cp.uniform('uInkL'), lum)
    gl.uniform1i(cp.uniform('uInkCount'), inks.length)
    gl.uniform1f(cp.uniform('uDensity'), pr.inkDensity)
    gl.uniform1f(cp.uniform('uContrast'), pr.contrast)
    gl.uniform1i(cp.uniform('uColorOn'), pr.colorOn ? 1 : 0)
    gl.uniform1i(cp.uniform('uPaperOn'), pr.paperOn ? 1 : 0)
    gl.uniform1i(cp.uniform('uCompare'), pr.compare ? 1 : 0)
    gl.uniform1i(cp.uniform('uOutput'), output)
    gl.uniform3fv(cp.uniform('uPaper'), parseHex(pr.paper.color))
    gl.uniform1f(cp.uniform('uFibre'), pr.paper.fibre * pr.paper.texture)
    gl.uniform1f(cp.uniform('uFlocs'), pr.paper.flocs * pr.paper.texture)
    gl.uniform3fv(cp.uniform('uCheckA'), parseHex(colors.checkA))
    gl.uniform3fv(cp.uniform('uCheckB'), parseHex(colors.checkB))
    gl.uniform1f(cp.uniform('uCheck'), checkPx)
    gl.uniform4f(cp.uniform('uSheet'), f.sx, f.sy, f.sw, f.sh)
    gl.uniform1f(cp.uniform('uPxPerMm'), f.k)
    const sc = pr.screen
    gl.uniform1i(cp.uniform('uEngine'), sc ? 1 : 0)
    if (sc) {
      gl.uniform1i(cp.uniform('uFM'), sc.fm ? 1 : 0)
      gl.uniform1i(cp.uniform('uShape'), sc.shape)
      gl.uniform1fv(cp.uniform('uSpotLut'), sc.lut)
      gl.uniform1f(cp.uniform('uLpi'), sc.lpi)
      const ang = new Float32Array(MAX_INKS)
      sc.angles.slice(0, MAX_INKS).forEach((a, i) => { ang[i] = (a * Math.PI) / 180 })
      gl.uniform1fv(cp.uniform('uAngles'), ang)
      gl.uniform1f(cp.uniform('uGainMm'), sc.gainMm)
      gl.uniform1f(cp.uniform('uSoftMm'), sc.softMm)
      gl.uniform1f(cp.uniform('uRough'), sc.roughness)
      gl.uniform1f(cp.uniform('uDetail'), sc.detail)
      gl.uniform1f(cp.uniform('uFmDotMm'), sc.fmDotMm)
      gl.activeTexture(gl.TEXTURE4)
      gl.bindTexture(gl.TEXTURE_2D, this.blueNoise)
      gl.uniform1i(cp.uniform('uBlue'), 4)
    }
    this.quad(cp, f, f.sx, f.sy, f.sw, f.sh)
  }

  /** The on-screen preview. */
  draw() {
    const gl = this.gl
    const scene = this.scene
    if (!scene || gl.isContextLost()) return
    const { dpr, cssW, cssH } = this.viewport
    const W = this.canvas.width
    const H = this.canvas.height
    const r = sheetRect({ w: cssW, h: cssH }, scene.sheet, scene.view)
    const f: Frame = { W, H, sx: r.x * dpr, sy: r.y * dpr, sw: r.w * dpr, sh: r.h * dpr, k: r.pxPerMm * dpr }
    const inkCount = Math.min(MAX_INKS, scene.print.inks.length)

    if (!this.targets || this.targetSize.w !== W || this.targetSize.h !== H) {
      if (this.targets) this.deleteTargets(Object.values(this.targets))
      this.targets = this.makeTargets(W, H)
      this.targetSize = { w: W, h: H }
      this.layersKey = ''
    }
    const key = JSON.stringify([f, inkCount, this.textures.size, scene.layers])
    if (key !== this.layersKey) {
      this.layersKey = key
      this.layerPasses(this.targets, f, scene.layers, inkCount, (id) => this.textures.get(id))
    }

    // Card, sheet shadow, then the printed sheet.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, W, H)
    const card = parseHex(scene.colors.card)
    gl.clearColor(card[0], card[1], card[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const shadow = 4 * dpr
    const sp = this.shadowProg
    gl.useProgram(sp.program)
    gl.uniform4f(sp.uniform('uSheet'), f.sx, f.sy, f.sw, f.sh)
    gl.uniform2f(sp.uniform('uShadow'), 3 * dpr, 1 * dpr)
    this.quad(sp, f, f.sx - shadow, f.sy - shadow, f.sw + shadow * 2, f.sh + shadow * 2)
    this.composite(this.targets, f, scene.print, scene.colors, CHECK_PX * dpr, OUTPUT_SCREEN)
  }

  /**
   * Render the sheet at `job.widthPx × job.heightPx` tile by tile and stream it into a
   * PNG. Between tiles it yields, so the preview keeps drawing and a cancel arrives.
   */
  async exportPng(job: ExportJob, onProgress: (done: number, total: number) => void, cancelled: () => boolean): Promise<Blob> {
    const gl = this.gl
    const scene = job.scene
    const W = job.widthPx
    const H = job.heightPx
    const k = W / scene.sheet.widthMm
    const TS = Math.max(256, Math.min(job.tileSize, this.maxTexture))
    const inkCount = Math.min(MAX_INKS, scene.print.inks.length)
    const print: PrintScene = { ...scene.print, paperOn: !job.transparent, compare: false }
    const channels = job.transparent ? 4 : 3

    // Sources bigger than the preview texture are re-decoded at the size the export needs.
    const hiRes = new Map<string, Texture>()
    const hiLimit = Math.min(this.maxTexture, EXPORT_TEXTURE_MAX)
    for (const l of scene.layers) {
      const src = this.sources.get(l.assetId)
      const pre = this.textures.get(l.assetId)
      if (!src || !pre || hiRes.has(l.assetId)) continue
      const needed = Math.ceil(Math.max(l.natural.w, l.natural.h) * l.transform.scale * k)
      const side = Math.min(hiLimit, Math.max(src.natural.w, src.natural.h), needed)
      if (side > Math.max(pre.w, pre.h)) {
        const t = await this.uploadTexture(src, side)
        if (t) hiRes.set(l.assetId, t)
      }
    }
    const texture = (id: string) => hiRes.get(id) ?? this.textures.get(id)

    // Apron: each screen dot reads the tone at its cell centre, up to ~0.7 cell away.
    const sc = print.screen
    const cellPx = sc ? (sc.fm ? sc.fmDotMm : 25.4 / sc.lpi) * k : 0
    const A = sc && !sc.fm ? Math.min(256, Math.ceil(cellPx) + 4) : 2
    const TA = TS + 2 * A
    const targets = this.makeTargets(TA, TA)
    const out = this.makeTarget(TA, TA)
    const tile = new Uint8Array(TS * TS * 4)
    const png = new PngStreamWriter(W, H, channels as 3 | 4, job.dpi)
    const cols = Math.ceil(W / TS)
    const rows = Math.ceil(H / TS)
    let done = 0
    try {
      for (let ty = 0; ty < rows; ty++) {
        const y0 = ty * TS
        const th = Math.min(TS, H - y0)
        const band = new Uint8Array(W * th * channels)
        for (let tx = 0; tx < cols; tx++) {
          if (cancelled() || gl.isContextLost()) throw new ExportCancelled()
          const x0 = tx * TS
          const tw = Math.min(TS, W - x0)
          const f: Frame = { W: TA, H: TA, sx: A - x0, sy: A - y0, sw: W, sh: H, k }
          this.layerPasses(targets, f, scene.layers, inkCount, texture)
          gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb)
          gl.viewport(0, 0, TA, TA)
          gl.clearColor(0, 0, 0, 0)
          gl.clear(gl.COLOR_BUFFER_BIT)
          this.composite(targets, f, print, scene.colors, 8, OUTPUT_FILE)
          // Read the tile without its apron. Its top rows are the framebuffer's upper
          // rows, which GL numbers from the bottom.
          gl.readPixels(A, TA - A - th, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, tile)
          gl.bindFramebuffer(gl.FRAMEBUFFER, null)
          for (let y = 0; y < th; y++) {
            const srcRow = (th - 1 - y) * tw * 4
            const dstRow = (y * W + x0) * channels
            if (channels === 4) band.set(tile.subarray(srcRow, srcRow + tw * 4), dstRow)
            else for (let x = 0; x < tw; x++) {
              band[dstRow + x * 3] = tile[srcRow + x * 4]
              band[dstRow + x * 3 + 1] = tile[srcRow + x * 4 + 1]
              band[dstRow + x * 3 + 2] = tile[srcRow + x * 4 + 2]
            }
          }
          onProgress(++done, cols * rows)
          await new Promise((r) => setTimeout(r, 0))
        }
        await png.writeRows(band, th)
      }
      return await png.finish()
    } catch (e) {
      png.abort()
      throw e
    } finally {
      this.deleteTargets([...Object.values(targets), out])
      for (const t of hiRes.values()) gl.deleteTexture(t.tex)
      this.requestFrame()
    }
  }
}

/** Coalesce redraw requests into one per animation frame (workers have rAF in modern browsers). */
export function frameScheduler(draw: () => void): () => void {
  let queued = false
  const raf: (cb: () => void) => void =
    typeof requestAnimationFrame === 'function' ? (cb) => requestAnimationFrame(cb) : (cb) => setTimeout(cb, 16)
  return () => {
    if (queued) return
    queued = true
    raf(() => { queued = false; draw() })
  }
}
