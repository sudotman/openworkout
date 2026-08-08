export const STORAGE_KEYS = Object.freeze({
  APP_STATE: 'openworkout:app-state',
})

function getLocalStorage() {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : null
  } catch {
    return null
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function validateImportedState(value) {
  if (!isPlainObject(value)) {
    throw new TypeError('Invalid workout backup: expected a JSON object.')
  }

  if (!Number.isInteger(value.version) || value.version < 1) {
    throw new TypeError('Invalid workout backup: "version" must be a positive integer.')
  }

  if (!Array.isArray(value.workouts)) {
    throw new TypeError('Invalid workout backup: "workouts" must be an array.')
  }

  if (!isPlainObject(value.settings)) {
    throw new TypeError('Invalid workout backup: "settings" must be an object.')
  }

  return value
}

/**
 * Loads the saved application state, falling back when storage is unavailable,
 * empty, or contains malformed JSON.
 *
 * @template T
 * @param {T} fallback
 * @returns {T}
 */
export function loadAppState(fallback) {
  try {
    const storage = getLocalStorage()
    const serializedState = storage?.getItem(STORAGE_KEYS.APP_STATE)

    if (!serializedState) {
      return fallback
    }

    const parsedState = JSON.parse(serializedState)
    return isPlainObject(parsedState) ? parsedState : fallback
  } catch {
    return fallback
  }
}

/**
 * Saves application state locally. Returns false when storage is unavailable or
 * the value cannot be serialized (for example, because it is circular).
 *
 * @param {unknown} state
 * @returns {boolean}
 */
export function saveAppState(state) {
  try {
    const storage = getLocalStorage()
    if (!storage) {
      return false
    }

    storage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

/**
 * Downloads a human-readable JSON backup of the supplied state.
 *
 * @param {unknown} state
 * @returns {boolean}
 */
export function exportAppState(state) {
  let objectUrl = null

  try {
    const json = `${JSON.stringify(state, null, 2)}\n`
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    objectUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    link.href = objectUrl
    link.download = `openworkout-backup-${date}.json`
    link.style.display = 'none'

    document.body.appendChild(link)
    link.click()
    link.remove()

    return true
  } catch {
    return false
  } finally {
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl)
      } catch {
        // Revocation is best-effort in restricted browser contexts.
      }
    }
  }
}

/**
 * Reads and validates a JSON backup file.
 *
 * @param {Blob} file
 * @returns {Promise<Record<string, unknown>>}
 */
export async function importAppState(file) {
  try {
    if (!file || typeof file.text !== 'function') {
      throw new TypeError('Choose a valid JSON backup file.')
    }

    const contents = await file.text()
    const parsedState = JSON.parse(contents)
    return validateImportedState(parsedState)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new TypeError('Invalid workout backup: the file is not valid JSON.', {
        cause: error,
      })
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error('Unable to import the workout backup.')
  }
}

/**
 * Removes the saved application state. Returns false when storage is unavailable.
 *
 * @returns {boolean}
 */
export function clearAppState() {
  try {
    const storage = getLocalStorage()
    if (!storage) {
      return false
    }

    storage.removeItem(STORAGE_KEYS.APP_STATE)
    return true
  } catch {
    return false
  }
}
