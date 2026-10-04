// Assets are stored by the hash of their bytes: importing the same image twice
// reuses it, and project files can refer to it by id (docs/PLANNING.md §E).

/** 64-bit FNV-1a as two 32-bit halves: only used if SubtleCrypto is unavailable. */
export function fnv1a64(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5
  let h2 = 0xcbf29ce4
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ bytes[(bytes.length - 1 - i)], 0x01000193) >>> 0
  }
  return `fnv-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}-${bytes.length.toString(16)}`
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
      return 'sha256-' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
    } catch {
      /* fall through */
    }
  }
  return fnv1a64(bytes)
}
