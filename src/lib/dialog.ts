import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Reusable imperative dialogs — styled-modal replacements for the browser's
// window.alert / window.confirm / window.prompt. Call the helpers anywhere
// (they return promises); a single <DialogHost> at the app root renders them.
// ---------------------------------------------------------------------------

export type DialogKind = 'alert' | 'confirm' | 'prompt'

export interface DialogRequest {
  id: number
  kind: DialogKind
  title?: string
  message: string
  /** prompt only */
  defaultValue?: string
  /** prompt only: textarea instead of a single-line input */
  multiline?: boolean
  confirmLabel: string
  cancelLabel: string
  /** confirm/danger styling for the primary button */
  danger?: boolean
  resolve: (value: string | boolean | null) => void
}

interface DialogStore {
  current: DialogRequest | null
  queue: DialogRequest[]
  enqueue: (req: DialogRequest) => void
  resolveCurrent: (value: string | boolean | null) => void
}

let nextId = 1

export const useDialogStore = create<DialogStore>((set, get) => ({
  current: null,
  queue: [],
  enqueue: (req) =>
    set((s) =>
      s.current ? { queue: [...s.queue, req] } : { current: req },
    ),
  resolveCurrent: (value) => {
    const { current, queue } = get()
    current?.resolve(value)
    const [next, ...rest] = queue
    set({ current: next ?? null, queue: rest })
  },
}))

function request(
  partial: Omit<DialogRequest, 'id' | 'resolve'>,
): Promise<string | boolean | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().enqueue({ ...partial, id: nextId++, resolve })
  })
}

export interface AlertOptions {
  title?: string
  confirmLabel?: string
}

export function showAlert(message: string, options: AlertOptions = {}): Promise<void> {
  return request({
    kind: 'alert',
    message,
    title: options.title,
    confirmLabel: options.confirmLabel ?? 'OK',
    cancelLabel: '',
  }).then(() => undefined)
}

export interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export function showConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return request({
    kind: 'confirm',
    message,
    title: options.title,
    confirmLabel: options.confirmLabel ?? 'OK',
    cancelLabel: options.cancelLabel ?? 'Cancel',
    danger: options.danger,
  }).then((v) => v === true)
}

export interface PromptOptions {
  title?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
  multiline?: boolean
}

/** Resolves to the entered string, or null if cancelled (like window.prompt). */
export function showPrompt(message: string, options: PromptOptions = {}): Promise<string | null> {
  return request({
    kind: 'prompt',
    message,
    title: options.title,
    defaultValue: options.defaultValue ?? '',
    multiline: options.multiline,
    confirmLabel: options.confirmLabel ?? 'OK',
    cancelLabel: options.cancelLabel ?? 'Cancel',
  }).then((v) => (typeof v === 'string' ? v : null))
}
