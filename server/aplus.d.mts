export declare function csvToArray(strData: string): string[][]
export declare function csvToPartnerScores(csv: string): Array<Record<string, string>>
export declare function normalizeReligion(raw: string): string[]
export declare const RELIGION_CATEGORIES: string[]
export declare function processPartnerReligions<T = unknown>(partners: T[]): T[]
export declare function getReligionSummary(partners: unknown[]): Record<string, number>
export declare function applyAtheistData(partners: unknown[], csv: string | null): number
