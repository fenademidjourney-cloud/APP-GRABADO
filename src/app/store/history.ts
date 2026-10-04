export const HISTORY_LIMIT = 100
/** Commits with the same key closer together than this collapse into one step. */
export const COALESCE_MS = 1000

/**
 * Immutable undo history. Every function returns a new value — nothing is ever
 * mutated, so it is safe to call from state updaters (React StrictMode runs
 * those twice).
 *
 * Two ways to fold many changes into one undo step:
 * - a `key`: consecutive commits with the same key within COALESCE_MS replace
 *   the present instead of stacking (typing, keyboard-stepped sliders);
 * - a gesture: between beginGesture and endGesture every commit replaces the
 *   present, and the whole gesture becomes one step (slider or handle drags).
 */
export interface History<T> {
  past: T[]
  present: T
  future: T[]
  lastKey?: string
  lastAt: number
  gesture: boolean
  gestureBase?: T
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastAt: 0, gesture: false }
}

export function commit<T>(h: History<T>, next: T, key?: string, now = Date.now()): History<T> {
  if (next === h.present) return h
  if (h.gesture) return { ...h, present: next, future: [] }
  if (key && key === h.lastKey && now - h.lastAt < COALESCE_MS) return { ...h, present: next, future: [], lastAt: now }
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [], lastKey: key, lastAt: now, gesture: false }
}

/** Change the present without recording a step (derived/normalising updates). */
export function replacePresent<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h
  return h.gesture ? { ...h, present: next } : { ...h, present: next, gestureBase: undefined }
}

export function beginGesture<T>(h: History<T>): History<T> {
  if (h.gesture) return h
  return { ...h, gesture: true, gestureBase: h.present }
}

export function endGesture<T>(h: History<T>): History<T> {
  if (!h.gesture) return h
  const base = h.gestureBase as T
  if (base === h.present) return { ...h, gesture: false, gestureBase: undefined }
  return { past: [...h.past, base].slice(-HISTORY_LIMIT), present: h.present, future: [], lastAt: 0, gesture: false }
}

export function undo<T>(h0: History<T>): History<T> {
  const h = endGesture(h0)
  if (!h.past.length) return h
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
    lastAt: 0,
    gesture: false,
  }
}

export function redo<T>(h0: History<T>): History<T> {
  const h = endGesture(h0)
  if (!h.future.length) return h
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: h.future[0],
    future: h.future.slice(1),
    lastAt: 0,
    gesture: false,
  }
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0 || (h.gesture && h.gestureBase !== h.present)
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0
}
