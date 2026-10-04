// Seed streams (docs/PLANNING.md §K · Determinismo): every module that draws random
// numbers takes its own stream, hash(seed, module), so changing one module never
// shifts another (moving an imperfection doesn't change the registration).
// The GPU derives its streams the same way from the one seed (render/shaders.ts).

import { rng } from './prng'

/** Modules that draw random numbers. The values are part of the file format: never renumber. */
export const STREAM = {
  paper: 1,
  impression: 2,
  imperfections: 3,
  registration: 4,
  screen: 5,
  variant: 6,
} as const

export type StreamId = keyof typeof STREAM

/** Seeds are unsigned 32-bit integers; shown and typed as plain numbers. */
export const SEED_MAX = 0xffffffff

/** murmur3's finaliser: a good 32-bit integer mix. */
export function mix32(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

export function streamSeed(seed: number, module: StreamId): number {
  return mix32((seed >>> 0) ^ Math.imul(STREAM[module], 0x9e3779b9))
}

export function streamRng(seed: number, module: StreamId): () => number {
  return rng(streamSeed(seed, module))
}

/** A fresh seed for "Nueva" and the dice (not reproducible on purpose). */
export function newSeed(previous: number): number {
  const buf = new Uint32Array(1)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf)
  else buf[0] = Math.floor(Math.random() * SEED_MAX)
  // Never the same seed twice in a row.
  return buf[0] === previous >>> 0 ? (buf[0] + 1) >>> 0 : buf[0]
}

export function sanitizeSeed(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= SEED_MAX ? v : fallback
}
