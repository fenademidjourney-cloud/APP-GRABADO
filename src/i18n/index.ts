import { es, type TextKey } from './es'

export type { TextKey }

export function t(key: TextKey): string {
  return es[key]
}

/** A text with {placeholders}: tf('notice.addedMany', { n: 3 }). */
export function tf(key: TextKey, vars: Record<string, string | number>): string {
  return es[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}
