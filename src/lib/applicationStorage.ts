export const ASK_KIVALENS_STORAGE_PREFIX = 'AskKivaLens:'
const MAX_KEYS = 32
const MAX_VALUE_BYTES = 4 * 1024

function validKey(key: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(key)
}

/**
 * Return only the ApplicationStorage namespace owned by Ask KivaLens.
 * Keys are unprefixed for the server tool; unrelated localStorage is invisible.
 */
export function readAskKivaLensStorage(storage: Storage = window.localStorage): Record<string, string> {
  const values: Record<string, string> = {}
  try {
    for (let i = 0; i < storage.length && Object.keys(values).length < MAX_KEYS; i++) {
      const fullKey = storage.key(i)
      if (!fullKey?.startsWith(ASK_KIVALENS_STORAGE_PREFIX)) continue
      const key = fullKey.slice(ASK_KIVALENS_STORAGE_PREFIX.length)
      if (!validKey(key)) continue
      const value = storage.getItem(fullKey)
      if (value != null && new TextEncoder().encode(value).length <= MAX_VALUE_BYTES) values[key] = value
    }
  } catch {
    // Storage can be unavailable in privacy modes; an empty namespace is safe.
  }
  return values
}

export function writeAskKivaLensStorage(
  key: string,
  value: string,
  storage: Storage = window.localStorage,
): boolean {
  if (!validKey(key) || new TextEncoder().encode(value).length > MAX_VALUE_BYTES) return false
  try {
    storage.setItem(`${ASK_KIVALENS_STORAGE_PREFIX}${key}`, value)
    return true
  } catch {
    return false
  }
}
