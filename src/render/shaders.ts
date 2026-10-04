// GLSL for the preview renderer. The ink maths mirrors src/print/ink.ts (tested
// there); keep both in step. All procedural noise is evaluated in millimetres of
// the sheet with integer hashes, so it is identical at any zoom or export size.

export const QUAD_VS = `#version 300 es
in vec2 aPos;
uniform vec4 uRect;     // x, y, w, h in device px
uniform vec2 uCanvas;
out vec2 vPx;
void main() {
  vPx = uRect.xy + aPos * uRect.zw;
  vec2 c = vPx / uCanvas * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`

// The kit's sheet shadow is 0 1px 3px rgba(0,0,0,.12): a soft ring outside the sheet.
export const SHADOW_FS = `#version 300 es
precision highp float;
in vec2 vPx;
uniform vec4 uSheet;
uniform vec2 uShadow;   // (radius, y offset) in device px
out vec4 outColor;
void main() {
  vec2 lo = uSheet.xy;
  vec2 hi = uSheet.xy + uSheet.zw;
  if (all(greaterThanEqual(vPx, lo)) && all(lessThanEqual(vPx, hi))) discard;
  vec2 s = vPx - vec2(0.0, uShadow.y);
  float dist = length(max(max(lo - s, s - hi), 0.0));
  outColor = vec4(0.0, 0.0, 0.0, 0.12 * (1.0 - smoothstep(0.0, uShadow.x, dist)));
}`

export const LAYER_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
uniform vec2 uCanvas;
out vec2 vUv;
void main() {
  vUv = aUv;
  vec2 c = aPos / uCanvas * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`

export const LAYER_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uOpacity;
uniform int uBlend;     // 0 normal · 1 multiply · 2 screen · 3 darken · 4 lighten
uniform bool uGray;     // plates: the layer as a grey positive (film for one ink)
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUv) * uOpacity;   // premultiplied sRGB
  if (uGray) c.rgb = vec3(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)));
  // Darken / lighten use MIN / MAX blending: composite over white (darken) so
  // transparent pixels leave what is below untouched.
  if (uBlend == 3) outColor = vec4(c.rgb + (1.0 - c.a), 1.0);
  else outColor = c;
}`

const COMMON = `
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

// pcg3d (Jarzynski & Olano 2020): integer hash, the same on every GPU.
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
float hash2(ivec2 p, uint seed) { return float(pcg3d(uvec3(uvec2(p), seed)).x) / 4294967295.0; }
float vnoise(vec2 p, uint seed) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  ivec2 ii = ivec2(i);
  float a = hash2(ii, seed), b = hash2(ii + ivec2(1, 0), seed);
  float c = hash2(ii + ivec2(0, 1), seed), d = hash2(ii + ivec2(1, 1), seed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
`

export const COMPOSITE_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vPx;
uniform vec2 uCanvas;
uniform vec4 uSheet;          // device px
uniform float uPxPerMm;       // device px per mm
uniform sampler2D uAll;       // every visible layer, in colour, over white
uniform sampler2D uAuto;      // layers set to AUTO, over white
uniform sampler2D uPlates0;   // grey plates for inks 1–3 (r, g, b)
uniform sampler2D uPlates1;   // inks 4–6
uniform int uInkCount;
uniform vec3 uInkA[6];        // ink absorbance (−ln of the linear colour)
uniform float uInkL[6];       // ink luminance transmittance at full density (linear)
uniform float uDensity;       // ink film, 1 = nominal
uniform float uContrast;      // −1..1
uniform bool uColorOn;        // off: marks take the picture's own colours
uniform bool uPaperOn;
uniform bool uCompare;        // show the original
uniform int uOutput;          // 0 screen (checkerboard behind transparency) · 1 file (straight-alpha RGBA)
// Technique engine (docs/PLANNING.md §C.2). 0 = continuous ink, 1 = screen.
uniform int uEngine;
uniform bool uFM;             // stochastic screen instead of AM dots
uniform int uShape;           // engines/screen/spot.ts · SHAPE_INDEX
uniform float uSpotLut[33];   // tone → threshold (inked area = tone)
uniform float uLpi;
uniform float uAngles[6];     // radians, per ink
uniform float uGainMm;        // dot gain: growth of each dot's edge
uniform float uSoftMm;
uniform float uRough;         // 0..1 ragged dot edges
uniform float uDetail;        // 0 tone at the cell centre · 1 tone per pixel
uniform float uFmDotMm;
uniform highp sampler2D uBlue; // 64 × 64 blue-noise ranks (R32F)
uniform vec3 uPaper;          // sRGB
uniform float uFibre;         // 0..1 (already × texture amount)
uniform float uFlocs;
uniform vec3 uCheckA;
uniform vec3 uCheckB;
uniform float uCheck;
out vec4 outColor;
${COMMON}

vec3 contrastSrgb(vec3 c) {
  float k = uContrast >= 0.0 ? 1.0 + uContrast * 2.0 : 1.0 + uContrast * 0.8;
  return clamp((c - 0.5) * k + 0.5, 0.0, 1.0);
}

// Paper tone v1: pulp clouds (~3 mm) and fibres (long thin streaks in a few directions).
// Fibres fade out when a device pixel is larger than they are (no false grain when zoomed out).
float paperTone(vec2 mm) {
  float mmPerPx = 1.0 / uPxPerMm;
  float flocs = (vnoise(mm / 3.2, 11u) * 0.6 + vnoise(mm / 1.1, 12u) * 0.4) - 0.5;
  float fine = clamp(1.5 - mmPerPx / 0.12, 0.0, 1.0);
  float fib = 0.0;
  fib += vnoise(rot(0.4) * mm * vec2(0.9, 7.5), 21u) - 0.5;
  fib += vnoise(rot(2.1) * mm * vec2(0.8, 8.5), 22u) - 0.5;
  fib += vnoise(rot(-1.2) * mm * vec2(1.1, 6.5), 23u) - 0.5;
  return 1.0 - uFlocs * 0.09 * flocs - uFibre * 0.06 * fib * fine;
}

// Separation: non-negative least squares in absorbance space (print/ink.ts · separate).
void separate(vec3 target, out float d[6]) {
  vec3 at = -log(max(target, vec3(0.002)));
  for (int k = 0; k < 6; k++) d[k] = 0.0;
  for (int it = 0; it < 16; it++) {
    for (int k = 0; k < 6; k++) {
      if (k >= uInkCount) break;
      vec3 r = at;
      for (int j = 0; j < 6; j++) { if (j >= uInkCount) break; if (j != k) r -= uInkA[j] * d[j]; }
      vec3 a = uInkA[k];
      d[k] = clamp(dot(r, a) / (dot(a, a) + 0.02), 0.0, 1.0);
    }
  }
}

vec2 uvOfMm(vec2 mm) {
  vec2 px = uSheet.xy + mm * uPxPerMm;
  return vec2(px.x / uCanvas.x, 1.0 - px.y / uCanvas.y);
}

float srgb1(float c) { c = max(c, 0.0); return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }
float linear1(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }

// Tones live in "dot %" (print/ink.ts · coverageForDensity): the share of paper an
// ink covers, on a perceptual scale like prepress files (a 50 % grey ≈ a 50 % tint).
// A film of density d looks like a tint of this coverage, and back.
float coverageForDensity(float d, int k) {
  float tl = max(uInkL[k], 0.002);
  float g = srgb1(exp(log(tl) * d));
  return clamp((1.0 - g) / max(1.0 - srgb1(tl), 1e-3), 0.0, 1.0);
}
float densityForCoverage(float a, int k) {
  float tl = max(uInkL[k], 0.002);
  float g = 1.0 - a * (1.0 - srgb1(tl));
  return clamp(log(max(linear1(g), 1e-4)) / log(tl), 0.0, 1.0);
}

// Tone (dot %) of ink k at a point of the targets: AUTO separation + its grey plate.
float inkToneAt(int k, vec2 uv) {
  float d[6];
  separate(toLinear(contrastSrgb(texture(uAuto, uv).rgb)), d);
  vec3 p0 = contrastSrgb(texture(uPlates0, uv).rgb);
  vec3 p1 = contrastSrgb(texture(uPlates1, uv).rgb);
  // Grey plates follow print convention: a 40 % grey is a 40 % tint of that ink.
  float plate = 1.0 - (k < 3 ? p0[k] : p1[k - 3]);
  return 1.0 - (1.0 - coverageForDensity(d[k], k)) * (1.0 - plate);
}

// Spot functions: mirror of engines/screen/spot.ts · spotRaw.
float spotRaw(vec2 f) {
  vec2 a = abs(f);
  if (uShape == 0) { float c = length(a); float e = length(0.5 - a); return c / (c + e + 1e-9); }
  if (uShape == 1) { vec2 s = vec2(1.0, 1.4); float c = length(a * s); float e = length((0.5 - a) * s); return c / (c + e + 1e-9); }
  if (uShape == 2) { float c = max(a.x, a.y); float e = max(0.5 - a.x, 0.5 - a.y); return c / (c + e + 1e-9); }
  if (uShape == 3) return a.y * 2.0;
  if (uShape == 4) return min(a.x, a.y) * 2.0;
  return a.x + a.y;
}

float spotThreshold(float t) {
  float x = clamp(t, 0.0, 1.0) * 32.0;
  int i = min(31, int(floor(x)));
  return mix(uSpotLut[i], uSpotLut[i + 1], x - float(i));
}

// Blue-noise rank of an FM cell. Each 64-cell tile is flipped / transposed by a hash
// so the tile never repeats visibly; each ink starts at a different offset.
float blueRank(ivec2 cell, int k) {
  cell += ivec2(17 * k, 29 * k);
  ivec2 tile = ivec2(floor(vec2(cell) / 64.0));
  ivec2 l = cell - tile * 64;
  uint h = pcg3d(uvec3(uvec2(tile + 4096), uint(k) + 7u)).x;
  if ((h & 1u) != 0u) l.x = 63 - l.x;
  if ((h & 2u) != 0u) l.y = 63 - l.y;
  if ((h & 4u) != 0u) l = l.yx;
  return texelFetch(uBlue, l, 0).r;
}

// Area a printed dot gains from a growth of g (in cell units) along its edge, for the
// zoomed-out preview where single dots can't be drawn: perimeter × growth, where the
// perimeter is that of the dot (light tones) or of the hole (dark tones): 2·√(π·a).
float gainedTone(float t, float g) {
  return clamp(t + 3.5449 * sqrt(max(min(t, 1.0 - t), 0.0)) * g, 0.0, 1.0);
}

void main() {
  vec2 uv = vec2(vPx.x / uCanvas.x, 1.0 - vPx.y / uCanvas.y);
  vec2 mm = (vPx - uSheet.xy) / uPxPerMm;
  vec3 onWhite;
  if (uCompare) {
    onWhite = toLinear(texture(uAll, uv).rgb);
  } else if (!uColorOn) {
    onWhite = toLinear(contrastSrgb(texture(uAll, uv).rgb));
  } else {
    float d[6];
    separate(toLinear(contrastSrgb(texture(uAuto, uv).rgb)), d);
    vec3 p0 = contrastSrgb(texture(uPlates0, uv).rgb);
    vec3 p1 = contrastSrgb(texture(uPlates1, uv).rgb);
    onWhite = vec3(1.0);
    float aa = max(1.0, uSoftMm * uPxPerMm);
    float gainPx = uGainMm * uPxPerMm;
    for (int k = 0; k < 6; k++) {
      if (k >= uInkCount) break;
      // Grey plates follow print convention: a 40 % grey is a 40 % tint of that ink.
      float plate = 1.0 - (k < 3 ? p0[k] : p1[k - 3]);
      float dk = 1.0 - (1.0 - coverageForDensity(d[k], k)) * (1.0 - plate);
      if (uEngine == 1) {
        float cov;
        float cellMm = uFM ? uFmDotMm : 25.4 / uLpi;
        float cellPx = cellMm * uPxPerMm;
        float tone = dk;
        if (uFM) {
          // Stochastic: equal dots, as many as the tone asks for, spread by blue noise.
          // Each dot is a slightly rounded square a little larger than its cell; the
          // dots of the 3 × 3 neighbourhood add up, so touching dots merge without seams.
          vec2 g = mm / cellMm;
          vec2 ci = floor(g);
          vec2 f = g - ci - 0.5;
          cov = 0.0;
          for (int dy = -1; dy <= 1; dy++) {
            for (int dx = -1; dx <= 1; dx++) {
              vec2 o = vec2(float(dx), float(dy));
              if (blueRank(ivec2(ci + o), k) >= tone - 0.001) continue;
              float sd = length(max(abs(f - o) - 0.45, 0.0)) - 0.08;
              cov += clamp(0.5 - (sd * cellPx - gainPx) / aa, 0.0, 1.0);
            }
          }
          cov = min(cov, 1.0);
        } else {
          // AM: rotate into the ink's screen, find the cell, read the tone at its centre.
          float ang = uAngles[k];
          mat2 R = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
          vec2 u = (R * mm) / cellMm;
          vec2 ci = floor(u) + 0.5;
          vec2 f = u - ci;
          vec2 centreMm = transpose(R) * (ci * cellMm);
          tone = mix(inkToneAt(k, uvOfMm(centreMm)), dk, uDetail);
          float raw = spotRaw(f);
          float grad = length(vec2(dFdx(raw), dFdy(raw)));
          float phiPx = (raw - spotThreshold(tone)) / max(grad, 1e-5);
          phiPx += (vnoise(mm * 28.0, 31u + uint(k)) - 0.5) * uRough * cellPx * 0.3;
          cov = clamp(0.5 - (phiPx - gainPx) / aa, 0.0, 1.0);
          if (tone < 0.003) cov = 0.0;
          if (tone > 0.997) cov = 1.0;
        }
        // Zoomed out: cells smaller than a few device pixels can't be drawn faithfully;
        // show the tone they make (with their gain) instead of a false moiré.
        // Files only need a dot to be about a pixel wide; the screen needs more to avoid
        // beating against its own pixel grid.
        float lod = uOutput == 1 ? smoothstep(0.8, 1.6, cellPx) : smoothstep(2.5, 5.0, cellPx);
        cov = mix(gainedTone(dk, uGainMm / cellMm), cov, lod);
        // Inside a dot the full film prints; partial coverage (dot edges, zoomed out)
        // averages in reflected light. Overlapping dots of different inks multiply.
        onWhite *= mix(vec3(1.0), exp(-uInkA[k] * uDensity), cov);
      } else {
        // Continuous tone: the film thickness that looks like this tint.
        onWhite *= exp(-uInkA[k] * densityForCoverage(dk, k) * uDensity);
      }
    }
  }
  if (uPaperOn) {
    vec3 paper = uCompare ? vec3(1.0) : toLinear(uPaper) * paperTone(mm);
    outColor = vec4(toSrgb(paper * onWhite), 1.0);
    return;
  }
  // No paper: only the ink, over transparency (print/ink.ts · inkOnTransparent),
  // shown over the checkerboard.
  float a = max(0.0, max(1.0 - onWhite.r, max(1.0 - onWhite.g, 1.0 - onWhite.b)));
  vec3 prem = max(onWhite - (1.0 - a), 0.0);
  if (uOutput == 1) {
    outColor = a > 0.0 ? vec4(toSrgb(prem / a), a) : vec4(0.0);
    return;
  }
  vec2 cell = floor((vPx - uSheet.xy) / uCheck);
  vec3 check = toLinear(mod(cell.x + cell.y, 2.0) > 0.5 ? uCheckA : uCheckB);
  outColor = vec4(toSrgb(prem + check * (1.0 - a)), 1.0);
}`
