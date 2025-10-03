import '@testing-library/jest-dom'
import { afterAll, beforeAll } from 'vitest'

// Mock environment variables for tests
beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_testing'
})

afterAll(() => {
  delete process.env.STRIPE_SECRET_KEY
})