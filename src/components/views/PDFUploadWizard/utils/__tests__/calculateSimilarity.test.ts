import { describe, test, expect } from 'vitest'
import { calculateSimilarity } from '../calculateSimilarity'

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
