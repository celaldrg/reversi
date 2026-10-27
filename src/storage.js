/**
 * Safe localStorage access. Every read and write is wrapped in try/catch, so
 * private browsing, disabled storage, a full quota or corrupt data never
 * break the game. Values are stored as JSON under a "reversi:" prefix.
 * The backend is looked up lazily, never at import time.
 */

const PREFIX = 'reversi:';

/**
 * Creates a storage helper over a Storage-like backend.
 * @param {() => (Pick<Storage, 'getItem'|'setItem'>|null|undefined)} [getBackend]
 *   returns the backend; defaults to the page's localStorage
 * @returns {{get: (key: string, fallback?: unknown) => unknown, set: (key: string, value: unknown) => boolean}}
 */
export function createStorage(getBackend = () => globalThis.localStorage) {
  return {
    /**
     * Reads a stored value.
     * @param {string} key
     * @param {unknown} [fallback] returned when nothing (valid) is stored or storage fails
     * @returns {unknown}
     */
    get(key, fallback = null) {
      try {
        const raw = getBackend()?.getItem(PREFIX + key);
        return raw === null || raw === undefined ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    /**
     * Stores a value as JSON.
     * @param {string} key
     * @param {unknown} value
     * @returns {boolean} whether it was saved
     */
    set(key, value) {
      try {
        const backend = getBackend();
        if (!backend) return false;
        backend.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** The page-wide helper over localStorage. */
export const storage = createStorage();
