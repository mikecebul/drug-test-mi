import { expect, test } from '@playwright/test'
import { render } from '@react-email/components'
import { createElement } from 'react'
import { ConfirmationPaymentEmail } from '../../src/emails/payments/ConfirmationPaymentEmail'

test('payment email renders through the same React runtime used by workflow services', async () => {
  const html = await render(createElement(ConfirmationPaymentEmail, ConfirmationPaymentEmail.PreviewProps))

  expect(html).toContain('Confirmation testing')
  expect(html).toContain('Pay securely')
  expect(html).toContain('https://checkout.stripe.com/example')
  expect(html).toContain('Questions? Contact Mike')
})
