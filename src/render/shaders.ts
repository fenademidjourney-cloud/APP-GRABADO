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
vec3 hash3(ivec2 p, uint seed) { return vec3(pcg3d(uvec3(uvec2(p), seed))) / 4294967295.0; }
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
float srgb1(float c) { c = max(c, 0.0); return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }
float linear1(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
`

// Tone pass: the AUTO separation plus each ink's grey plate, as the tone (dot %) of
// every ink at every pixel: inks 1–4 in the first target, 5–6 in the second. The
// composite reads it wherever a plate needs it (screen cell centres, registration),
// and the analysis pass blurs it into the "mass" field.
export const TONE_FS = `#version 300 es
precision highp float;
in vec2 vPx;
uniform vec2 uCanvas;
uniform sampler2D uAuto;      // layers set to AUTO, over white
uniform sampler2D uPlates0;   // grey plates for inks 1–3 (r, g, b)
uniform sampler2D uPlates1;   // inks 4–6
uniform int uInkCount;
uniform vec3 uInkA[6];        // ink absorbance (−ln of the linear colour)
uniform float uInkL[6];       // ink luminance transmittance at full density (linear)
uniform float uContrast;      // −1..1
layout(location = 0) out vec4 outTone0;
layout(location = 1) out vec4 outTone1;
${COMMON}

vec3 contrastSrgb(vec3 c) {
  float k = uContrast >= 0.0 ? 1.0 + uContrast * 2.0 : 1.0 + uContrast * 0.8;
  return clamp((c - 0.5) * k + 0.5, 0.0, 1.0);
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

// Tones live in "dot %" (print/ink.ts · coverageForDensity): the share of paper an
// ink covers, on a perceptual scale like prepress files (a 50 % grey ≈ a 50 % tint).
float coverageForDensity(float d, int k) {
  float tl = max(uInkL[k], 0.002);
  float g = srgb1(exp(log(tl) * d));
  return clamp((1.0 - g) / max(1.0 - srgb1(tl), 1e-3), 0.0, 1.0);
}

void main() {
  vec2 uv = vec2(vPx.x / uCanvas.x, 1.0 - vPx.y / uCanvas.y);
  float d[6];
  separate(toLinear(contrastSrgb(texture(uAuto, uv).rgb)), d);
  vec3 p0 = contrastSrgb(texture(uPlates0, uv).rgb);
  vec3 p1 = contrastSrgb(texture(uPlates1, uv).rgb);
  float t[8];
  for (int k = 0; k < 8; k++) t[k] = 0.0;
  for (int k = 0; k < 6; k++) {
    if (k >= uInkCount) break;
    // Grey plates follow print convention: a 40 % grey is a 40 % tint of that ink.
    float plate = 1.0 - (k < 3 ? p0[k] : p1[k - 3]);
    t[k] = 1.0 - (1.0 - coverageForDensity(d[k], k)) * (1.0 - plate);
  }
  outTone0 = vec4(t[0], t[1], t[2], t[3]);
  outTone1 = vec4(t[4], t[5], 0.0, 1.0);
}`

// Separable Gaussian over the two tone targets at once (13 taps, ±2σ). Run twice
// (across, then down) at analysis resolution, it gives the "mass": how much ink the
// surroundings of a point ask for. Large masses run out of ink first.
export const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vPx;
uniform vec2 uCanvas;
uniform sampler2D uSrc0;
uniform sampler2D uSrc1;
uniform vec2 uStep;           // one tap, in uv (σ / 3)
layout(location = 0) out vec4 out0;
layout(location = 1) out vec4 out1;
void main() {
  vec2 uv = vec2(vPx.x / uCanvas.x, 1.0 - vPx.y / uCanvas.y);
  vec4 a = vec4(0.0), b = vec4(0.0);
  float wsum = 0.0;
  for (int i = -6; i <= 6; i++) {
    float w = exp(-0.5 * float(i * i) / 9.0);
    vec2 q = uv + uStep * float(i);
    a += texture(uSrc0, q) * w;
    b += texture(uSrc1, q) * w;
    wsum += w;
  }
  out0 = a / wsum;
  out1 = b / wsum;
}`

export const COMPOSITE_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vPx;
uniform vec2 uCanvas;
uniform vec4 uSheet;          // device px
uniform vec2 uSheetMm;        // sheet size, mm
uniform float uPxPerMm;       // device px per mm
uniform sampler2D uAll;       // every visible layer, in colour, over white
uniform sampler2D uTone0;     // tone (dot %) of inks 1–4 (TONE_FS)
uniform sampler2D uTone1;     // inks 5–6
uniform sampler2D uMass0;     // the tone blurred over a few mm, whole sheet (BLUR_FS)
uniform sampler2D uMass1;
uniform vec2 uMassUv;         // mm → uv of the mass textures
uniform int uInkCount;
uniform vec3 uInkA[6];        // ink absorbance (−ln of the linear colour)
uniform float uDensity;       // ink film, 1 = nominal
uniform float uContrast;      // −1..1 (only for "Color" off: the tone pass applies it otherwise)
uniform bool uColorOn;        // off: marks take the picture's own colours
uniform bool uPaperOn;
uniform bool uCompare;        // show the original
uniform int uOutput;          // 0 screen (checkerboard behind transparency) · 1 file (straight-alpha RGBA) · 2 separation film
uniform int uSepInk;          // uOutput 2: the ink whose film is drawn (black = ink)
uniform float uOpacity[6];    // per ink: 0 overprints (transparent) · 1 covers what's under it
uniform uint uSeed;           // util/seed.ts: every random field derives its stream from it
// Registration (print/registration.ts): per ink, shift in mm and turn in radians.
uniform vec3 uReg[6];
// Impression model (docs/PLANNING.md §C.3 · 2). Off ("Textura de tinta"): ideal print.
uniform bool uInkTexture;
uniform float uPressure;      // 0..1, 0.5 = nominal
uniform float uGrain;         // 0..1 · mottle of the film
uniform float uBleedMm;       // how far ink wicks along the fibres
uniform float uContact;       // how much the paper's relief matters (print/impression.ts)
uniform float uDepletion;     // how fast masses run out of ink
// Imperfections (print/imperfections.ts): amount 0..1 and a mask of IMPERFECTION_BIT.
uniform float uImpAmount;
uniform int uImpMask;
// Whole-sheet fields at analysis resolution (same for preview and export).
uniform vec2 uAnSize;         // analysis texture size, px
uniform sampler2D uAnTone0;   // tone of inks 1–4 (for ghosting)
uniform sampler2D uAnTone1;
uniform sampler2D uSmooth0;   // tone smoothed by the stencil's simplification
uniform sampler2D uSmooth1;
uniform bool uBandsAcross;    // bands vary across the sheet (squeegee) instead of down it (drum)
// Stencil engine (engines/stencil/params.ts).
uniform int uFill;            // 0 solid · 1 am · 2 fm
uniform int uLevels;          // 0 continuous · 2..5 posterized
uniform bool uSimplify;       // read the smoothed tone
uniform float uFilmGrain;     // 0..1
uniform float uGridMm;        // master dots / mesh openings (0 = none)
uniform float uGridAngle;     // radians
uniform float uMaxDensity;    // 0..1
// Technique engine (docs/PLANNING.md §C.2). 0 = continuous ink, 1 = screen, 2 = stencil.
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
// Paper (substrate v2): colour, fibre and pulp, relief depth and raking light.
uniform vec3 uPaper;          // sRGB
uniform float uFibre;         // 0..1 (already × texture amount)
uniform float uFlocs;
uniform float uRelief;        // 0..1 (already × texture amount)
uniform float uLight;         // 0..1
uniform vec3 uCheckA;
uniform vec3 uCheckB;
uniform float uCheck;
out vec4 outColor;
${COMMON}

const int IMP_PRESSURE = 1;
const int IMP_STARVED = 2;
const int IMP_DUST = 4;
const int IMP_WEAR = 8;
const int IMP_STAINS = 16;
const int IMP_BANDS = 32;
const int IMP_GHOST = 64;
const float GHOST_MM = 38.0;  // how far down the sheet the ghost lands (riso drum pickup)

// Seed streams: the same module ids as util/seed.ts · STREAM.
uint stream(uint m) { return pcg3d(uvec3(uSeed, m, 0x2545u)).x; }
uint sPaper, sImpression, sImperf, sScreen;

bool imp(int bit) { return uImpAmount > 0.0 && (uImpMask & bit) != 0; }

vec3 contrastSrgb(vec3 c) {
  float k = uContrast >= 0.0 ? 1.0 + uContrast * 2.0 : 1.0 + uContrast * 0.8;
  return clamp((c - 0.5) * k + 0.5, 0.0, 1.0);
}

// Paper: pulp clouds (~3 mm) and fibres (long thin streaks in a few directions).
// x = albedo factor, y = height (0 valley · 1 crest), z = height of the pulp alone.
// Fibres fade out when a device pixel is larger than they are (no false grain when
// zoomed out).
const float FIBRE_HEIGHT = 0.45;
const float FIBRE_SIGMA = 0.16;   // spread of the fibres' height term (3 noises × 0.45)
float fineFade() { return clamp(1.5 - (1.0 / uPxPerMm) / 0.12, 0.0, 1.0); }
vec3 paperField(vec2 mm, float fine) {
  float flocs = (vnoise(mm / 3.2, sPaper ^ 11u) * 0.6 + vnoise(mm / 1.1, sPaper ^ 12u) * 0.4) - 0.5;
  float fib = 0.0;
  fib += vnoise(rot(0.4) * mm * vec2(0.9, 7.5), sPaper ^ 21u) - 0.5;
  fib += vnoise(rot(2.1) * mm * vec2(0.8, 8.5), sPaper ^ 22u) - 0.5;
  fib += vnoise(rot(-1.2) * mm * vec2(1.1, 6.5), sPaper ^ 23u) - 0.5;
  float tone = 1.0 - uFlocs * 0.09 * flocs - uFibre * 0.06 * fib * fine;
  float low = 0.5 + 0.55 * flocs;
  return vec3(tone, clamp(low + FIBRE_HEIGHT * fib * fine, 0.0, 1.0), low);
}

vec2 uvOfMm(vec2 mm) {
  vec2 px = uSheet.xy + mm * uPxPerMm;
  return vec2(px.x / uCanvas.x, 1.0 - px.y / uCanvas.y);
}

// Where on its plate ink k reads a point of the sheet: the pass is shifted and turned
// about the sheet centre (registration). Only coordinates move; nothing is resampled.
vec2 plateMm(int k, vec2 mm) {
  vec3 g = uReg[k];
  vec2 c = uSheetMm * 0.5;
  return rot(-g.z) * (mm - c - g.xy) + c;
}

float toneAt(int k, vec2 uv) { return k < 4 ? texture(uTone0, uv)[k] : texture(uTone1, uv)[k - 4]; }
float massAt(int k, vec2 mm) {
  vec2 uv = vec2(mm.x * uMassUv.x, 1.0 - mm.y * uMassUv.y);
  return k < 4 ? texture(uMass0, uv)[k] : texture(uMass1, uv)[k - 4];
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
// (of the seed too) so the tile never repeats visibly; each ink starts elsewhere.
float blueRank(ivec2 cell, int k) {
  cell += ivec2(17 * k, 29 * k);
  ivec2 tile = ivec2(floor(vec2(cell) / 64.0));
  ivec2 l = cell - tile * 64;
  uint h = pcg3d(uvec3(uvec2(tile + 4096), (uint(k) + 7u) ^ sScreen)).x;
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

// Antialiased disc: 1 inside radius r (mm), 0 outside.
float disc(float d, float r, float aa) { return clamp(0.5 - (d - r) / aa, 0.0, 1.0); }

// Uneven pressure: a press prints harder on one side, plus soft patches (1 = nominal).
float pressureField(vec2 mm) {
  if (!imp(IMP_PRESSURE)) return 1.0;
  float side = (hash2(ivec2(1, 2), sImperf) < 0.5 ? 1.0 : -1.0) * (mm.x / uSheetMm.x - 0.5);
  float patches = (vnoise(mm / 38.0, sImperf ^ 41u) - 0.5) * 1.2 + (vnoise(mm / 9.0, sImperf ^ 42u) - 0.5) * 0.5;
  return max(0.0, 1.0 + uImpAmount * (0.55 * side + 0.8 * patches));
}

// Dust on plate k (mm in plate coordinates): x = white speck mask (1 = ink stays),
// y = hickey core (a dot of ink that prints full inside its white halo).
vec2 dust(int k, vec2 pm, float aa) {
  if (!imp(IMP_DUST)) return vec2(1.0, 0.0);
  const float CELL = 2.5;
  ivec2 c = ivec2(floor(pm / CELL));
  vec3 h = hash3(c, sImperf ^ (51u + uint(k)));
  if (h.x > uImpAmount * 0.22) return vec2(1.0, 0.0);
  vec3 g = hash3(c, sImperf ^ (61u + uint(k)));
  vec2 centre = (vec2(c) + 0.25 + 0.5 * g.xy) * CELL;
  float r = 0.04 + 0.16 * h.y * h.y;
  float d = length(pm - centre);
  if (g.z < 0.35) {
    // Hickey: core of ink, ring of paper (offset and letterpress).
    float ring = disc(d, r * 1.6, aa) * (1.0 - disc(d, r * 0.55, aa));
    return vec2(1.0 - ring, disc(d, r * 0.55, aa));
  }
  return vec2(1.0 - disc(d, r, aa), 0.0);
}

// Stains and foxing on the paper: a brownish tint with a darker rim.
vec3 stains(vec2 mm, float aa) {
  vec3 tint = vec3(1.0);
  if (!imp(IMP_STAINS)) return tint;
  vec3 brown = vec3(0.86, 0.72, 0.52);
  // Large stains: one possible per 18 mm cell, up to 6 mm wide.
  ivec2 c = ivec2(floor(mm / 18.0));
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    ivec2 cc = c + ivec2(dx, dy);
    vec3 h = hash3(cc, sImperf ^ 71u);
    if (h.x > uImpAmount * 0.35) continue;
    vec2 centre = (vec2(cc) + 0.3 + 0.4 * h.yz) * 18.0;
    vec2 v = mm - centre;
    float r = (1.5 + 4.5 * hash2(cc, sImperf ^ 72u)) * (0.8 + 0.4 * vnoise(vec2(atan(v.y, v.x) * 2.0, 0.0) + vec2(cc), sImperf ^ 73u));
    float d = length(v);
    float inside = disc(d, r, aa * 2.0);
    float rim = inside * smoothstep(r * 0.6, r, d);
    float k = (0.12 + 0.18 * hash2(cc, sImperf ^ 74u)) * uImpAmount;
    tint *= mix(vec3(1.0), brown, k * (inside * 0.6 + rim * 0.9));
  }
  // Foxing: small rusty dots.
  ivec2 f = ivec2(floor(mm / 4.0));
  vec3 hf = hash3(f, sImperf ^ 75u);
  if (hf.x < uImpAmount * 0.12) {
    vec2 centre = (vec2(f) + 0.25 + 0.5 * hf.yz) * 4.0;
    float r = 0.15 + 0.4 * hash2(f, sImperf ^ 76u);
    tint *= mix(vec3(1.0), vec3(0.78, 0.6, 0.42), 0.5 * uImpAmount * disc(length(mm - centre), r, max(aa, r * 0.6)));
  }
  return tint;
}

// Cubic B-spline sample from 4 bilinear taps (Sigg & Hadwiger 2005): thresholding the
// low-resolution smoothed tone gives round contours instead of bilinear corners.
vec4 bspline(sampler2D t, vec2 uv) {
  vec2 st = uv * uAnSize - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 1.0 + w1 / g0 + 0.5) / uAnSize;
  vec2 h1 = (i + 1.0 + w3 / g1 + 0.5) / uAnSize;
  return g0.y * (g0.x * texture(t, h0) + g1.x * texture(t, vec2(h1.x, h0.y)))
       + g1.y * (g0.x * texture(t, vec2(h0.x, h1.y)) + g1.x * texture(t, h1));
}
vec2 anUv(vec2 mm) { return vec2(mm.x * uMassUv.x, 1.0 - mm.y * uMassUv.y); }
float smoothToneAt(int k, vec2 mm) {
  vec2 uv = anUv(mm);
  return k < 4 ? bspline(uSmooth0, uv)[k] : bspline(uSmooth1, uv)[k - 4];
}
float anToneAt(int k, vec2 mm) {
  vec2 uv = anUv(mm);
  if (uv.y < 0.0 || uv.y > 1.0 || uv.x < 0.0 || uv.x > 1.0) return 0.0;
  return k < 4 ? texture(uAnTone0, uv)[k] : texture(uAnTone1, uv)[k - 4];
}

// Stencil: the master burns dots on a square grid (riso) and the mesh only lets ink
// through its openings (screenprint). A point prints as the centre of its grid cell,
// so edges step along the grid: the master's pixels, the mesh's saw teeth.
vec2 onGrid(vec2 pm) {
  if (uEngine != 2 || uGridMm <= 0.0 || uGridMm * uPxPerMm < 1.5) return pm;
  mat2 R = rot(uGridAngle);
  return transpose(R) * ((floor(R * pm / uGridMm) + 0.5) * uGridMm);
}

// The tone ink k's stencil holds at plate position pm (dot %): simplified, with the
// film's grain, cut into levels. aa > 0 antialiases the level steps (in tone units).
float stencilTone(int k, vec2 pm, float aa) {
  float t = uSimplify ? smoothToneAt(k, pm) : toneAt(k, uvOfMm(pm));
  if (uFilmGrain > 0.0) {
    float g = vnoise(pm / 0.06, sScreen ^ (201u + uint(k))) * 0.55 + vnoise(pm / 0.2, sScreen ^ (211u + uint(k))) * 0.45 - 0.5;
    t += uFilmGrain * 0.5 * g;
  }
  t = clamp(t, 0.0, 1.0);
  if (uLevels < 2) return t;
  float n = float(uLevels - 1);
  float f = t * n;
  float i = floor(f);
  return clamp((i + smoothstep(0.5 - aa * n, 0.5 + aa * n, f - i)) / n, 0.0, 1.0);
}
float plateTone(int k, vec2 pm, float aa) { return uEngine == 2 ? stencilTone(k, pm, aa) : toneAt(k, uvOfMm(pm)); }

// Film thickness (fraction of a full film) that looks like a tint of dot % t.
float filmFor(int k, float t) {
  float tl = max(0.2126 * exp(-uInkA[k].r) + 0.7152 * exp(-uInkA[k].g) + 0.0722 * exp(-uInkA[k].b), 0.002);
  float g = 1.0 - t * (1.0 - srgb1(tl));
  return clamp(log(max(linear1(g), 1e-4)) / log(tl), 0.0, 1.0);
}

// The matrix of ink k at plate position pm (docs/PLANNING.md §C.1): x = area covered,
// y = film (fraction of a full film), z = the plate's tone as dot % (separation films).
// growMm widens the marks (bleed).
vec3 plate(int k, vec2 pm, float growMm) {
  bool stencil = uEngine == 2;
  bool screened = uEngine == 1 || (stencil && uFill > 0);
  vec2 pq = onGrid(pm);
  // Level steps are antialiased over a pixel, unless the grid already cuts them.
  bool gridOn = stencil && uGridMm > 0.0 && uGridMm * uPxPerMm >= 1.5;
  float aaTone = fwidth(stencil && uSimplify ? smoothToneAt(k, pm) : toneAt(k, uvOfMm(pm))) * 0.5 + 1e-4;
  if (gridOn) aaTone = 0.0;
  float dk = plateTone(k, pq, aaTone);
  if (!screened) return vec3(1.0, filmFor(k, dk), dk);
  float aa = max(1.0, uSoftMm * uPxPerMm);
  float cellMm = uFM ? uFmDotMm : 25.4 / uLpi;
  float cellPx = cellMm * uPxPerMm;
  float gainPx = (uGainMm + growMm) * uPxPerMm;
  float cov;
  if (uFM) {
    // Stochastic: equal dots, as many as the tone asks for, spread by blue noise.
    // Each dot is a slightly rounded square a little larger than its cell; the
    // dots of the 3 × 3 neighbourhood add up, so touching dots merge without seams.
    vec2 g = pq / cellMm;
    vec2 ci = floor(g);
    vec2 f = g - ci - 0.5;
    cov = 0.0;
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        vec2 o = vec2(float(dx), float(dy));
        if (blueRank(ivec2(ci + o), k) >= dk - 0.001) continue;
        float sd = length(max(abs(f - o) - 0.45, 0.0)) - 0.08;
        cov += clamp(0.5 - (sd * cellPx - gainPx) / aa, 0.0, 1.0);
      }
    }
    cov = min(cov, 1.0);
  } else {
    // AM: rotate into the ink's screen, find the cell, read the tone at its centre.
    float ang = uAngles[k];
    mat2 R = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
    vec2 u = (R * pq) / cellMm;
    vec2 ci = floor(u) + 0.5;
    vec2 f = u - ci;
    vec2 centreMm = transpose(R) * (ci * cellMm);
    float tone = mix(plateTone(k, centreMm, 0.0), dk, uDetail);
    float raw = spotRaw(f);
    float grad = length(vec2(dFdx(raw), dFdy(raw)));
    float phiPx = (raw - spotThreshold(tone)) / max(grad, 1e-5);
    phiPx += (vnoise(pm * 28.0, sScreen ^ (31u + uint(k))) - 0.5) * uRough * cellPx * 0.3;
    cov = clamp(0.5 - (phiPx - gainPx) / aa, 0.0, 1.0);
    // On the grid each cell is open or closed: the threshold is a clean cut.
    if (gridOn) cov = raw < spotThreshold(tone) ? 1.0 : 0.0;
    if (tone < 0.003) cov = 0.0;
    if (tone > 0.997) cov = 1.0;
  }
  // Zoomed out: cells smaller than a few device pixels can't be drawn faithfully;
  // show the tone they make (with their gain) instead of a false moiré.
  // Files only need a dot to be about a pixel wide; the screen needs more to avoid
  // beating against its own pixel grid.
  float lod = uOutput != 0 ? smoothstep(0.8, 1.6, cellPx) : smoothstep(2.5, 5.0, cellPx);
  cov = mix(gainedTone(dk, uGainMm / cellMm), cov, lod);
  return vec3(cov, 1.0, cov);
}

void main() {
  vec2 uv = vec2(vPx.x / uCanvas.x, 1.0 - vPx.y / uCanvas.y);
  vec2 mm = (vPx - uSheet.xy) / uPxPerMm;
  sPaper = stream(1u);
  sImpression = stream(2u);
  sImperf = stream(3u);
  sScreen = stream(5u);
  float aaMm = 1.0 / uPxPerMm;

  // Separation film: the clean matrix of one ink, black = ink (no registration,
  // impression or imperfections: that is what the printer gets).
  if (uOutput == 2) {
    float film = plate(uSepInk, mm, 0.0).z;
    outColor = vec4(vec3(1.0 - clamp(film, 0.0, 1.0)), 1.0);
    return;
  }

  float fine = fineFade();
  bool paperOn = uPaperOn && !uCompare;
  vec3 pf = paperOn ? paperField(mm, fine) : vec3(1.0);
  // What the inks print on: the paper (with its stains) or, without paper, white
  // (turned into transparency at the end).
  vec3 col = paperOn ? toLinear(uPaper) * pf.x * stains(mm, aaMm) : vec3(1.0);

  if (uCompare) {
    col = toLinear(texture(uAll, uv).rgb);
  } else if (!uColorOn) {
    col *= toLinear(contrastSrgb(texture(uAll, uv).rgb));
  } else {
    float pField = pressureField(mm);
    float press = uPressure * pField;
    // Contact with the paper (relief impression): ink reaches into the paper's valleys
    // only as deep as the pressure pushes it. Valleys that aren't reached stay white.
    float contact = 1.0;
    if (uInkTexture && paperOn && uRelief * uContact > 0.0) {
      // The ink reaches down to a height hMin; below it the paper stays white.
      float hMin = 1.0 - (0.12 + 0.6 * press) / (uRelief * uContact);
      float sharp = smoothstep(hMin - 0.03, hMin + 0.03, pf.y);
      // Zoomed out the fibres can't be drawn: use the share of them that's reached
      // (their height spreads about the pulp's as a bell, ≈ a smoothstep of ±2σ).
      float mean = smoothstep(hMin - 2.0 * FIBRE_SIGMA, hMin + 2.0 * FIBRE_SIGMA, pf.z);
      contact = mix(mean, sharp, fine);
    }
    // Fibre direction field for bleed: ink wicks along it.
    float fa = vnoise(mm / 2.0, sPaper ^ 31u) * 6.2832;
    vec2 fibreDir = vec2(cos(fa), sin(fa));
    for (int k = 0; k < 6; k++) {
      if (k >= uInkCount) break;
      // Bleed: the plate is read a little away along the fibres, so edges feather.
      float wick = 0.0;
      if (uInkTexture && uBleedMm > 0.0) wick = (vnoise(rot(0.4) * mm * vec2(1.0, 6.0), sImpression ^ (81u + uint(k))) - 0.3) * uBleedMm;
      vec2 pm = plateMm(k, mm) + fibreDir * wick;
      vec3 m = plate(k, pm, max(wick, 0.0) * 0.5);
      float cov = m.x;
      float dens = uDensity * m.y * (uEngine == 2 ? uMaxDensity : 1.0);
      float mass = massAt(k, pm);

      if (uInkTexture) {
        // Film mottle: the roller never lays an even film.
        float mottle = (vnoise(pm / 2.2, sImpression ^ (91u + uint(k))) * 0.6 + vnoise(pm / 0.55, sImpression ^ (101u + uint(k))) * 0.4) - 0.5;
        dens *= 1.0 + uGrain * 0.7 * mottle;
        // Depletion: large masses run out of ink first, more so with a thin film.
        float starve = smoothstep(0.35, 0.95, mass) * (0.05 + 0.2 * uGrain) * uDepletion * clamp(1.4 - uDensity * 0.6, 0.3, 1.2);
        dens *= 1.0 - starve * (0.5 + vnoise(pm / 4.0, sImpression ^ (111u + uint(k))));
        cov *= contact;
        // Pressure (nominal 0.5) and uneven pressure thin or thicken the film a little.
        dens *= mix(1.0, 0.75 + 0.5 * press, 0.6);
      } else {
        dens *= mix(1.0, pField, 0.6);
      }

      if (imp(IMP_BANDS)) {
        // Drum bands across the feed (riso) or squeegee streaks along the stroke.
        float v = uBandsAcross ? pm.x : pm.y;
        float n = vnoise(vec2(v / 7.0, float(k) * 5.0), sImperf ^ 151u) * 0.65 + vnoise(vec2(v / 1.6, float(k) * 5.0), sImperf ^ 152u) * 0.35;
        dens *= 1.0 - uImpAmount * 0.45 * smoothstep(0.4, 0.85, n);
      }
      if (imp(IMP_STARVED)) {
        // Missing ink: blotches with ragged edges, mostly where the plate held a mass.
        float n = vnoise(pm / 5.0, sImperf ^ (121u + uint(k))) * 0.6 + vnoise(pm / 1.2, sImperf ^ (131u + uint(k))) * 0.28
                + vnoise(pm / 0.22, sImperf ^ (135u + uint(k))) * 0.12;
        float thr = 0.95 - uImpAmount * 0.28 * smoothstep(0.2, 1.0, mass);
        cov *= 1.0 - 0.85 * smoothstep(thr - 0.01, thr + 0.02, n);
      }
      if (imp(IMP_WEAR)) {
        // Worn plate: fine streaks along the wiping / rolling direction stop printing.
        // They come in patches (where the plate was rubbed), not all over.
        float rubbed = smoothstep(0.55, 0.8, vnoise(pm / 14.0, sImperf ^ (145u + uint(k))));
        float n = vnoise(rot(0.25) * pm * vec2(0.3, 4.0), sImperf ^ (141u + uint(k)));
        float thr = 0.97 - 0.2 * uImpAmount * rubbed;
        cov *= 1.0 - smoothstep(thr, thr + 0.03, n) * 0.85;
      }
      vec2 du = dust(k, pm, aaMm);
      cov = clamp(max(cov * du.x, du.y * step(0.15, m.z)), 0.0, 1.0);

      // Inside a mark the film prints; partial coverage (dot edges, zoomed out)
      // averages in reflected light. A transparent ink filters what is under it
      // (Beer–Lambert: overlapping inks multiply); an opaque one covers it with its
      // own colour, in the order of the passes.
      // An opaque ink covers in proportion to the film it lays (a light tint covers less).
      vec3 film = exp(-uInkA[k] * max(dens, 0.0));
      col = mix(col, mix(col * film, film, uOpacity[k] * clamp(m.y, 0.0, 1.0)), cov);

      if (imp(IMP_GHOST)) {
        // Ghosting: the drum picks up the image and lays a faint copy further down.
        float g = anToneAt(k, pm - vec2(0.0, GHOST_MM));
        col *= exp(-uInkA[k] * g * uImpAmount * 0.12 * uDensity);
      }
    }
  }
  if (paperOn) {
    // Raking light over the paper's relief (top left, low): crests light, valleys shade.
    if (uLight > 0.0 && uRelief > 0.0) {
      float e = max(aaMm, 0.03);
      float hx = paperField(mm + vec2(e, 0.0), fine).y - pf.y;
      float hy = paperField(mm + vec2(0.0, e), fine).y - pf.y;
      vec2 slope = vec2(hx, hy) / e * uRelief * 0.06;
      col *= 1.0 - uLight * 1.6 * dot(slope, vec2(0.7, 0.7));
    }
    outColor = vec4(toSrgb(col), 1.0);
    return;
  }
  if (uCompare && uPaperOn) {
    outColor = vec4(toSrgb(col), 1.0);
    return;
  }
  // No paper: only the ink, over transparency (print/ink.ts · inkOnTransparent),
  // shown over the checkerboard.
  float a = max(0.0, max(1.0 - col.r, max(1.0 - col.g, 1.0 - col.b)));
  vec3 prem = max(col - (1.0 - a), 0.0);
  if (uOutput == 1) {
    outColor = a > 0.0 ? vec4(toSrgb(prem / a), a) : vec4(0.0);
    return;
  }
  vec2 cell = floor((vPx - uSheet.xy) / uCheck);
  vec3 check = toLinear(mod(cell.x + cell.y, 2.0) > 0.5 ? uCheckA : uCheckB);
  outColor = vec4(toSrgb(prem + check * (1.0 - a)), 1.0);
}`
