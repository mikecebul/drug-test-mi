import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { useGuidedConfirmations } from './useGuidedConfirmations'

describe('guided local confirmations', () => {
  it('remounts with the current acknowledgements without a missing-queryFn error', () => {
    const queryClient = new QueryClient()
    const error = vi.spyOn(console, 'error')
    const render = () =>
      renderToString(createElement(QueryClientProvider, { client: queryClient }, createElement(Confirmation)))
    function Confirmation() {
      const { keys } = useGuidedConfirmations('verified-client-identities', 'admin')
      const { keys: reports } = useGuidedConfirmations('created-lab-reports', 'admin')
      return createElement('span', null, JSON.stringify([keys, reports]))
    }

    try {
      render()
      queryClient.setQueryData(['guided', 'verified-client-identities', 'admin'], ['booking-client-name-dob'])
      queryClient.setQueryData(['guided', 'created-lab-reports', 'admin'], ['booking-client-test'])
      expect(render()).toContain('booking-client-name-dob')
      expect(render()).toContain('booking-client-test')
      expect(error.mock.calls.flat().some((message) => String(message).includes('No queryFn was passed'))).toBe(false)
      queryClient.removeQueries({ queryKey: ['guided'] })
      expect(render()).not.toContain('booking-client')
    } finally {
      error.mockRestore()
      queryClient.clear()
    }
  })
})
