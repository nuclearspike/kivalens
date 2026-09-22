import { pluralCategory } from './pluralCategory'

type Translate = (key: string, params?: Record<string, string | number>) => string

export interface MfiOnlyPrompt {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
}

/**
 * The dialog that offers MFI Only when the lender reaches for a partner filter that
 * cannot apply in Both or Direct Only. It says why, what MFI Only would return, and
 * asks. `mfiCount` is the full search with MFI Only chosen and every other criterion
 * as it stands — kept partner filters included, since switching applies them — or
 * null while the loans are still loading, and then the dialog states no number.
 */
export function mfiOnlyPrompt(
  mode: 'both' | 'direct',
  mfiCount: number | null,
  t: Translate,
  locale: string,
  number: (value: number) => string,
): MfiOnlyPrompt {
  const wouldShow =
    mfiCount == null
      ? ''
      : `${t(pluralCategory(locale, mfiCount) === 'one' ? 'mfi_only_would_show_one' : 'mfi_only_would_show', {
          count: number(mfiCount),
        })} `
  return {
    title: t('mfi_only_filters_title'),
    message: `${t(mode === 'direct' ? 'mfi_only_filters_body_direct' : 'mfi_only_filters_body_both')}\n\n${wouldShow}${t(
      'switch_to_mfi_only_question',
    )}`,
    confirmLabel: t('only_search_mfis'),
    cancelLabel: t(mode === 'direct' ? 'keep_direct_only' : 'keep_mfi_and_direct'),
  }
}
