// Kiva names every breakdown slice — sector, country, activity, region, gender —
// in English, and each of those names is in the catalog, so `data` translates it.
// A partner's name is a proper noun and stays exactly as Kiva gives it; it must
// not be looked up, because a partner called "Food" would come back translated.
export function localizeSliceName(sliceBy: string, name: string, data: (english: string) => string): string {
  return sliceBy === 'partner' ? name : data(name)
}
