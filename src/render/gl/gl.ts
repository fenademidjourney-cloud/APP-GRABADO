// A deliberately thin WebGL2 layer: compile programs, cache uniform locations,
// parse colours. Everything heavier (FBO pools, tiling) arrives with the render
// graph in Phase 03 (docs/PLANNING.md §D, §N).

export type GL = WebGL2RenderingContext

export interface Program {
  program: WebGLProgram
  uniform(name: string): WebGLUniformLocation | null
  attrib(name: string): number
}

function compileShader(gl: GL, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`shader: ${log}`)
  }
  return shader
}

export function createProgram(gl: GL, vs: string, fs: string): Program {
  const program = gl.createProgram()!
  const v = compileShader(gl, gl.VERTEX_SHADER, vs)
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fs)
  gl.attachShader(program, v)
  gl.attachShader(program, f)
  gl.linkProgram(program)
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(`program: ${gl.getProgramInfoLog(program)}`)
  const uniforms = new Map<string, WebGLUniformLocation | null>()
  return {
    program,
    uniform(name) {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name))
      return uniforms.get(name)!
    },
    attrib: (name) => gl.getAttribLocation(program, name),
  }
}

/** '#rgb' / '#rrggbb' → [r, g, b] in 0..1 (sRGB). Unknown strings give mid grey. */
export function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  if (h.length !== 6 || Number.isNaN(n)) return [0.5, 0.5, 0.5]
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
