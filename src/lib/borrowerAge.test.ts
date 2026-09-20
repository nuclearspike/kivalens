import { describe, expect, it } from 'vitest'
import { read, ageFrom, needsReview, readLegacy } from '../../server/borrowerAge.mjs'

const age = (text: string) => ageFrom(read(text))

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
