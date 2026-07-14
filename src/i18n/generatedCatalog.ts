import type { SecondaryLocale } from './extraCatalog'

// Locale catalogs are split into on-demand chunks so English startup does not download every translation.
export async function loadGeneratedCatalog(locale: SecondaryLocale): Promise<Record<string, string>> {
  switch (locale) {
    case 'es': return (await import('./generated/es')).default
    case 'fr': return (await import('./generated/fr')).default
    case 'de': return (await import('./generated/de')).default
    case 'it': return (await import('./generated/it')).default
    case 'nl': return (await import('./generated/nl')).default
  }
}

