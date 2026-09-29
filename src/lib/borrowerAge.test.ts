import { describe, expect, it } from 'vitest'
import { read, ageFrom, needsReview, readLegacy, nameTokens } from '../../server/borrowerAge.mjs'

const age = (text: string, name?: string, asOf?: string | number) => ageFrom(read(text, name, asOf))

describe('borrowerAge: the age Kiva actually wrote', () => {
  it('reads the plain spellings', () => {
    expect(age('Maria is 45 years old and runs a store.')).toBe(45)
    expect(age('She is a 45-year-old farmer.')).toBe(45)
    expect(age('Ana, aged 45, sells fruit.')).toBe(45)
    expect(age('Mercedes (age 46) is part of this activity.')).toBe(46)
    expect(age('Rosa is 45 years of age.')).toBe(45)
  })

  it('reads the spellings the old extractor could not see', () => {
    // Kiva's own text carries stray spaces and unicode dashes.
    expect(age('Rosy is a 58-year- old entrepreneur.')).toBe(58)
    expect(age('This is 40–year–old Kadiatu from Mattru Jong.')).toBe(40)
    // The commonest miss of all: the age fenced by commas after a name.
    expect(age('Melody, 47, works hard for her family.')).toBe(47)
    expect(age('Manuel de Jesus, 41, is married and a father of four.')).toBe(41)
    // The age opening the sentence.
    expect(age('At 49, Ramon has dedicated his efforts to construction.')).toBe(49)
  })

  it('sees borrowers under 20, who were invisible to the old [2-9]\\d pattern', () => {
    expect(age('Lea is a 19-year-old woman who lives in Vinaninony.')).toBe(19)
    expect(age('Jordym Antonio is 18 years old and studying electronics.')).toBe(18)
    expect(readLegacy('Lea is a 19-year-old woman.')).toBeNull() // what production did
  })

  it("never returns a child's or a relative's age", () => {
    expect(age('Delmy lives with her 20-year-old daughter.')).toBeNull()
    expect(age('Sonia lives with her 21-year-old daughter and her 2-year-old grandson.')).toBeNull()
    expect(age('Jose lives with his adult daughter, who is now 29 years old.')).toBeNull()
    expect(age('She provides for her three children, aged 26, 16, and 13.')).toBeNull()
    // The relative can follow the age instead of preceding it.
    expect(age('He has no children. His 19 year old nephew also lives in his home.')).toBeNull()
  })

  it("takes the borrower's own age even when a child's age is nearby", () => {
    expect(age('At 52, Kabumbayi is a mother of five children aged between 12 and 23 years old.')).toBe(52)
    expect(age('Gina Piedad, 45, is married and has three children—aged 23, 20, and 9.')).toBe(45)
    expect(age('Mercedes (age 46) is separated and the mother of four children from 19 to 26 years of age.')).toBe(46)
    // The borrower described AS a parent still owns the age.
    expect(age('Zubarzhat is a 36-year-old mom of three children.')).toBe(36)
    expect(age('Nurzhamal is a 38-year-old mother of two.')).toBe(38)
  })

  it('treats a capitalised kin word as a name, because it is one', () => {
    // "Baby Jane" is the borrower. Reading "Baby" as a relative threw her age away.
    expect(age('Baby Jane is 44 years old and single.')).toBe(44)
    expect(age('Greetings! This is Baby, 45, from Moyamba Branch.')).toBe(45)
  })

  it('ignores an age from the borrower\'s past', () => {
    expect(age('At age 19 she got married and started a family.')).toBeNull()
    expect(age('She has run the shop since the age of 22.')).toBeNull()
  })

  it('refuses numbers that cannot be a borrower age', () => {
    expect(age('She has run her store for 12 years.')).toBeNull()
    expect(age('The shop is 5 years old.')).toBeNull() // a thing, not a person
    expect(age('He is 120 years old.')).toBeNull()
    expect(age('')).toBeNull()
    expect(age('No age here at all.')).toBeNull()
  })

  it('asks for a second opinion instead of guessing, and publishes nothing until it gets one', () => {
    const loose = read('Zhamalaim is 48 and married with two children.')
    expect(loose.confidence).toBe('ambiguous')
    expect(needsReview(loose)).toBe(true)
    expect(ageFrom(loose)).toBeNull() // not published on the strength of "is 48"
    expect(loose.age).toBe(48) // ...but offered to the model as a starting point

    const clear = read('Maria is 45 years old.')
    expect(clear.confidence).toBe('certain')
    expect(needsReview(clear)).toBe(false)
    expect(ageFrom(clear)).toBe(45)
  })

  it('says why, so a wrong reading can be diagnosed from a log', () => {
    expect(read('Melody, 47, works hard.').why).toContain('named-comma')
    expect(read('She lives with her 20-year-old daughter.').why).toContain('belongs to someone else')
    expect(read('No numbers here.').why).toContain('no age')
  })
})

// Paul, 2026-09-29: "if a borrower is 50 with 'children 24 and 26 years old' we DON'T want to see
// the 24/26 year old in the 'ages mentioned' ... if we know that the borrower has age of X, then any
// mention of their children's ages (even if over 18) we ignore." Measured against the 10,855 stories
// in the local loan archive: analysis/age-2026-09-29/.
describe("borrowerAge: the borrower's age, never a relative's", () => {
  it('ignores grown children, in the plural as much as the singular', () => {
    expect(age("Maria is 50 years old and has two children, 24 and 26 years old.")).toBe(50)
    expect(age('Maria has two sons, aged 24 and 26.')).toBeNull()
    expect(age('Maria has two sons who are 24 and 26 years old.')).toBeNull()
    expect(age('Her daughters are 24 and 26 years old.')).toBeNull()
    expect(age('Maria has a son who is aged 24. She sells vegetables.')).toBeNull()
    // A child named as the oldest or eldest, as Kiva writes it.
    expect(age('She is married and the mother of two children. The oldest is 28 years old and the youngest is 12.')).toBeNull()
    expect(age('Issa is married and the father of eight. The eldest is 32 and the youngest is 2.', 'Issa')).toBeNull()
  })

  it('ignores a spouse, a parent and other elders', () => {
    expect(age('Her husband is 50 years old. Maria sells vegetables.', 'Maria')).toBeNull()
    expect(age('Maria is a widow and her mother is 70 years old.', 'Maria')).toBeNull()
    expect(age('Her husband, a 50-year-old farmer, helps Maria.', 'Maria')).toBeNull()
    expect(age('Mrs. Anh is 57 years old. She cares for her mother, who is nearly 80 years old.', 'Anh')).toBe(57)
    // Her own age, written in words; never her daughter's.
    expect(age('Fifty-five-year-old Lorenza is a single mother with a 30-year-old daughter.', 'Buena Vista Group')).toBe(55)
  })

  it('keeps the age when the borrower is the one described as the relation', () => {
    expect(age('Maria is a 25-year-old daughter of farmers.')).toBe(25)
    expect(age('Evans, a devoted 31-year-old husband and father of two, farms maize.')).toBe(31)
    expect(age('Martha is a resilient and hardworking 43-year-old single mother.')).toBe(43)
    expect(age('Meet Fatta, a dedicated and hardworking 45-year-old mother.')).toBe(45)
    expect(age('A 45-year-old widow, Rosa sells fish.')).toBe(45)
    // After "and", the relation is what the subject is; the age is the subject's.
    expect(age('Rutte is 40 years old and mother of four children.')).toBe(40)
    expect(age('He is 31 years old and father to one child.')).toBe(31)
    expect(age('Maria lives with her mother and is 45 years old.')).toBe(45)
  })

  it('asks rather than guesses when a relative is what the sentence is about', () => {
    const r = read('Her son works in Lima and is 24 years old.', 'Maria')
    expect(r.confidence).toBe('ambiguous')
    expect(ageFrom(r)).toBeNull()
  })
})

describe("borrowerAge: the age tied to the name on the loan", () => {
  it('wins over every other age in the story', () => {
    expect(age('Juan, 26, and Pedro, 24, are the sons of Maria. Maria is 50 years old.', 'Maria')).toBe(50)
    // Without the name the first age is taken, which is why every caller passes it.
    expect(age('Juan, 26, and Pedro, 24, are the sons of Maria. Maria is 50 years old.')).toBe(26)
    expect(age('Nancy, 41, lives in Palawan. She is 48 years old.', 'Nancy')).toBe(41)
    expect(read('Juan, 26, and Pedro, 24, are the sons of Maria. Maria is 50 years old.', 'Maria').why).toContain("the borrower's name")
  })

  it('settles "is 48" on its own when it is said of the borrower by name', () => {
    const named = read('Zhamalaim is 48 and married with two children.', 'Zhamalaim')
    expect(named.confidence).toBe('certain')
    expect(ageFrom(named)).toBe(48)
    expect(age('María is 29. She studied fourth grade.', 'Maria Raquel')).toBe(29)
    expect(age('John is 54 years and has no kids under 18 years.', 'John')).toBe(54)
    // ...but not a measure that happens to follow the name.
    expect(read('Maria is 48 kilometers from the market.', 'Maria').confidence).toBe('ambiguous')
  })

  it('matches the name whatever its accents, title or the words around it', () => {
    expect(age('Néstor is 35 years old and he completed his high school.', 'Nestor David')).toBe(35)
    expect(age('Ms. Phượng is 45 and lives with her family.', 'Phượng')).toBe(45)
    expect(age('Óscar, 29, is single and lives with his parents.', 'Oscar Rene')).toBe(29)
    expect(age('Shabnam is an 18-year-old girl from Dangara who lives with her parents.', 'Shabnam')).toBe(18)
    expect(age('Please support Gulipa; a mother doing her best for her children Gulipa is a 34-year-old mother of two.', 'Gulipa')).toBe(34)
  })

  it('reads a group name as no name at all', () => {
    expect(nameTokens('Grupo Por Venir Group')).toEqual(['por', 'venir'])
    expect(age('Carmelia, age 24, is an entrepreneur. At age 19, she married.', 'Grupo Por Venir Group')).toBe(24)
    expect(nameTokens('')).toEqual([])
    expect(nameTokens(null)).toEqual([])
  })

  it('never takes a past age tied to the name', () => {
    expect(age('Maria was 19 when she married. She sells fruit.', 'Maria')).toBeNull()
  })
})

describe('borrowerAge: the other ways Kiva gives an age', () => {
  it('counts a birth year as the age it gives when the story was written', () => {
    expect(age('Gulchehra is a native of the Khuruson district. She was born in 1965 and is married.', 'Gulchehra', '2026-09-20T10:00:00Z')).toBe(61)
    expect(age('Saba, born in 1962, is a mother of six.', 'Saba', 2026)).toBe(64)
    expect(age('Pardakhol was born in 1981 and lives in Khuroson.', 'Pardakhol', '2025-03-01')).toBe(44)
    // A relative's birth year is theirs: refused outright, not even sent to the model.
    expect(read('Her husband was born in 1960. She sells bread.', 'Ana', '2026-09-01').confidence).toBe('none')
    expect(read('Ana lives with her husband, who was born in 1960.', 'Ana', '2026-09-01').confidence).toBe('none')
    expect(age('Her son was born in 2001 and helps her. Saba was born in 1962.', 'Saba', '2026-09-01')).toBe(64)
  })

  it('reads an age written in words', () => {
    expect(age('Santa, fifty eight years old, has lived for the past 26 years in a rural area.', 'Santa Susana')).toBe(58)
    expect(age('Maria is a forty-two-year-old baker.')).toBe(42)
    expect(age('Juan is nineteen years old and studies at night.')).toBe(19)
    expect(age('Maria is twentyone years old.')).toBe(21)
    expect(age('Maria is sixty – three years old.')).toBe(63)
  })

  it('reads "At N years," opening the story, and not a span of years', () => {
    expect(age('At 36 years, Milka is married and a proud mother of four.', 'Milka')).toBe(36)
    expect(age('For 47 years, Lesbia has dedicated her efforts to growing beans.', 'Lesbia Amparo')).toBeNull()
    expect(age('Nina is a hardworking farmer with 24 years of experience.', 'Nina')).toBeNull()
  })
})
