import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from '@react-email/components'
import {
  ScreenedEmail,
  ScreenedEmailReferral,
  CompleteEmail,
  CompleteEmailReferral,
  InconclusiveEmail,
  InconclusiveEmailReferral,
} from '@/emails/drug-tests'
import { buildCollectedEmail, buildCompleteEmail, buildInconclusiveEmail, buildScreenedEmail } from '../render'
import type { CompleteEmailData, ScreenedEmailData } from '../types'
import { formatEmailDate, formatEmailDob } from '@/emails/drug-tests/utils/formatters'

const screen: ScreenedEmailData = {
  clientName: 'Alex Morgan',
  clientDob: '1990-01-14',
  collectionDate: '2026-10-09T14:30:00Z',
  testType: '11-panel-lab',
  initialScreenResult: 'mixed-unexpected',
  detectedSubstances: ['amphetamines', 'buprenorphine'],
  expectedPositives: ['buprenorphine'],
  unexpectedPositives: ['amphetamines'],
  unexpectedNegatives: ['benzodiazepines'],
  isDilute: false,
  breathalyzerTaken: false,
  breathalyzerResult: null,
  confirmationDecision: 'pending-decision',
  confirmationHoldUntil: '2026-11-10T03:59:59Z',
}

const complete: CompleteEmailData = {
  ...screen,
  detectedSubstances: ['buprenorphine'],
  unexpectedPositives: [],
  confirmationResults: [
    { substance: 'amphetamines', result: 'confirmed-negative', notes: 'Below cutoff' },
    { substance: 'buprenorphine', result: 'confirmed-positive' },
  ],
  finalStatus: 'expected-positive',
}

function content(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

describe('shared drug test emails', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  test('client and referral exports are aliases of one template', () => {
    expect(ScreenedEmailReferral).toBe(ScreenedEmail)
    expect(CompleteEmailReferral).toBe(CompleteEmail)
    expect(InconclusiveEmailReferral).toBe(InconclusiveEmail)
  })

  test('screening uses identical content, labeled metadata, attachment grouping, and the new contact footer', async () => {
    const email = await buildScreenedEmail({ ...screen, reportFilename: 'screening-2026.pdf' })
    expect(email.client).toEqual(email.referrals)
    const body = content(email.client.html)
    expect(body).toContain('Test type: 11-Panel Lab')
    expect(body).toContain('Collected: Oct 9, 2026')
    expect(body).toContain('DOB Jan 14, 1990')
    expect(body).toContain('Amphetamines')
    expect(body).toContain('Unexpected')
    expect(body).toContain('Buprenorphine')
    expect(body).toContain('Expected')
    expect(body).toContain('screening-2026.pdf Attached to this email')
    expect(body).toContain('201 State St, Lower level')
    expect(body).toContain('Charlevoix, MI 49720')
    expect(body).toContain('Questions? Contact Mike')
    expect(body).toContain('(231) 373-6341')
    expect(email.client.html).toContain('href="tel:+12313736341"')
    expect(email.client.html).toContain('href="mailto:mike@midrugtest.com"')
    expect(body).not.toContain('benzodiazepines')
    expect(body).not.toContain('Unexpected Negative')
    expect(body).not.toContain('Notification sent')
    expect(body).not.toContain('All rights reserved')
    expect(body).not.toContain('View Test Results')
  })

  test.each(['unexpected-negative-warning', 'unexpected-negative-critical'])(
    'omits missed-medication notices for %s',
    async (initialScreenResult) => {
      const email = await buildScreenedEmail({
        ...screen,
        initialScreenResult,
        detectedSubstances: [],
        expectedPositives: [],
        unexpectedPositives: [],
      })
      const body = content(email.client.html)
      expect(body).toContain('No substances detected')
      expect(body).not.toContain('Benzodiazepines')
      expect(body).not.toContain('Unexpected')
      expect(body).not.toContain('Confirmation available')
    },
  )

  test('preserves dilute and breathalyzer results', async () => {
    const email = await buildScreenedEmail({
      ...screen,
      isDilute: true,
      breathalyzerTaken: true,
      breathalyzerResult: 0.125,
    })
    expect(content(email.client.html)).toContain('Dilute sample')
    expect(content(email.client.html)).toContain('0.125 BAC')
    expect(content(email.client.html)).toContain('Positive')
    const negativeBac = await buildScreenedEmail({ ...screen, breathalyzerTaken: true, breathalyzerResult: 0 })
    expect(content(negativeBac.client.html)).toContain('0.000 BAC')
    const absentBac = await buildScreenedEmail({ ...screen, breathalyzerTaken: true, breathalyzerResult: null })
    expect(content(absentBac.client.html)).not.toContain('BAC')
  })

  test('shows lab confirmation price and the screening-based deadline', async () => {
    const email = await buildScreenedEmail(screen)
    const body = content(email.client.html)
    expect(body).toContain('Confirmation available')
    expect(body).toContain('$45 per substance')
    expect(body).not.toContain('$$')
    expect(body).toContain('Request by Nov 9, 2026')
  })

  test('instant confirmation uses its own price and specimen availability', async () => {
    const email = await buildScreenedEmail({ ...screen, testType: '17-panel-instant', confirmationHoldUntil: null })
    const body = content(email.client.html)
    expect(body).toContain('$30 per substance')
    expect(body).toContain('Request before specimen disposal')
    expect(body).not.toContain('30 days')
    expect(body).toContain('Instant report.pdf')
  })

  test('no lab deadline falls back to the screening result date, never the collection date', async () => {
    const email = await buildScreenedEmail({ ...screen, confirmationHoldUntil: 'invalid' })
    expect(content(email.client.html)).toContain('30 days of the screening result date')
  })

  test.each([
    {
      fields: { confirmationDecision: 'accept' as const },
      title: 'Screening result accepted',
      detail: 'No confirmation requested.',
    },
    {
      fields: { confirmationDecision: 'request-confirmation' as const, confirmationPaymentRequired: true },
      title: 'Payment needed',
      detail: 'Lab request after payment.',
    },
    {
      fields: { confirmationDecision: 'request-confirmation' as const, confirmationPaymentRequired: false },
      title: 'Confirmation selected',
      detail: 'Staff coordinating with the lab. Final result pending.',
    },
    {
      fields: { confirmationDecision: 'request-confirmation' as const, confirmationCompleted: true },
      title: 'Confirmation complete',
      detail: 'Final report attached.',
    },
  ])('renders $title for either audience', async ({ fields, title, detail }) => {
    const email = await buildScreenedEmail({ ...screen, ...fields })
    expect(email.client).toEqual(email.referrals)
    const body = content(email.client.html)
    expect(body).toContain(title)
    expect(body).toContain(detail)
    if (title === 'Payment needed') expect(body).toContain('$45 per substance · Pay by Nov 9, 2026')
  })

  test('closes expired unrequested/unpaid confirmation windows without offering payment', async () => {
    for (const decision of ['pending-decision', 'request-confirmation'] as const) {
      const email = await buildScreenedEmail({
        ...screen,
        confirmationDecision: decision,
        confirmationPaymentRequired: true,
        confirmationHoldUntil: '2026-10-09T12:00:00Z',
      })
      const body = content(email.client.html)
      expect(body).toContain('Confirmation window closed')
      expect(body).not.toContain('per substance')
    }
  })

  test('completed confirmation overrides old deadlines and keeps expected confirmed positives green', async () => {
    const email = await buildCompleteEmail({ ...complete, confirmationHoldUntil: '2026-10-09T12:00:00Z' })
    expect(email.client).toEqual(email.referrals)
    const body = content(email.client.html)
    expect(body).toContain('Confirmation results')
    expect(body).toContain('Confirmed negative')
    expect(body).toContain('Below cutoff')
    expect(body).toContain('Confirmed positive')
    expect(body).toContain('Expected')
    expect(body).not.toContain('Unexpected')
    expect(body).not.toContain('per substance')
    expect(body).not.toContain('window closed')
    expect(body.match(/Amphetamines/g)).toHaveLength(1)
    expect(body.match(/Buprenorphine/g)).toHaveLength(1)
  })

  test('retains unconfirmed screen findings alongside confirmed outcomes', async () => {
    const email = await buildCompleteEmail({
      ...complete,
      detectedSubstances: ['buprenorphine', 'cocaine'],
      unexpectedPositives: ['cocaine'],
    })
    const body = content(email.client.html)
    expect(body).toContain('Cocaine')
    expect(body).toContain('Screening result · Not confirmed')
    expect(body).toContain('Unexpected')
  })

  test.each(['inconclusive', 'unrecognized'])(
    'confirmation outcome %s is never silently rendered negative',
    async (result) => {
      const email = await buildCompleteEmail({
        ...complete,
        detectedSubstances: [],
        expectedPositives: [],
        confirmationResults: [{ substance: 'amphetamines', result }],
      })
      const body = content(email.client.html)
      expect(body).toContain(result === 'inconclusive' ? 'Inconclusive' : 'Result unavailable')
      expect(body).not.toContain('Confirmed negative')
    },
  )

  test('positive confirmation aliases still report unexpected confirmed positives', async () => {
    const email = await buildCompleteEmail({
      ...complete,
      expectedPositives: [],
      confirmationResults: [{ substance: 'cocaine', result: 'positive' }],
    })
    const body = content(email.client.html)
    expect(body).toContain('Confirmed positive')
    expect(body).toContain('Unexpected')
  })

  test('referral collection email matches the shell without claiming results or an attachment', async () => {
    const email = await buildCollectedEmail({ ...screen, breathalyzerTaken: true, breathalyzerResult: 0 })
    const body = content(email.html)
    expect(body).toContain('Lab collection')
    expect(body).toContain('Test type: 11-Panel Lab')
    expect(body).toContain('Collected: Oct 9, 2026')
    expect(body).toContain('Sample collected')
    expect(body).toContain('Results will be emailed when available')
    expect(body).toContain('0.000 BAC')
    expect(body).toContain('Questions? Contact Mike')
    expect(body).not.toContain('Attached to this email')
    expect(body).not.toContain('Confirmation available')
  })

  test('inconclusive client/referral content is identical and safely escapes the reason', async () => {
    const email = await buildInconclusiveEmail({ ...screen, reason: '<script>bad()</script>' })
    expect(email.client).toEqual(email.referrals)
    const body = content(email.client.html)
    expect(body).toContain('Inconclusive result')
    expect(body).toContain('Contact Mike to arrange a new test')
    expect(email.client.html).toContain('&lt;script&gt;')
    expect(email.client.html).not.toContain('<script>')
    expect(body).not.toContain('Attached to this email')
  })

  test('headshots and DOB are compact; missing portraits use initials', async () => {
    const withHeadshot = await render(<ScreenedEmail {...screen} clientHeadshotDataUri="cid:client-headshot" />)
    expect(withHeadshot).toContain('src="cid:client-headshot"')
    expect(withHeadshot).not.toContain('Image available for 7 days')
    const noPortrait = content((await buildScreenedEmail(screen)).client.html)
    expect(noPortrait).toContain('AM')
  })

  test('date formatting respects clinic timestamps and calendar DOBs', () => {
    expect(formatEmailDate('2026-10-10T01:00:00Z')).toBe('Oct 9, 2026')
    expect(formatEmailDate('2026-10-09')).toBe('Oct 9, 2026')
    expect(formatEmailDob('1990-01-14T00:00:00Z')).toBe('Jan 14, 1990')
    expect(formatEmailDate('invalid')).toBe('Not available')
  })
})
