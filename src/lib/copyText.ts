// Puts text on the clipboard. The async Clipboard API needs a secure context and
// permission; where it is missing or refuses, a throwaway off-screen textarea and
// the legacy copy command do the job. Resolves false only when both fail.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // refused (permission, insecure context): try the legacy path below
  }
  let scratch: HTMLTextAreaElement | null = null
  try {
    scratch = document.createElement('textarea')
    scratch.value = text
    scratch.setAttribute('readonly', '')
    scratch.style.position = 'fixed'
    scratch.style.top = '-1000px'
    scratch.style.opacity = '0'
    document.body.appendChild(scratch)
    scratch.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    // Gone whatever the copy command did, thrown or not.
    scratch?.remove()
  }
}
