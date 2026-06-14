/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chrome Web Store / unpacked id of the KivaLens Companion extension (optional override). */
  readonly VITE_COMPANION_EXT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
