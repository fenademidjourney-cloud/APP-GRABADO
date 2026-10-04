// Runs inside an inline (blob) worker: can this browser render WebGL2 off the main
// thread? Reports what the render engine (docs/PLANNING.md §K) depends on.

export interface WorkerProbe {
  offscreen: boolean
  webgl2: boolean
  maxTexture?: number
  floatTargets?: boolean
  halfFloatTargets?: boolean
  highpFloat?: boolean
  renderer?: string
  compression: boolean
  error?: string
}

function probe(): WorkerProbe {
  const out: WorkerProbe = { offscreen: typeof OffscreenCanvas !== 'undefined', webgl2: false, compression: typeof CompressionStream !== 'undefined' }
  if (!out.offscreen) return out
  try {
    const gl = new OffscreenCanvas(4, 4).getContext('webgl2')
    if (!gl) return out
    out.webgl2 = true
    out.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    out.floatTargets = !!gl.getExtension('EXT_color_buffer_float')
    out.halfFloatTargets = out.floatTargets || !!gl.getExtension('EXT_color_buffer_half_float')
    const p = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
    out.highpFloat = !!p && p.precision >= 23
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    out.renderer = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
  } catch (e) {
    out.error = String(e)
  }
  return out
}

self.onmessage = () => {
  ;(self as unknown as Worker).postMessage(probe())
}
