/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chrome Web Store / unpacked id of the KivaLens Companion extension (optional override). */
  readonly VITE_COMPANION_EXT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** The deployed version (build date, YYYY.M.D) and build (commit), stamped by vite.config.ts. */
declare const __KL_VERSION__: string
declare const __KL_BUILD__: string
