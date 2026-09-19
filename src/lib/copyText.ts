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
  try {
    const scratch = document.createElement('textarea')
    scratch.value = text
    scratch.setAttribute('readonly', '')
    scratch.style.position = 'fixed'
    scratch.style.top = '-1000px'
    scratch.style.opacity = '0'
    document.body.appendChild(scratch)
    scratch.select()
    const ok = document.execCommand('copy')
    scratch.remove()
    return ok
  } catch {
    return false
  }
}
