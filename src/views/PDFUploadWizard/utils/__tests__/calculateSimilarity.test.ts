import { describe, test, expect } from 'vitest'
import { calculateSimilarity, calculateNameSimilarity } from '../calculateSimilarity'

describe('calculateSimilarity', () => {
  describe('exact matches', () => {
    test('returns 1 for identical strings', () => {
      expect(calculateSimilarity('hello', 'hello')).toBe(1)
    })

    test('returns 1 for identical strings with different cases', () => {
      expect(calculateSimilarity('Hello', 'hello')).toBe(1)
      expect(calculateSimilarity('HELLO', 'hello')).toBe(1)
      expect(calculateSimilarity('HeLLo', 'hEllO')).toBe(1)
    })

    test('returns 1 for empty strings', () => {
      expect(calculateSimilarity('', '')).toBe(1)
    })
  })

  describe('completely different strings', () => {
    test('returns 0 for completely different strings of same length', () => {
      expect(calculateSimilarity('abc', 'xyz')).toBe(0)
    })

    test('returns low score for unrelated strings', () => {
      const score = calculateSimilarity('john', 'mary')
      expect(score).toBeLessThan(0.5)
    })
  })

  describe('similar strings', () => {
    test('returns high score for strings with one character difference', () => {
      const score = calculateSimilarity('hello', 'hallo')
      expect(score).toBeGreaterThan(0.7)
    })

    test('returns high score for strings with typos', () => {
      const score = calculateSimilarity('testing', 'tesitng')
      expect(score).toBeGreaterThan(0.7)
    })

    test('returns medium score for strings with multiple differences', () => {
      const score = calculateSimilarity('hello', 'help')
      expect(score).toBeGreaterThan(0.5)
      expect(score).toBeLessThan(1)
    })
  })

  describe('substring relationships', () => {
    test('returns high score when one string is prefix of another', () => {
      const score = calculateSimilarity('john', 'johnny')
      expect(score).toBeGreaterThan(0.5)
    })

    test('returns high score when one string contains the other', () => {
      const score = calculateSimilarity('doe', 'doer')
      expect(score).toBeGreaterThan(0.7)
    })
  })

  describe('name matching scenarios', () => {
    test('matches similar first names', () => {
      const score = calculateSimilarity('John', 'Jon')
      expect(score).toBeGreaterThan(0.7)
    })

    test('matches names with minor spelling variations', () => {
      // 'Michael' -> 'Micheal' is distance 2 (transposition = 2 ops in Levenshtein)
      // similarity = (7 - 2) / 7 = 0.714...
      const score = calculateSimilarity('Michael', 'Micheal')
      expect(score).toBeGreaterThan(0.7)
    })

    test('matches full names with high similarity', () => {
      const score = calculateSimilarity('John Smith', 'John Smyth')
      expect(score).toBeGreaterThan(0.8)
    })

    test('scores differently for different names', () => {
      const similarScore = calculateSimilarity('John', 'Jon')
      const differentScore = calculateSimilarity('John', 'Mary')
      expect(similarScore).toBeGreaterThan(differentScore)
    })
  })

  describe('edge cases', () => {
    test('handles one empty string', () => {
      const score = calculateSimilarity('hello', '')
      expect(score).toBe(0)
    })

    test('handles single character strings', () => {
      expect(calculateSimilarity('a', 'a')).toBe(1)
      expect(calculateSimilarity('a', 'b')).toBe(0)
    })

    test('handles strings with spaces', () => {
      const score = calculateSimilarity('hello world', 'hello world')
      expect(score).toBe(1)
    })

    test('handles strings with numbers', () => {
      const score = calculateSimilarity('test123', 'test124')
      expect(score).toBeGreaterThan(0.8)
    })

    test('handles special characters', () => {
      const score = calculateSimilarity("O'Brien", "OBrien")
      expect(score).toBeGreaterThan(0.8)
    })
  })

  describe('mathematical properties', () => {
    test('score is between 0 and 1', () => {
      const testCases = [
        ['hello', 'world'],
        ['a', 'zzzzz'],
        ['test', 'testing'],
        ['', 'something'],
        ['abc', 'abc'],
      ]

      for (const [s1, s2] of testCases) {
        const score = calculateSimilarity(s1, s2)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
      }
    })

    test('is symmetric - order of arguments does not matter', () => {
      expect(calculateSimilarity('hello', 'hallo')).toBe(calculateSimilarity('hallo', 'hello'))
      expect(calculateSimilarity('test', 'testing')).toBe(calculateSimilarity('testing', 'test'))
      expect(calculateSimilarity('a', 'b')).toBe(calculateSimilarity('b', 'a'))
    })
  })

  describe('Levenshtein distance verification', () => {
    test('calculates correct similarity for known distance 1', () => {
      // 'kitten' -> 'sitten' is distance 1, max length is 6
      // similarity = (6 - 1) / 6 = 0.833...
      const score = calculateSimilarity('kitten', 'sitten')
      expect(score).toBeCloseTo(5 / 6, 5)
    })

    test('calculates correct similarity for known distance 3', () => {
      // 'kitten' -> 'sitting' is distance 3 (substitute k->s, substitute e->i, insert g)
      // max length is 7
      // similarity = (7 - 3) / 7 = 0.571...
      const score = calculateSimilarity('kitten', 'sitting')
      expect(score).toBeCloseTo(4 / 7, 5)
    })
  })
})

describe('calculateNameSimilarity', () => {
  describe('exact name matches', () => {
    test('returns 1 for identical first and last names', () => {
      const score = calculateNameSimilarity('John', 'Smith', 'John', 'Smith')
      expect(score).toBeCloseTo(1, 5)
    })

    test('returns 1 for identical names with middle initials', () => {
      const score = calculateNameSimilarity('John', 'Smith', 'John', 'Smith', 'M', 'M')
      expect(score).toBeCloseTo(1, 5)
    })

    test('is case insensitive', () => {
      const score = calculateNameSimilarity('JOHN', 'SMITH', 'john', 'smith')
      expect(score).toBeCloseTo(1, 5)
    })
  })

  describe('last name prioritization', () => {
    test('scores high when last name matches perfectly but first name differs', () => {
      // John vs Jane: 'John' vs 'Jane' similarity = 0.5 (J-n match, oh vs ae differ)
      // Score: 0.5 * 0.3 + 1.0 * 0.6 + 1.0 * 0.1 = 0.15 + 0.6 + 0.1 = 0.85 (roughly)
      const score = calculateNameSimilarity('John', 'Smith', 'Jane', 'Smith')
      expect(score).toBeGreaterThan(0.7)
      expect(score).toBeLessThan(0.85)
    })

    test('scores higher for last name match than first name match', () => {
      const lastNameMatch = calculateNameSimilarity('John', 'Smith', 'Jane', 'Smith')
      const firstNameMatch = calculateNameSimilarity('John', 'Smith', 'John', 'Jones')
      expect(lastNameMatch).toBeGreaterThan(firstNameMatch)
    })

    test('perfect last name match gives at least 60% score even with completely different first name', () => {
      const score = calculateNameSimilarity('Zachary', 'Smith', 'Alice', 'Smith')
      expect(score).toBeGreaterThanOrEqual(0.6)
    })
  })

  describe('realistic client matching scenarios', () => {
    test('matches clients with same last name and similar first name', () => {
      // Michael vs Micheal (common typo) - first name ~0.86, last name 1.0
      // Score: 0.86 * 0.3 + 1.0 * 0.6 + 1.0 * 0.1 = 0.258 + 0.6 + 0.1 = 0.958
      const score = calculateNameSimilarity('Michael', 'Johnson', 'Micheal', 'Johnson')
      expect(score).toBeGreaterThan(0.9)
    })

    test('handles middle initial mismatch gracefully', () => {
      // Same first/last, different middle initial (M vs P = 0 similarity)
      // Score: 1.0 * 0.3 + 1.0 * 0.6 + 0.0 * 0.1 = 0.9
      const score = calculateNameSimilarity('John', 'Smith', 'John', 'Smith', 'M', 'P')
      expect(score).toBeCloseTo(0.9, 5)
    })

    test('handles missing middle initial on one side', () => {
      // One has middle initial, one doesn't - should use 0.8 penalty
      // Score: 1.0 * 0.3 + 1.0 * 0.6 + 0.8 * 0.1 = 0.3 + 0.6 + 0.08 = 0.98
      const score = calculateNameSimilarity('John', 'Smith', 'John', 'Smith', 'M')
      expect(score).toBeCloseTo(0.98, 2)
    })

    test('handles missing middle initial on both sides', () => {
      // Neither has middle initial - should default to 1.0
      // Score: 1.0 * 0.3 + 1.0 * 0.6 + 1.0 * 0.1 = 1.0
      const score = calculateNameSimilarity('John', 'Smith', 'John', 'Smith')
      expect(score).toBeCloseTo(1.0, 5)
    })

    test('scores differently for common vs uncommon name mismatches', () => {
      // Smith is common - should have lower threshold
      const commonScore = calculateNameSimilarity('John', 'Smith', 'Jon', 'Smith')
      const uncommonScore = calculateNameSimilarity('John', 'Szczepanski', 'Jon', 'Szczepanski')

      // Both should be high, but uncommon last name provides more confidence
      expect(commonScore).toBeGreaterThan(0.85)
      expect(uncommonScore).toBeGreaterThan(0.85)
    })
  })

  describe('edge cases', () => {
    test('handles empty first name', () => {
      const score = calculateNameSimilarity('', 'Smith', 'John', 'Smith')
      // Last name perfect (0.6), first name 0 (0.0), middle 1.0 (0.1) = 0.7
      expect(score).toBeCloseTo(0.7, 2)
    })

    test('handles empty last name', () => {
      const score = calculateNameSimilarity('John', '', 'John', 'Smith')
      // First name perfect (0.3), last name 0 (0.0), middle 1.0 (0.1) = 0.4
      expect(score).toBeCloseTo(0.4, 2)
    })

    test('handles completely empty names', () => {
      const score = calculateNameSimilarity('', '', '', '')
      expect(score).toBeCloseTo(1.0, 5) // Empty strings match perfectly
    })

    test('handles special characters in names', () => {
      const score = calculateNameSimilarity("O'Brien", 'Smith', "O'Brien", 'Smith')
      expect(score).toBeCloseTo(1.0, 5)
    })

    test('handles hyphenated last names', () => {
      const score = calculateNameSimilarity('John', 'Smith-Jones', 'John', 'Smith-Jones')
      expect(score).toBeCloseTo(1.0, 5)
    })
  })

  describe('score range validation', () => {
    test('all scores are between 0 and 1', () => {
      const testCases = [
        ['John', 'Smith', 'Jane', 'Doe'],
        ['Alice', 'Johnson', 'Bob', 'Williams'],
        ['Michael', 'Brown', 'Micheal', 'Brown'],
        ['', '', 'John', 'Smith'],
        ['John', 'Smith', 'John', 'Smith'],
      ]

      for (const [searchFirst, searchLast, clientFirst, clientLast] of testCases) {
        const score = calculateNameSimilarity(searchFirst, searchLast, clientFirst, clientLast)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('weight calculation verification', () => {
    test('calculates correct weighted score for known values', () => {
      // Test case: 80% first name match, 100% last name match, no middle
      // Expected: 0.8 * 0.3 + 1.0 * 0.6 + 1.0 * 0.1 = 0.24 + 0.6 + 0.1 = 0.94
      // Using 'John' vs 'Joan' (4 chars, 1 substitution = 0.75 similarity)
      const score = calculateNameSimilarity('Joan', 'Smith', 'John', 'Smith')
      expect(score).toBeCloseTo(0.925, 2) // 0.75*0.3 + 1.0*0.6 + 1.0*0.1 = 0.925
    })

    test('verifies 60/30/10 weight distribution', () => {
      // Perfect last name, zero first name, perfect middle
      const lastOnly = calculateNameSimilarity('zzz', 'Smith', 'aaa', 'Smith', 'M', 'M')
      expect(lastOnly).toBeCloseTo(0.7, 1) // 0.6 + 0.1 = 0.7

      // Perfect first name, zero last name, perfect middle
      const firstOnly = calculateNameSimilarity('John', 'zzz', 'John', 'aaa', 'M', 'M')
      expect(firstOnly).toBeCloseTo(0.4, 1) // 0.3 + 0.1 = 0.4

      // Zero first/last, perfect middle
      const middleOnly = calculateNameSimilarity('zzz', 'yyy', 'aaa', 'bbb', 'M', 'M')
      expect(middleOnly).toBeCloseTo(0.1, 1) // 0.1
    })
  })
})
