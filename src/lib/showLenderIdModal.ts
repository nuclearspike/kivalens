import { useUtilsStore } from '../stores'

export function showLenderIDModal(): void {
  useUtilsStore.getState().openLenderIdModal()
}
