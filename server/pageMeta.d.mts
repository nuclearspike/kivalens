// Type surface for what a page says about itself, so the TS client can use it.

export interface PageMeta {
  title: string
  description: string
  image: string
  canonical: string
  robots: string
  routeId: string
}

export declare const SITE_NAME: string
export declare const SITE_ORIGIN: string
export declare const SITE_DESCRIPTION: string
export declare const SITE_IMAGE: string
export declare const PAGE_NAMES: Record<string, { key: string; name: string }>
export declare const INDEXABLE: Set<string>

export declare function pageMeta(input?: {
  pathname?: string
  search?: string
  lookup?: { partner?: unknown; loan?: unknown; names?: Record<string, string> }
}): PageMeta
export declare function applyPageMeta(html: string, meta: PageMeta): string
export declare function describeSearch(search: string): string
export declare function loanImage(loan: unknown): string
