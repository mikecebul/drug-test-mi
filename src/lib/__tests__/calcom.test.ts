import { describe, it, expect } from '@jest/globals'
import {
  extractPhoneFromCalcomWebhook,
  detectRecurringBooking,
  normalizePhoneNumber,
  phoneNumbersMatch,
} from '../calcom'

describe('Cal.com Utilities', () => {
  describe('extractPhoneFromCalcomWebhook', () => {
    it('should extract phone from responses.phone.value', () => {
      const payload = {
        responses: {
          phone: {
            value: '(231) 547-1144',
          },
        },
      }

      expect(extractPhoneFromCalcomWebhook(payload)).toBe('(231) 547-1144')
    })

    it('should extract phone from customInputs', () => {
      const payload = {
        customInputs: {
          phone: {
            label: 'Phone Number',
            value: '231-547-1144',
          },
        },
      }

      expect(extractPhoneFromCalcomWebhook(payload)).toBe('231-547-1144')
    })

    it('should return null if no phone found', () => {
      const payload = {
        responses: {
          email: {
            value: 'test@example.com',
          },
        },
      }

      expect(extractPhoneFromCalcomWebhook(payload)).toBeNull()
    })
  })

  describe('detectRecurringBooking', () => {
    it('should detect recurring booking with recurringEventId', () => {
      const payload = {
        recurringEventId: 'rec_123456',
      }

      const result = detectRecurringBooking(payload)
      expect(result.isRecurring).toBe(true)
      expect(result.recurringGroupId).toBe('rec_123456')
    })

    it('should detect recurring booking with recurrence field', () => {
      const payload = {
        recurrence: {
          frequency: 'WEEKLY',
          interval: 1,
        },
      }

      const result = detectRecurringBooking(payload)
      expect(result.isRecurring).toBe(true)
    })

    it('should return false for non-recurring booking', () => {
      const payload = {
        uid: 'booking_123',
      }

      const result = detectRecurringBooking(payload)
      expect(result.isRecurring).toBe(false)
      expect(result.recurringGroupId).toBeNull()
    })
  })

  describe('normalizePhoneNumber', () => {
    it('should remove formatting characters', () => {
      expect(normalizePhoneNumber('(231) 547-1144')).toBe('2315471144')
      expect(normalizePhoneNumber('231-547-1144')).toBe('2315471144')
      expect(normalizePhoneNumber('231.547.1144')).toBe('2315471144')
    })

    it('should preserve leading + for international numbers', () => {
      expect(normalizePhoneNumber('+1 (231) 547-1144')).toBe('+12315471144')
      expect(normalizePhoneNumber('+44 20 1234 5678')).toBe('+442012345678')
    })

    it('should handle plain numbers', () => {
      expect(normalizePhoneNumber('2315471144')).toBe('2315471144')
    })
  })

  describe('phoneNumbersMatch', () => {
    it('should match phones with different formatting', () => {
      expect(phoneNumbersMatch('(231) 547-1144', '231-547-1144')).toBe(true)
      expect(phoneNumbersMatch('231.547.1144', '2315471144')).toBe(true)
      expect(phoneNumbersMatch('+1 (231) 547-1144', '+12315471144')).toBe(true)
    })

    it('should not match different numbers', () => {
      expect(phoneNumbersMatch('(231) 547-1144', '(231) 547-1145')).toBe(false)
      expect(phoneNumbersMatch('2315471144', '2315471145')).toBe(false)
    })

    it('should handle international vs local numbers', () => {
      expect(phoneNumbersMatch('+1 231-547-1144', '231-547-1144')).toBe(false)
    })
  })
})
