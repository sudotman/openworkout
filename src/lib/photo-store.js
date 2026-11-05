/**
 * Progress photos live in IndexedDB rather than in the app-state JSON.
 *
 * localStorage holds about 5 MB per site and every write re-serialises the
 * whole state, so a dozen compressed photos used to crowd out the workout log
 * itself and slow every keystroke. IndexedDB is sized against free disk space
 * and stores each photo once. The app state keeps only each photo's id and date;
 * the image itself is looked up here by id.
 */

const DB_NAME = 'openworkout'
const DB_VERSION = 1
const STORE = 'progress-photos'

let dbPromise = null

function openDatabase() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'))
  })
  // A failed open (private browsing in some browsers) should be retried on
  // the next call rather than cached forever.
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

async function run(mode, operation) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const result = operation(transaction.objectStore(STORE))
    transaction.oncomplete = () => resolve(result?.result)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'))
  })
}

/**
 * Every stored photo, keyed by photo id.
 *
 * @returns {Promise<Map<string, string>>}
 */
export async function loadAllPhotos() {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const photos = new Map()
    const transaction = db.transaction(STORE, 'readonly')
    const request = transaction.objectStore(STORE).openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      if (typeof cursor.value === 'string') photos.set(String(cursor.key), cursor.value)
      cursor.continue()
    }
    transaction.oncomplete = () => resolve(photos)
    transaction.onerror = () => reject(transaction.error)
  })
}

/** @param {string} id @param {string} dataUrl */
export function putPhoto(id, dataUrl) {
  return run('readwrite', (store) => store.put(dataUrl, id))
}

/** @param {string} id */
export function deletePhoto(id) {
  return run('readwrite', (store) => store.delete(id))
}

export function clearPhotos() {
  return run('readwrite', (store) => store.clear())
}

/**
 * Asks the browser not to evict this site's storage under pressure. Without
 * it, browsers may clear an origin's data when the disk fills, and Safari
 * clears script-written storage for sites that haven't been visited in seven
 * days. Installed home-screen apps are exempt from Safari's rule. Browsers that
 * prompt for this (Firefox) only do so after a user gesture, so it's called
 * from actions such as finishing a workout, not on page load.
 *
 * @returns {Promise<boolean>}
 */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
