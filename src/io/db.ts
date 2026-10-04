// The app's IndexedDB: source assets (by content hash) and the autosaved project.
// One shared connection; if IndexedDB is unavailable everything degrades to memory.

const DB_NAME = 'taller-de-grabado'
const VERSION = 2
export const ASSETS = 'assets'
export const PROJECT = 'project'

let dbPromise: Promise<IDBDatabase | null> | null = null

export function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, VERSION)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS, { keyPath: 'id' })
          if (!db.objectStoreNames.contains(PROJECT)) db.createObjectStore(PROJECT)
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
        req.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  return dbPromise
}

export async function dbPut(store: string, value: unknown, key?: IDBValidKey): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value, key)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

export async function dbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb()
  if (!db) return undefined
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store).objectStore(store).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}
