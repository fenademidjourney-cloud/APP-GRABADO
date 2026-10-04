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
//   2. tone → the AUTO separation + grey plates as each ink's tone (dot %), cached too
//   3. composite → registration, the technique's marks, impression, imperfections,
//      Beer–Lambert ink and the procedural paper.
// Beside the frame, an analysis pass renders the whole sheet at a fixed low
// resolution (docs/PLANNING.md §D.2) and blurs each ink's tone into the "mass" field:
// how much ink the surroundings ask for. It is the same for the preview and every
// export tile, so depletion never jumps between them.
// Every stage recomputes from the sources: nothing degrades with edits, and an export
// is the same picture as the preview, only with more pixels.

import { layerQuad } from '../model/layer'
import { inkAbsorbance } from '../print/ink'
import { PngStreamWriter } from '../io/export/pngStream'
import { voidAndCluster } from '../analysis/bluenoise'
import { createProgram, parseHex, type GL, type Program } from './gl/gl'
import { BLUR_FS, COMPOSITE_FS, LAYER_FS, LAYER_VS, QUAD_VS, SHADOW_FS, TONE_FS } from './shaders'
import { maxDisplacementMm } from '../print/registration'
import { sheetRect } from './view'
import type { ExportJob, FromRenderer, PrintScene, Scene, SceneColors, Viewport } from './scene'

/** Longest side of a source texture in the preview. */
const PREVIEW_TEXTURE_MAX = 4096
/** Longest side of a source texture re-decoded for an export (bounded by the GPU too). */
const EXPORT_TEXTURE_MAX = 8192
/** Checkerboard square, CSS px. */
const CHECK_PX = 8
const MAX_INKS = 6
/** Analysis resolution: px per mm (and longest side) of the whole-sheet mass field. */
const ANALYSIS_PX_PER_MM = 4
const ANALYSIS_MAX_SIDE = 2048
/** Depletion reach: σ of the mass blur, in mm. */
const MASS_SIGMA_MM = 3

const BLEND_INDEX = { normal: 0, multiply: 1, screen: 2, darken: 3, lighten: 4 } as const
/** Composite output: on screen (checkerboard behind transparency) or straight-alpha RGBA for files. */
const OUTPUT_SCREEN = 0
const OUTPUT_FILE = 1

interface Texture { tex: WebGLTexture; w: number; h: number }
interface Target { fb: WebGLFramebuffer; tex: WebGLTexture }
/** Two colour attachments drawn at once (inks 1–4 and 5–6). */
interface Pair { fb: WebGLFramebuffer; tex: [WebGLTexture, WebGLTexture] }
type Targets = Record<'all' | 'auto' | 'plates0' | 'plates1', Target> & { tone: Pair }
/** The whole sheet at analysis resolution: its layers, tone, and the blurred mass. */
interface Analysis { w: number; h: number; k: number; layers: Targets; blur: Pair; mass: Pair }
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
  private toneProg!: Program
  private blurProg!: Program
  private unitQuad!: WebGLBuffer
  private layerBuf!: WebGLBuffer
  private blueNoise!: WebGLTexture
  private targets: Targets | null = null
  private targetSize = { w: 0, h: 0 }
  private layersKey = ''
  private toneKey = ''
  private analysis: Analysis | null = null
  private analysisKey = ''
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
      this.analysis = null
      this.emit({ type: 'error', code: 'context-lost' })
    })
    c.addEventListener('webglcontextrestored', () => {
      // Everything is rebuilt from the scene and the source blobs: nothing is lost.
      this.setup()
      this.layersKey = ''
      this.toneKey = ''
      this.analysisKey = ''
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
    this.toneProg = createProgram(gl, QUAD_VS, TONE_FS)
    this.blurProg = createProgram(gl, QUAD_VS, BLUR_FS)
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

  private makeTexture(w: number, h: number, filter: number): WebGLTexture {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  private makeTarget(w: number, h: number): Target {
    const gl = this.gl
    const tex = this.makeTexture(w, h, gl.NEAREST)
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { fb, tex }
  }

  /** Tone and mass are read between pixels (registration, cell centres): linear filtering. */
  private makePair(w: number, h: number): Pair {
    const gl = this.gl
    const tex: [WebGLTexture, WebGLTexture] = [this.makeTexture(w, h, gl.LINEAR), this.makeTexture(w, h, gl.LINEAR)]
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex[0], 0)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex[1], 0)
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
    return { fb, tex }
  }

  private makeTargets(w: number, h: number): Targets {
    return { all: this.makeTarget(w, h), auto: this.makeTarget(w, h), plates0: this.makeTarget(w, h), plates1: this.makeTarget(w, h), tone: this.makePair(w, h) }
  }

  private deleteTargets(t: Targets | Array<Target | Pair>) {
    const list = Array.isArray(t) ? t : Object.values(t)
    for (const x of list) {
      this.gl.deleteFramebuffer(x.fb)
      for (const tex of Array.isArray(x.tex) ? x.tex : [x.tex]) this.gl.deleteTexture(tex)
    }
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

  /** Absorbance and luminance transmittance of the inks, as the shaders want them. */
  private inkUniforms(p: Program, inks: string[]) {
    const gl = this.gl
    const absorb = new Float32Array(MAX_INKS * 3)
    const lum = new Float32Array(MAX_INKS)
    inks.forEach((hex, i) => {
      const a = inkAbsorbance(hex)
      absorb.set(a, i * 3)
      lum[i] = 0.2126 * Math.exp(-a[0]) + 0.7152 * Math.exp(-a[1]) + 0.0722 * Math.exp(-a[2])
    })
    gl.uniform3fv(p.uniform('uInkA'), absorb)
    gl.uniform1fv(p.uniform('uInkL'), lum)
    gl.uniform1i(p.uniform('uInkCount'), inks.length)
  }

  private bindTex(p: Program, unit: number, name: string, tex: WebGLTexture) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(p.uniform(name), unit)
  }

  /** Stage 2: each ink's tone (separation + grey plates) into t.tone. */
  private tonePass(t: Targets, f: Frame, pr: PrintScene) {
    const gl = this.gl
    const tp = this.toneProg
    gl.disable(gl.BLEND)
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.tone.fb)
    gl.viewport(0, 0, f.W, f.H)
    gl.useProgram(tp.program)
    this.bindTex(tp, 0, 'uAuto', t.auto.tex)
    this.bindTex(tp, 1, 'uPlates0', t.plates0.tex)
    this.bindTex(tp, 2, 'uPlates1', t.plates1.tex)
    this.inkUniforms(tp, pr.inks.slice(0, MAX_INKS))
    gl.uniform1f(tp.uniform('uContrast'), pr.contrast)
    this.quad(tp, f, 0, 0, f.W, f.H)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private blurPass(src: Pair, dst: Pair, f: Frame, step: [number, number]) {
    const gl = this.gl
    const bp = this.blurProg
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb)
    gl.viewport(0, 0, f.W, f.H)
    gl.useProgram(bp.program)
    this.bindTex(bp, 0, 'uSrc0', src.tex[0])
    this.bindTex(bp, 1, 'uSrc1', src.tex[1])
    gl.uniform2f(bp.uniform('uStep'), step[0], step[1])
    this.quad(bp, f, 0, 0, f.W, f.H)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /** The whole sheet at analysis resolution → mass field. Reuses `reuse`'s textures when the size matches. */
  private runAnalysis(scene: Scene, texture: (id: string) => Texture | undefined, reuse: Analysis | null): Analysis {
    const { widthMm, heightMm } = scene.sheet
    const k = Math.min(ANALYSIS_PX_PER_MM, ANALYSIS_MAX_SIDE / Math.max(widthMm, heightMm))
    const w = Math.max(1, Math.round(widthMm * k))
    const h = Math.max(1, Math.round(heightMm * k))
    let a = reuse
    if (!a || a.w !== w || a.h !== h) {
      if (a) this.deleteAnalysis(a)
      a = { w, h, k, layers: this.makeTargets(w, h), blur: this.makePair(w, h), mass: this.makePair(w, h) }
    }
    a.k = k
    const f: Frame = { W: w, H: h, sx: 0, sy: 0, sw: widthMm * k, sh: heightMm * k, k }
    this.layerPasses(a.layers, f, scene.layers, Math.min(MAX_INKS, scene.print.inks.length), texture)
    this.tonePass(a.layers, f, scene.print)
    const tap = (MASS_SIGMA_MM * k) / 3
    this.gl.disable(this.gl.BLEND)
    this.blurPass(a.layers.tone, a.blur, f, [tap / w, 0])
    this.blurPass(a.blur, a.mass, f, [0, tap / h])
    return a
  }

  private deleteAnalysis(a: Analysis) {
    this.deleteTargets(a.layers)
    this.deleteTargets([a.blur, a.mass])
  }

  /** Stage 3: registration, marks, impression, imperfections, ink and paper, into the bound framebuffer. */
  private composite(t: Targets, a: Analysis, f: Frame, sheet: Scene['sheet'], pr: PrintScene, colors: SceneColors, checkPx: number, output: number) {
    const gl = this.gl
    const cp = this.compositeProg
    const inks = pr.inks.slice(0, MAX_INKS)
    gl.disable(gl.BLEND)
    gl.viewport(0, 0, f.W, f.H)
    gl.useProgram(cp.program)
    this.bindTex(cp, 0, 'uAll', t.all.tex)
    this.bindTex(cp, 1, 'uTone0', t.tone.tex[0])
    this.bindTex(cp, 2, 'uTone1', t.tone.tex[1])
    this.bindTex(cp, 3, 'uMass0', a.mass.tex[0])
    this.bindTex(cp, 5, 'uMass1', a.mass.tex[1])
    gl.uniform2f(cp.uniform('uMassUv'), a.k / a.w, a.k / a.h)
    this.inkUniforms(cp, inks)
    gl.uniform1f(cp.uniform('uDensity'), pr.inkDensity)
    gl.uniform1f(cp.uniform('uContrast'), pr.contrast)
    gl.uniform1i(cp.uniform('uColorOn'), pr.colorOn ? 1 : 0)
    gl.uniform1i(cp.uniform('uPaperOn'), pr.paperOn ? 1 : 0)
    gl.uniform1i(cp.uniform('uCompare'), pr.compare ? 1 : 0)
    gl.uniform1i(cp.uniform('uOutput'), output)
    gl.uniform1ui(cp.uniform('uSeed'), pr.seed >>> 0)
    const reg = new Float32Array(MAX_INKS * 3)
    pr.registration.slice(0, MAX_INKS).forEach((g, i) => reg.set([g.dx, g.dy, (g.rot * Math.PI) / 180], i * 3))
    gl.uniform3fv(cp.uniform('uReg'), reg)
    const im = pr.impression
    gl.uniform1i(cp.uniform('uInkTexture'), im.on ? 1 : 0)
    gl.uniform1f(cp.uniform('uPressure'), im.pressure)
    gl.uniform1f(cp.uniform('uGrain'), im.grain)
    gl.uniform1f(cp.uniform('uBleedMm'), im.bleedMm)
    gl.uniform1f(cp.uniform('uContact'), im.contact)
    gl.uniform1f(cp.uniform('uDepletion'), im.depletion)
    gl.uniform1f(cp.uniform('uImpAmount'), pr.imperfections.amount)
    gl.uniform1i(cp.uniform('uImpMask'), pr.imperfections.mask)
    gl.uniform3fv(cp.uniform('uPaper'), parseHex(pr.paper.color))
    gl.uniform1f(cp.uniform('uFibre'), pr.paper.fibre * pr.paper.texture)
    gl.uniform1f(cp.uniform('uFlocs'), pr.paper.flocs * pr.paper.texture)
    gl.uniform1f(cp.uniform('uRelief'), pr.paper.relief * pr.paper.texture)
    gl.uniform1f(cp.uniform('uLight'), pr.paper.light)
    gl.uniform3fv(cp.uniform('uCheckA'), parseHex(colors.checkA))
    gl.uniform3fv(cp.uniform('uCheckB'), parseHex(colors.checkB))
    gl.uniform1f(cp.uniform('uCheck'), checkPx)
    gl.uniform4f(cp.uniform('uSheet'), f.sx, f.sy, f.sw, f.sh)
    gl.uniform2f(cp.uniform('uSheetMm'), sheet.widthMm, sheet.heightMm)
    gl.uniform1f(cp.uniform('uPxPerMm'), f.k)
    const sc = pr.screen
    gl.uniform1i(cp.uniform('uEngine'), sc ? 1 : 0)
    if (sc) {
      gl.uniform1i(cp.uniform('uFM'), sc.fm ? 1 : 0)
      gl.uniform1i(cp.uniform('uShape'), sc.shape)
      gl.uniform1fv(cp.uniform('uSpotLut'), sc.lut)
      gl.uniform1f(cp.uniform('uLpi'), sc.lpi)
      const ang = new Float32Array(MAX_INKS)
      sc.angles.slice(0, MAX_INKS).forEach((v, i) => { ang[i] = (v * Math.PI) / 180 })
      gl.uniform1fv(cp.uniform('uAngles'), ang)
      gl.uniform1f(cp.uniform('uGainMm'), sc.gainMm)
      gl.uniform1f(cp.uniform('uSoftMm'), sc.softMm)
      gl.uniform1f(cp.uniform('uRough'), sc.roughness)
      gl.uniform1f(cp.uniform('uDetail'), sc.detail)
      gl.uniform1f(cp.uniform('uFmDotMm'), sc.fmDotMm)
    }
    // Always bound: samplers of one program must not alias different types on a unit.
    this.bindTex(cp, 4, 'uBlue', this.blueNoise)
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
      if (this.targets) this.deleteTargets(this.targets)
      this.targets = this.makeTargets(W, H)
      this.targetSize = { w: W, h: H }
      this.layersKey = ''
      this.toneKey = ''
    }
    const texture = (id: string) => this.textures.get(id)
    const key = JSON.stringify([f, inkCount, this.textures.size, scene.layers])
    if (key !== this.layersKey) {
      this.layersKey = key
      this.layerPasses(this.targets, f, scene.layers, inkCount, texture)
    }
    const toneKey = key + JSON.stringify([scene.print.inks, scene.print.contrast])
    if (toneKey !== this.toneKey) {
      this.toneKey = toneKey
      this.tonePass(this.targets, f, scene.print)
    }
    const analysisKey = JSON.stringify([scene.sheet, scene.layers, scene.print.inks, scene.print.contrast, this.textures.size])
    if (!this.analysis || analysisKey !== this.analysisKey) {
      this.analysisKey = analysisKey
      this.analysis = this.runAnalysis(scene, texture, this.analysis)
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
    this.composite(this.targets, this.analysis, f, scene.sheet, scene.print, scene.colors, CHECK_PX * dpr, OUTPUT_SCREEN)
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

    // Apron: each screen dot reads the tone at its cell centre, up to ~0.7 cell away;
    // a misregistered plate reads its tone where the pass moved it; bleed reads a
    // little along the fibres.
    const sc = print.screen
    const cellPx = sc ? (sc.fm ? sc.fmDotMm : 25.4 / sc.lpi) * k : 0
    const shiftPx = (maxDisplacementMm(print.registration, scene.sheet) + print.impression.bleedMm) * k
    const A = Math.min(512, (sc && !sc.fm ? Math.ceil(cellPx) : 0) + Math.ceil(shiftPx) + 4)
    const TA = TS + 2 * A
    const analysis = this.runAnalysis(scene, texture, null)
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
          this.tonePass(targets, f, print)
          gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb)
          gl.viewport(0, 0, TA, TA)
          gl.clearColor(0, 0, 0, 0)
          gl.clear(gl.COLOR_BUFFER_BIT)
          this.composite(targets, analysis, f, scene.sheet, print, scene.colors, 8, OUTPUT_FILE)
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
      this.deleteTargets(targets)
      this.deleteTargets([out])
      this.deleteAnalysis(analysis)
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
