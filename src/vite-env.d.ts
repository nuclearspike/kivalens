/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chrome Web Store / unpacked id of the KivaLens Companion extension (optional override). */
  readonly VITE_COMPANION_EXT_ID?: string
  /** Base URL of the HumansAreUseful App Services API, when not the default for this build. */
  readonly VITE_HAU_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** The deployed version (build date, YYYY.M.D) and build (commit), stamped by vite.config.ts. */
declare const __KL_VERSION__: string
declare const __KL_BUILD__: string
