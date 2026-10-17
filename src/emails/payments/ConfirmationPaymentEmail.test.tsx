import { render } from '@react-email/components'
import * as React from 'react'
import { describe, expect, test } from 'vitest'
import { ConfirmationPaymentEmail } from './ConfirmationPaymentEmail'

const props = ConfirmationPaymentEmail.PreviewProps

describe('ConfirmationPaymentEmail', () => {
  test('renders the shared brand, selected testing, real checkout link, and both deadlines', async () => {
    const html = (await render(<ConfirmationPaymentEmail {...props} />)).replace(/<!--.*?-->/g, '')
    expect(html).toContain('Confirmation testing')
    expect(html).toContain('Alex Morgan')
    expect(html).toContain('11-Panel Lab')
    expect(html).toContain('Oct 9, 2026')
    expect(html).toContain('Amphetamines')
    expect(html).toContain('$45.00')
    expect(html).toContain(`href="${props.checkoutUrl}"`)
    expect(html).toContain('Pay securely')
    expect(html).toContain('Lab hold ends Nov 8, 2026')
    expect(html).toContain('Link expires Oct 11, 2026, 10:30 AM EDT')
    expect(html).toContain('after payment clears')
    expect(html).toContain('201 State St, Lower level')
    expect(html).toContain('Questions? Contact Mike')
    expect(html).toContain('(231) 373-6341')
    expect(html).toContain('mike@midrugtest.com')
  })

  test('uses the outstanding confirmation balance rather than recomputing the original fee', async () => {
    const html = (
      await render(<ConfirmationPaymentEmail {...props} amountDue={20} substances={['amphetamines', 'cocaine']} />)
    ).replace(/<!--.*?-->/g, '')
    expect(html).toContain('$20.00')
    expect(html).not.toContain('$45.00')
    expect(html).not.toContain('$90.00')
    expect(html).toContain('Amphetamines, Cocaine')
  })

  test('omits unavailable legacy details without inventing dates or a hold', async () => {
    const html = await render(
      <ConfirmationPaymentEmail
        {...props}
        collectionDate={null}
        substances={[]}
        holdUntil={null}
        linkExpiresAt={null}
      />,
    )
    expect(html).not.toContain('Collected:')
    expect(html).not.toContain('Substances:')
    expect(html).not.toContain('Link expires')
    expect(html).not.toContain('Lab hold ends')
    expect(html).toContain('Payment before confirmation')
  })

  test('escapes client names and provides a readable text version with the payment destination', async () => {
    const email = <ConfirmationPaymentEmail {...props} clientName={'<Alex> & Morgan'} />
    const html = await render(email)
    expect(html).toContain('&lt;Alex&gt; &amp; Morgan')
    const text = await render(email, { plainText: true })
    expect(text).toContain('$45.00')
    expect(text).toContain(props.checkoutUrl)
    expect(text).toContain('Lab hold ends Nov 8, 2026')
    expect(text).toContain('mike@midrugtest.com')
  })
})
